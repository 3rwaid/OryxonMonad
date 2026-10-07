import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const paymentPath = "/checkout/v1/payment";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256(value: string): Promise<string> {
  return base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const clientId = Deno.env.get("DOKU_CLIENT_ID");
    const secretKey = Deno.env.get("DOKU_SECRET_KEY");
    if (!clientId || !secretKey) return response({ error: "DOKU payment is not configured" }, 500);

    const body = await req.json() as {
      buyer_wallet?: string;
      buyer_email?: string;
      tree_species?: string;
      quantity?: number;
    };
    const { buyer_wallet, buyer_email, tree_species, quantity } = body;
    if (!buyer_wallet || !buyer_email || !tree_species || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return response({ error: "Invalid payment details" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: setting, error: settingError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "tree_price_idr")
      .maybeSingle();
    if (settingError || !setting?.value) return response({ error: "Payment price is unavailable" }, 500);

    const unitPriceIdr = Math.round(Number(setting.value));
    if (!Number.isSafeInteger(unitPriceIdr) || unitPriceIdr <= 0) return response({ error: "Payment price is invalid" }, 500);
    const totalPriceIdr = unitPriceIdr * quantity;
    const { data: order, error: orderError } = await supabase.from("tree_purchase_orders").insert({
      buyer_wallet: buyer_wallet.toLowerCase(),
      buyer_email,
      payment_method: "fiat",
      tree_species,
      quantity,
      unit_price_idr: unitPriceIdr,
      total_price_idr: totalPriceIdr,
      currency: "IDR",
      oxy_amount: 0,
      status: "pending",
    }).select("id").single();
    if (orderError || !order) return response({ error: "Could not create payment order" }, 500);

    const invoice = `OXY-${order.id.replaceAll("-", "").slice(0, 24).toUpperCase()}`;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestId = crypto.randomUUID();
    const callbackUrl = Deno.env.get("DOKU_CALLBACK_URL") ?? "";
    const requestBody = {
      order: {
        amount: totalPriceIdr,
        invoice_number: invoice,
        currency: "IDR",
        callback_url: callbackUrl,
        callback_url_cancel: callbackUrl,
        callback_url_result: callbackUrl,
        auto_redirect: true,
        line_items: [{
          id: `tree-${tree_species.toLowerCase()}`,
          name: `OxyTree (${tree_species})`,
          quantity,
          price: unitPriceIdr,
          category: "NFT / Digital Asset",
        }],
      },
      payment: { payment_due_date: 60 },
      customer: { id: buyer_wallet.toLowerCase(), name: "Oryxon Buyer", email: buyer_email, country: "ID" },
    };
    const requestJson = JSON.stringify(requestBody);
    const digest = await sha256(requestJson);
    const signature = await hmac(`Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${paymentPath}\nDigest:${digest}`, secretKey);
    const baseUrl = Deno.env.get("DOKU_IS_PRODUCTION") === "true" ? "https://api.doku.com" : "https://api-sandbox.doku.com";
    const dokuResponse = await fetch(`${baseUrl}${paymentPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Id": clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, "Signature": `HMACSHA256=${signature}` },
      body: requestJson,
    });
    if (!dokuResponse.ok) {
      console.error("DOKU create payment failed", dokuResponse.status, await dokuResponse.text());
      await supabase.from("tree_purchase_orders").update({ status: "cancelled" }).eq("id", order.id);
      return response({ error: "Could not open DOKU Checkout" }, 502);
    }

    const dokuBody = await dokuResponse.json();
    const paymentUrl = dokuBody?.response?.payment?.url ?? dokuBody?.response?.order?.url;
    if (!paymentUrl || typeof paymentUrl !== "string") {
      await supabase.from("tree_purchase_orders").update({ status: "cancelled" }).eq("id", order.id);
      return response({ error: "DOKU did not return a checkout URL" }, 502);
    }
    await supabase.from("tree_purchase_orders").update({ doku_invoice_number: invoice, doku_payment_url: paymentUrl }).eq("id", order.id);
    return response({ order_id: order.id, invoice_number: invoice, payment_url: paymentUrl, amount_idr: totalPriceIdr });
  } catch (error) {
    console.error("DOKU transaction error", error);
    return response({ error: "Could not create payment" }, 500);
  }
});

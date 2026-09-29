import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// IDR exchange rate: 1 USD = approx 16,000 IDR (Midtrans requires IDR for Indonesian merchants)
const USD_TO_IDR = 16000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    if (!serverKey) {
      return new Response(
        JSON.stringify({ error: "MIDTRANS_SERVER_KEY secret is not set. Add it via Supabase Dashboard → Edge Functions → Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      buyer_wallet,
      buyer_email,
      tree_species,
      quantity,
      unit_price_usd,
      total_price_usd,
    } = body as {
      buyer_wallet: string;
      buyer_email: string;
      tree_species: string;
      quantity: number;
      unit_price_usd: number;
      total_price_usd: number;
    };

    if (!buyer_wallet || !buyer_email || !tree_species || !quantity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: buyer_wallet, buyer_email, tree_species, quantity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service-role client — bypasses RLS / SELECT grant restrictions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Create the pending order server-side
    const { data: order, error: orderErr } = await supabase
      .from("tree_purchase_orders")
      .insert({
        buyer_wallet: buyer_wallet.toLowerCase(),
        buyer_email,
        payment_method: "fiat",
        tree_species,
        quantity,
        unit_price_usd,
        total_price_usd,
        oxy_amount: 0,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Order creation error:", orderErr);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId: string = order.id;

    // 2. Build a unique Midtrans order ID (Midtrans requires a unique string, not a UUID)
    const midtransOrderId = `OXY-${orderId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const grossAmountIdr = Math.round(total_price_usd * USD_TO_IDR);

    // 3. Create Midtrans Snap transaction
    const snapApiUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authHeader = `Basic ${btoa(serverKey + ":")}`;

    const snapPayload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: grossAmountIdr,
      },
      customer_details: {
        email: buyer_email,
        notes: `OxyTree (${tree_species}) x${quantity} — Wallet: ${buyer_wallet}`,
      },
      item_details: [
        {
          id: `tree-${tree_species.toLowerCase()}`,
          price: Math.round(unit_price_usd * USD_TO_IDR),
          quantity,
          name: `OxyTree (${tree_species})`,
          category: "NFT / Digital Asset",
        },
      ],
      callbacks: {
        finish: Deno.env.get("MIDTRANS_FINISH_URL") ?? "",
      },
    };

    const midtransRes = await fetch(snapApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(snapPayload),
    });

    if (!midtransRes.ok) {
      const errBody = await midtransRes.text();
      console.error("Midtrans API error:", midtransRes.status, errBody);
      // Cancel the order so it doesn't stay as a ghost pending record
      await supabase
        .from("tree_purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);
      return new Response(
        JSON.stringify({ error: "Failed to create Midtrans transaction", detail: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token, redirect_url } = await midtransRes.json();

    // 4. Persist midtrans_order_id and IDR amount on the order row
    await supabase
      .from("tree_purchase_orders")
      .update({
        midtrans_order_id: midtransOrderId,
        total_price_idr: grossAmountIdr,
        currency: "IDR",
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ snap_token: token, redirect_url, order_id: orderId, midtrans_order_id: midtransOrderId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

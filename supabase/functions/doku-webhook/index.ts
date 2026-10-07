import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const notificationPath = "/functions/v1/doku-webhook";

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
async function digest(value: string): Promise<string> {
  return base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const clientId = Deno.env.get("DOKU_CLIENT_ID");
    const secretKey = Deno.env.get("DOKU_SECRET_KEY");
    if (!clientId || !secretKey) return reply({ error: "Payment notification is not configured" }, 500);
    const rawBody = await req.text();
    const requestId = req.headers.get("Request-Id") ?? req.headers.get("X-Request-Id") ?? "";
    const timestamp = req.headers.get("Request-Timestamp") ?? req.headers.get("X-Timestamp") ?? "";
    const receivedSignature = req.headers.get("Signature") ?? req.headers.get("X-SIGNATURE") ?? "";
    const bodyDigest = await digest(rawBody);
    const expectedSignature = `HMACSHA256=${await hmac(`Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${notificationPath}\nDigest:${bodyDigest}`, secretKey)}`;
    if (!requestId || !timestamp || receivedSignature !== expectedSignature) return reply({ error: "Invalid notification" }, 401);

    const notification = JSON.parse(rawBody) as {
      order?: { invoice_number?: string };
      transaction?: { status?: string; id?: string };
      service?: { identifier?: string };
    };
    const invoice = notification.order?.invoice_number;
    if (!invoice) return reply({ message: "Ignored" });
    const status = String(notification.transaction?.status ?? "").toUpperCase();
    const newStatus = ["SUCCESS", "SUCCESSFUL", "SETTLEMENT", "PAID"].includes(status)
      ? "paid"
      : ["FAILED", "CANCELLED", "EXPIRED", "DENIED"].includes(status) ? "cancelled" : null;
    if (!newStatus) return reply({ message: "Unchanged" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await supabase.from("tree_purchase_orders").select("id,status").eq("doku_invoice_number", invoice).maybeSingle();
    if (!order) return reply({ message: "Order not found" });
    if (["paid", "minting", "delivered"].includes(order.status)) return reply({ message: "Already processed" });
    await supabase.from("tree_purchase_orders").update({ status: newStatus, doku_transaction_id: notification.transaction?.id ?? "" }).eq("id", order.id);
    return reply({ message: "OK" });
  } catch (error) {
    console.error("DOKU webhook error", error);
    return reply({ error: "Could not process notification" }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function sha512(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      return new Response(JSON.stringify({ error: "Server key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notification = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id,
    } = notification;

    // Verify signature: SHA-512(order_id + status_code + gross_amount + server_key)
    const expected = sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (expected !== signature_key) {
      console.warn("Invalid Midtrans signature for order:", order_id);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the order by midtrans_order_id
    const { data: order, error: findErr } = await supabase
      .from("tree_purchase_orders")
      .select("id, status")
      .eq("midtrans_order_id", order_id)
      .maybeSingle();

    if (findErr || !order) {
      console.warn("Order not found for midtrans_order_id:", order_id);
      // Return 200 so Midtrans stops retrying for unknown orders
      return new Response(JSON.stringify({ message: "Order not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already processed
    if (order.status === "paid" || order.status === "delivered" || order.status === "minting") {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus: string | null = null;

    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      // settlement = transfer/QRIS fully settled
      // capture = credit card captured
      if (fraud_status === "accept" || fraud_status === undefined || fraud_status === null) {
        newStatus = "paid";
      } else {
        newStatus = "cancelled";
      }
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "expire"
    ) {
      newStatus = "cancelled";
    }
    // "pending" = waiting for bank transfer confirmation — leave order as-is

    if (newStatus) {
      const updatePayload: Record<string, string> = {
        status: newStatus,
        midtrans_transaction_id: transaction_id ?? "",
      };

      await supabase
        .from("tree_purchase_orders")
        .update(updatePayload)
        .eq("id", order.id);

      console.log(`Order ${order.id} updated to ${newStatus} via Midtrans webhook`);
    }

    return new Response(JSON.stringify({ message: "OK", status: newStatus ?? "unchanged" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

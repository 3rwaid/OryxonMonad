import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      buyer_wallet,
      buyer_email,
      payment_method,
      tree_species,
      quantity,
      unit_price_idr,
      total_price_idr,
      oxy_amount,
    } = body as {
      buyer_wallet: string;
      buyer_email?: string;
      payment_method: string;
      tree_species: string;
      quantity: number;
      unit_price_idr: number;
      total_price_idr: number;
      oxy_amount?: number;
    };

    if (!buyer_wallet || !payment_method || !tree_species || !quantity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: buyer_wallet, payment_method, tree_species, quantity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service-role client — bypasses RLS / SELECT grant restrictions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderErr } = await supabase
      .from("tree_purchase_orders")
      .insert({
        buyer_wallet: buyer_wallet.toLowerCase(),
        buyer_email: buyer_email ?? "",
        payment_method,
        tree_species,
        quantity,
        unit_price_idr,
        total_price_idr,
        currency: "IDR",
        oxy_amount: oxy_amount ?? 0,
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

    return new Response(
      JSON.stringify({ order_id: order.id }),
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

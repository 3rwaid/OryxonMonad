import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const { phase_id, buyer_wallet, oxy_amount, mon_amount, tx_hash } = body;

    if (!phase_id || !buyer_wallet || !oxy_amount || !tx_hash) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert the purchase record
    const { error: insertError } = await admin.from("ido_purchases").insert([{
      phase_id,
      buyer_wallet: buyer_wallet.toLowerCase(),
      oxy_amount,
      mon_amount,
      tx_hash,
      status: "confirmed",
    }]);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Atomically increment sold_oxy using a stored procedure approach
    // First read current value, then update
    const { data: phase, error: phaseError } = await admin
      .from("ido_phases")
      .select("sold_oxy")
      .eq("id", phase_id)
      .single();

    if (phaseError) {
      return new Response(JSON.stringify({ error: phaseError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const newSoldOxy = (phase.sold_oxy ?? 0) + oxy_amount;

    const { error: updateError } = await admin
      .from("ido_phases")
      .update({ sold_oxy: newSoldOxy })
      .eq("id", phase_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      sold_oxy: newSoldOxy,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { staking_position_id, claimer_address } = await req.json();

    if (!staking_position_id || !claimer_address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: position, error: posError } = await supabase
      .from("staking_positions")
      .select("*, nft_b(*)")
      .eq("id", staking_position_id)
      .eq("staker_address", claimer_address)
      .eq("is_active", true)
      .maybeSingle();

    if (posError || !position) {
      return new Response(
        JSON.stringify({ error: "Staking position not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const lastClaim = new Date(position.last_claim_at).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (now - lastClaim < dayMs) {
      return new Response(
        JSON.stringify({
          error: "Claim period not elapsed",
          next_claim_at: new Date(lastClaim + dayMs).toISOString(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: stats } = await supabase
      .from("platform_stats")
      .select("staking_reward_pool, total_staked_nft_b")
      .maybeSingle();

    if (!stats || stats.total_staked_nft_b === 0) {
      return new Response(
        JSON.stringify({ error: "No staking data available" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const elapsedDays = Math.floor((now - lastClaim) / dayMs);
    const dailyReward =
      (1 / stats.total_staked_nft_b) *
      (0.001 * stats.staking_reward_pool);
    const totalReward = dailyReward * elapsedDays;

    const { error: claimError } = await supabase
      .from("reward_claims")
      .insert({
        staking_position_id,
        claimer_address,
        amount: totalReward,
      });

    if (claimError) {
      return new Response(
        JSON.stringify({ error: "Failed to record claim" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await supabase
      .from("staking_positions")
      .update({
        last_claim_at: new Date().toISOString(),
        total_rewards_claimed: position.total_rewards_claimed + totalReward,
      })
      .eq("id", staking_position_id);

    const { data: balance } = await supabase
      .from("oxy_balances")
      .select("*")
      .eq("wallet_address", claimer_address)
      .maybeSingle();

    if (balance) {
      await supabase
        .from("oxy_balances")
        .update({
          balance: balance.balance + totalReward,
          staking_rewards_earned:
            balance.staking_rewards_earned + totalReward,
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", claimer_address);
    } else {
      await supabase.from("oxy_balances").insert({
        wallet_address: claimer_address,
        balance: totalReward,
        staking_rewards_earned: totalReward,
      });
    }

    await supabase
      .from("platform_stats")
      .update({
        staking_reward_pool: stats.staking_reward_pool - totalReward,
        total_oxy_distributed:
          (stats as Record<string, number>).total_oxy_distributed +
          totalReward,
        updated_at: new Date().toISOString(),
      })
      .not("id", "is", null);

    return new Response(
      JSON.stringify({
        success: true,
        reward: totalReward,
        elapsed_days: elapsedDays,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

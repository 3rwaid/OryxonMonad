import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FEE_RATE_BPS = 250;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list") {
      const { nft_type, nft_id, seller_address, price, price_currency } =
        await req.json();

      if (!nft_type || !nft_id || !seller_address || !price) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: listing, error } = await supabase
        .from("marketplace_listings")
        .insert({
          nft_type,
          nft_id,
          seller_address,
          price,
          price_currency: price_currency || "OXY",
        })
        .select()
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({
            error: "Failed to create listing",
            details: error.message,
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true, listing }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "buy") {
      const { listing_id, buyer_address } = await req.json();

      if (!listing_id || !buyer_address) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: listing, error: fetchError } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", listing_id)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError || !listing) {
        return new Response(
          JSON.stringify({ error: "Listing not found or inactive" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (listing.seller_address === buyer_address) {
        return new Response(
          JSON.stringify({ error: "Cannot buy own listing" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const fee = (listing.price * FEE_RATE_BPS) / 10000;

      await supabase
        .from("marketplace_listings")
        .update({
          is_active: false,
          buyer_address,
          sold_at: new Date().toISOString(),
          fee_amount: fee,
        })
        .eq("id", listing_id);

      const table = listing.nft_type === "A" ? "nft_a" : "nft_b";
      await supabase
        .from(table)
        .update({ owner_address: buyer_address })
        .eq("id", listing.nft_id);

      const { data: stats } = await supabase
        .from("platform_stats")
        .select("staking_reward_pool, marketplace_fee_pool")
        .maybeSingle();

      if (stats) {
        await supabase
          .from("platform_stats")
          .update({
            staking_reward_pool: stats.staking_reward_pool + fee,
            marketplace_fee_pool: stats.marketplace_fee_pool + fee,
            updated_at: new Date().toISOString(),
          })
          .not("id", "is", null);
      }

      return new Response(
        JSON.stringify({
          success: true,
          fee,
          total_paid: listing.price,
          seller_receives: listing.price - fee,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "cancel") {
      const { listing_id, seller_address } = await req.json();

      await supabase
        .from("marketplace_listings")
        .update({ is_active: false })
        .eq("id", listing_id)
        .eq("seller_address", seller_address);

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use ?action=list|buy|cancel",
      }),
      {
        status: 400,
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

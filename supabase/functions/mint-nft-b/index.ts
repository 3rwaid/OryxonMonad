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

    const {
      name,
      tree_species,
      location_name,
      location_lat,
      location_lng,
      planter_name,
      price_usd,
      owner_address,
      description,
    } = await req.json();

    if (!name || !tree_species || !location_name || !owner_address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: nftB, error: insertError } = await supabase
      .from("nft_b")
      .insert({
        name,
        description: description || "",
        tree_species,
        location_lat: location_lat || 0,
        location_lng: location_lng || 0,
        location_name,
        planter_name: planter_name || "",
        planted_at: new Date().toISOString(),
        owner_address,
        price_usd: price_usd || 0,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: "Failed to mint NFT",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await supabase
      .from("platform_stats")
      .update({
        total_nft_b_minted: supabase.rpc
          ? undefined
          : undefined,
        total_trees_planted: supabase.rpc
          ? undefined
          : undefined,
        updated_at: new Date().toISOString(),
      })
      .not("id", "is", null);

    await supabase.rpc("increment_nft_b_stats").catch(() => {});

    return new Response(
      JSON.stringify({ success: true, nft: nftB }),
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

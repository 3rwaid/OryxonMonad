import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED = ["app_settings", "exchange_links", "ido_phases"] as const;
type Resource = typeof ALLOWED[number];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let resource: string | null = null;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      resource = body?.resource ?? null;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } else {
    const url = new URL(req.url);
    resource = url.searchParams.get("resource");
  }

  if (!resource || !(ALLOWED as readonly string[]).includes(resource)) {
    return new Response(JSON.stringify({ error: "Invalid resource" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let query = admin.from(resource as Resource).select("*");
  if (resource === "exchange_links") {
    query = query.order("sort_order", { ascending: true });
  } else if (resource === "ido_phases") {
    query = query.order("created_at", { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

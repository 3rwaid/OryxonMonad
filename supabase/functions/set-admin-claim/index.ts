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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!adminEmail) {
    return new Response(JSON.stringify({ error: "ADMIN_EMAIL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Verify the calling user via their JWT
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Only the configured admin email may receive the superadmin role
  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return new Response(JSON.stringify({ error: "Unauthorized: not the admin account" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Use service role for privileged operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Upsert the user_roles row with superadmin
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: user.id, role: "superadmin", assigned_by: user.id },
      { onConflict: "user_id" },
    );

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Already has the claim — nothing to do
  if (user.app_metadata?.role === "superadmin") {
    return new Response(JSON.stringify({ success: true, already_admin: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Grant the role claim via service role
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: "superadmin", is_admin: true },
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true, already_admin: false }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

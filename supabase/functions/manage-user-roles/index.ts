import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_ROLES = ["superadmin", "admin", "end_user"] as const;
type Role = (typeof VALID_ROLES)[number];

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

  // Verify the calling user
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

  // Check caller's role
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: callerRoleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const callerRole = callerRoleRow?.role ?? "end_user";

  if (callerRole !== "superadmin") {
    return new Response(JSON.stringify({ error: "Only superadmin can manage roles" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // GET: list all users with their roles
  if (req.method === "GET") {
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at");

    if (rolesError) {
      return new Response(JSON.stringify({ error: rolesError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch emails from auth.admin
    const userIds = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    const usersWithEmails: { user_id: string; email: string; role: string; created_at: string }[] = [];

    for (const r of roles ?? []) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      usersWithEmails.push({
        user_id: r.user_id,
        email: authUser?.user?.email ?? "(unknown)",
        role: r.role,
        created_at: r.created_at,
      });
    }

    return new Response(JSON.stringify({ users: usersWithEmails }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // POST/PUT: update a user's role
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    const { target_user_id, new_role } = body as { target_user_id: string; new_role: string };

    if (!target_user_id || !new_role) {
      return new Response(JSON.stringify({ error: "target_user_id and new_role are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!VALID_ROLES.includes(new_role as Role)) {
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prevent superadmin from demoting themselves (avoid lockout)
    if (target_user_id === user.id && new_role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Cannot demote yourself" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update the role in user_roles
    const { error: upsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: target_user_id, role: new_role, assigned_by: user.id },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update the JWT claim
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    if (targetUser?.user) {
      await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        app_metadata: { ...targetUser.user.app_metadata, role: new_role, is_admin: new_role === "superadmin" || new_role === "admin" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: target_user_id, role: new_role }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

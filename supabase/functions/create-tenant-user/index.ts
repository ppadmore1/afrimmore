import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const ROLES = ["admin", "staff", "cashier", "branch_manager", "inventory_officer", "accountant", "executive"];
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: myRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!myRoles?.some((r) => r.role === "admin" || r.role === "owner")) return json({ error: "Only admins can create users" }, 403);
    const { data: tid } = await admin.rpc("get_user_tenant_id", { p_user_id: user.id });
    if (!tid) return json({ error: "No business found for your account" }, 400);

    const { email, password, fullName, role, branchIds = [] } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return json({ error: "Enter a valid email address" }, 400);
    if (!password || String(password).length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (!ROLES.includes(role)) return json({ error: "Invalid role" }, 400);
    if (role !== "admin" && (!Array.isArray(branchIds) || branchIds.length === 0)) return json({ error: "Select at least one branch" }, 400);

    const { data: validBranches } = await admin.from("branches").select("id").eq("tenant_id", tid).in("id", branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"]);
    const bIds = (validBranches || []).map((b) => b.id);

    // The signup trigger links the new account to this business via a pending invitation
    await admin.from("invitations").delete().eq("tenant_id", tid).ilike("email", cleanEmail).eq("status", "pending");
    const { error: invErr } = await admin.from("invitations").insert({
      email: cleanEmail, role, branch_ids: bIds, tenant_id: tid, invited_by: user.id, status: "pending",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    if (invErr) return json({ error: invErr.message }, 400);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: cleanEmail, password, email_confirm: true, user_metadata: { full_name: fullName || "" },
    });
    if (error) {
      await admin.from("invitations").delete().eq("tenant_id", tid).ilike("email", cleanEmail).eq("status", "pending");
      const msg = /already/i.test(error.message) ? "A user with this email already exists" : error.message;
      return json({ error: msg }, 400);
    }
    return json({ userId: created.user?.id, email: cleanEmail });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

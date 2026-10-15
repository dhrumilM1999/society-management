// Edge Function: manage-admins — super admin only.
// Lets the super admin add admins, deactivate / reactivate them, grant or remove super-admin status
// and reset passwords, all from the website (no manual database work).
// Uses the service key server-side only; the caller is verified from their own session first.
// Deploy from the Supabase dashboard (Edge Functions → manage-admins) or `supabase functions deploy manage-admins`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOREVER = "876000h"; // ~100 years: the auth ban used to block sign-in

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Please sign in first." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    (Deno.env.get("SUPABASE_SECRET_KEYS") ? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"] : undefined);
  if (!url || !publishableKey || !secretKey) return json({ error: "Server configuration is incomplete." }, 500);

  const callerClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await callerClient.auth.getUser();
  if (authError || !auth?.user) return json({ error: "Session invalid or expired." }, 401);
  const callerId: string = auth.user.id;

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.from("profiles").select("role,is_super,is_active").eq("id", callerId).maybeSingle();
  if (callerError || !caller || caller.role !== "admin" || !caller.is_super || caller.is_active === false) {
    return json({ error: "Only the super admin can manage admin accounts." }, 403);
  }

  const audit = (action: string, entityId: string | null, details: Record<string, unknown>) =>
    admin.from("audit_log").insert({ actor_id: callerId, action, entity_type: "admin_account", entity_id: entityId, details });

  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "create_admin") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const displayName = String(body.display_name ?? "").trim();
      const phone = String(body.contact_phone ?? "").trim();
      const password = String(body.password ?? "");
      const language = body.preferred_language === "en" ? "en" : "gu";
      if (!EMAIL.test(email) || email.length > 160) return json({ error: "Enter a valid email address." }, 400);
      if (displayName.length < 2 || displayName.length > 120) return json({ error: "Enter a name between 2 and 120 characters." }, 400);
      if (phone.length > 30) return json({ error: "Phone number is too long." }, 400);
      if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !created?.user) return json({ error: "Could not create this admin login. The email may already be in use." }, 400);
      const userId: string = created.user.id;
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId, display_name: displayName, role: "admin", house_number: null, is_super: false, is_active: true,
        contact_phone: phone || null, preferred_language: language, updated_by: callerId,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: "Could not save the admin profile. The incomplete login was removed; please retry." }, 500);
      }
      await audit("admin_created", userId, { email, display_name: displayName });
      return json({ ok: true, user_id: userId, message: "Admin created. Share the email and temporary password privately; they can change it under My account." });
    }

    const targetId = String(body.user_id ?? "");
    if (!UUID.test(targetId)) return json({ error: "Choose an account first." }, 400);
    const { data: target, error: targetError } = await admin.from("profiles").select("id,role,is_super,is_active,display_name").eq("id", targetId).maybeSingle();
    if (targetError || !target) return json({ error: "Account not found." }, 404);

    if (action === "set_active") {
      const active = body.active === true;
      if (target.id === callerId) return json({ error: "You cannot change your own account status." }, 400);
      if (target.role !== "admin") return json({ error: "Only admin accounts are managed here. House logins are managed under Manage houses." }, 400);
      if (target.is_super) return json({ error: "Remove super-admin status first, then deactivate." }, 400);
      if (active) {
        // unblock sign-in first, then restore admin power
        const { error: unbanError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
        if (unbanError) return json({ error: "Could not re-enable this login." }, 500);
        const { error } = await admin.from("profiles").update({ is_active: true, updated_by: callerId, updated_at: new Date().toISOString() }).eq("id", targetId);
        if (error) return json({ error: "Could not reactivate the account." }, 500);
      } else {
        // remove admin power first (instant), then block sign-in
        const { error } = await admin.from("profiles").update({ is_active: false, updated_by: callerId, updated_at: new Date().toISOString() }).eq("id", targetId);
        if (error) return json({ error: "Could not deactivate the account." }, 500);
        const { error: banError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: FOREVER });
        if (banError) return json({ error: "The account lost its admin access, but sign-in could not be blocked. Please retry." }, 500);
      }
      await audit(active ? "admin_reactivated" : "admin_deactivated", targetId, { display_name: target.display_name });
      return json({ ok: true, message: active ? "Admin reactivated." : "Admin deactivated. They can no longer sign in or manage anything." });
    }

    if (action === "set_super") {
      const makeSuper = body.is_super === true;
      if (target.id === callerId) return json({ error: "You cannot change your own super-admin status." }, 400);
      if (target.role !== "admin") return json({ error: "Only admin accounts can be super admins." }, 400);
      if (makeSuper && target.is_active === false) return json({ error: "Reactivate this admin first." }, 400);
      const { error } = await admin.from("profiles").update({ is_super: makeSuper, updated_by: callerId, updated_at: new Date().toISOString() }).eq("id", targetId);
      if (error) return json({ error: "Could not update super-admin status." }, 500);
      await audit(makeSuper ? "super_admin_granted" : "super_admin_removed", targetId, { display_name: target.display_name });
      return json({ ok: true, message: makeSuper ? "This admin is now a super admin." : "Super-admin status removed." });
    }

    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);
      if (target.is_super && target.id !== callerId) return json({ error: "A super admin changes their own password under My account." }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return json({ error: "Could not reset the password." }, 400);
      await audit("password_reset", targetId, { display_name: target.display_name });
      return json({ ok: true, message: "Password reset. Share it privately; they can change it under My account." });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("manage-admins failed", error);
    return json({ error: "Request could not be processed." }, 400);
  }
});

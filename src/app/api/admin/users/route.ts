import { NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, role, created_at");
  const { data: subs } = await supabaseAdmin.from("subscriptions").select("user_id, status, plan, current_period_end");

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const subMap = Object.fromEntries((subs ?? []).map((s) => [s.user_id, s]));

  const users = (authUsers?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: profileMap[u.id]?.full_name ?? null,
    role: profileMap[u.id]?.role ?? "user",
    created_at: u.created_at,
    confirmed: !!u.email_confirmed_at,
    subscription: subMap[u.id] ?? null,
  }));

  return NextResponse.json({ users });
}

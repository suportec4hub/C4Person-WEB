import { NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const [usersRes, subsRes, profilesRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers(),
    supabaseAdmin.from("subscriptions").select("status, created_at"),
    supabaseAdmin.from("profiles").select("created_at"),
  ]);

  const totalUsers = usersRes.data?.users?.length ?? 0;
  const allSubs = subsRes.data ?? [];
  const activeSubs = allSubs.filter((s) => s.status === "active").length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newThisMonth = (usersRes.data?.users ?? []).filter(
    (u) => u.created_at > thirtyDaysAgo
  ).length;

  return NextResponse.json({ totalUsers, activeSubs, newThisMonth, totalSubs: allSubs.length });
}

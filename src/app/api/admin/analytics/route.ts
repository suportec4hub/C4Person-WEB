export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const twoMinAgo  = new Date(now.getTime() - 2 * 60 * 1000);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 13); fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [presenceRes, viewsTodayRes, viewsWeekRes, topPagesRes, hourlyRes, dailyRes, userActivityRes] = await Promise.all([
    // Online now (last 2 min)
    supabaseAdmin
      .from("user_presence")
      .select("user_id, current_page, last_seen")
      .gte("last_seen", twoMinAgo.toISOString()),

    // Active users today (distinct)
    supabaseAdmin
      .from("page_views")
      .select("user_id")
      .gte("created_at", todayStart.toISOString()),

    // Active users this week (distinct)
    supabaseAdmin
      .from("page_views")
      .select("user_id")
      .gte("created_at", weekStart.toISOString()),

    // Top 6 pages today
    supabaseAdmin
      .from("page_views")
      .select("page")
      .gte("created_at", todayStart.toISOString()),

    // Hourly views today (all rows, group client-side)
    supabaseAdmin
      .from("page_views")
      .select("created_at")
      .gte("created_at", todayStart.toISOString()),

    // Daily active users — last 14 days (all rows, group client-side)
    supabaseAdmin
      .from("page_views")
      .select("user_id, created_at")
      .gte("created_at", fourteenDaysAgo.toISOString()),

    // Per-user activity — for marketing table
    supabaseAdmin
      .from("page_views")
      .select("user_id, page, created_at")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // ── Process online now ────────────────────────────────────────────────────
  const onlineNow = presenceRes.data?.length ?? 0;
  const onlinePages = (presenceRes.data ?? []).map(r => r.current_page).filter(Boolean);

  // ── Active users (distinct) ───────────────────────────────────────────────
  const activeToday    = new Set((viewsTodayRes.data ?? []).map(r => r.user_id)).size;
  const activeThisWeek = new Set((viewsWeekRes.data ?? []).map(r => r.user_id)).size;
  const pageViewsToday = viewsTodayRes.data?.length ?? 0;

  // ── Top pages today ───────────────────────────────────────────────────────
  const pageCounts: Record<string, number> = {};
  for (const row of topPagesRes.data ?? []) {
    pageCounts[row.page] = (pageCounts[row.page] ?? 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([page, count]) => ({ page, count }));

  // ── Hourly activity today (0–23) ─────────────────────────────────────────
  const hourlyCounts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const row of hourlyRes.data ?? []) {
    const h = new Date(row.created_at).getHours();
    hourlyCounts[h].count++;
  }

  // ── Daily active users (last 14 days) ────────────────────────────────────
  const dailyMap: Record<string, Set<string>> = {};
  for (const row of dailyRes.data ?? []) {
    const d = row.created_at.slice(0, 10); // "YYYY-MM-DD"
    if (!dailyMap[d]) dailyMap[d] = new Set();
    dailyMap[d].add(row.user_id);
  }
  const dailyLast14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(fourteenDaysAgo); d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: dailyMap[key]?.size ?? 0 };
  });

  // ── Per-user activity table ───────────────────────────────────────────────
  const userMap: Record<string, { views: number; pages: Set<string>; lastSeen: string }> = {};
  for (const row of userActivityRes.data ?? []) {
    if (!userMap[row.user_id]) {
      userMap[row.user_id] = { views: 0, pages: new Set(), lastSeen: row.created_at };
    }
    userMap[row.user_id].views++;
    userMap[row.user_id].pages.add(row.page);
    if (row.created_at > userMap[row.user_id].lastSeen) {
      userMap[row.user_id].lastSeen = row.created_at;
    }
  }

  // Enrich with email from profiles
  const userIds = Object.keys(userMap);
  let profilesMap: Record<string, { email?: string; name?: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profilesMap[p.id] = { email: p.email, name: p.name };
    }
    // Fallback: get emails from auth.users for any missing
    const missing = userIds.filter(id => !profilesMap[id]?.email);
    if (missing.length > 0) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      for (const u of authUsers?.users ?? []) {
        if (missing.includes(u.id)) {
          profilesMap[u.id] = { ...profilesMap[u.id], email: u.email };
        }
      }
    }
  }

  const userActivity = Object.entries(userMap)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 30)
    .map(([userId, data]) => ({
      userId,
      email: profilesMap[userId]?.email ?? userId.slice(0, 8) + "…",
      name:  profilesMap[userId]?.name  ?? null,
      views: data.views,
      uniquePages: data.pages.size,
      lastSeen: data.lastSeen,
    }));

  return NextResponse.json({
    onlineNow,
    onlinePages,
    activeToday,
    activeThisWeek,
    pageViewsToday,
    topPages,
    hourlyCounts,
    dailyLast14,
    userActivity,
  });
}

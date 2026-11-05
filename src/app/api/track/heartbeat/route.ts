export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[Track] Auth failed:", authError?.message ?? "no user");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let page = "/C4Person";
  let isNavigation = false;
  let sessionId: string | undefined;
  let timeOnPage: number | undefined;
  let scrollDepth: number | undefined;
  try {
    const body = await req.json();
    page        = (body?.page      ?? "/C4Person").slice(0, 200);
    isNavigation = !!body?.isNavigation;
    sessionId   = body?.sessionId;
    timeOnPage  = typeof body?.timeOnPage === "number" ? Math.round(body.timeOnPage) : undefined;
    scrollDepth = typeof body?.scrollDepth === "number" ? Math.min(100, Math.round(body.scrollDepth)) : undefined;
  } catch { /* ignore parse errors */ }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Upsert presence
  const { error: presenceErr } = await supabaseAdmin.from("user_presence").upsert(
    { user_id: user.id, last_seen: new Date().toISOString(), current_page: page, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (presenceErr) console.error("[Track] Presence upsert error:", presenceErr.message, presenceErr.code);

  // Log page view on navigation events
  if (isNavigation) {
    const { error: viewErr } = await supabaseAdmin.from("page_views").insert({
      user_id: user.id,
      page,
      session_id: sessionId ?? null,
      scroll_depth: scrollDepth ?? null,
    });
    if (viewErr) console.error("[Track] Page view insert error:", viewErr.message, viewErr.code);
  }

  // Update time_on_page for the previous page view in this session
  if (sessionId && timeOnPage != null && !isNavigation) {
    await supabaseAdmin
      .from("page_views")
      .update({ time_on_page: timeOnPage })
      .eq("session_id", sessionId)
      .eq("page", page)
      .is("time_on_page", null)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  return NextResponse.json({ ok: true });
}

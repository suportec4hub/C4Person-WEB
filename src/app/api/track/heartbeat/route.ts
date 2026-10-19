export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let page = "/C4Person";
  let isNavigation = false;
  try {
    const body = await req.json();
    page = (body?.page ?? "/C4Person").slice(0, 200);
    isNavigation = !!body?.isNavigation;
  } catch { /* ignore */ }

  // Upsert presence — keeps "online now" accurate
  await supabaseAdmin.from("user_presence").upsert(
    { user_id: user.id, last_seen: new Date().toISOString(), current_page: page, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  // Log page view only on actual navigation (not every heartbeat tick)
  if (isNavigation) {
    await supabaseAdmin.from("page_views").insert({ user_id: user.id, page });
  }

  return NextResponse.json({ ok: true });
}

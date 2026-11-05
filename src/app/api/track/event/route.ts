export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  let session_id: string, event: string, page: string | undefined, metadata: Record<string, unknown> | undefined;

  try {
    const body = await req.json();
    session_id = (body?.session_id ?? "").slice(0, 100);
    event      = (body?.event      ?? "").slice(0, 50);
    page       = body?.page ? String(body.page).slice(0, 200) : undefined;
    metadata   = body?.metadata ?? undefined;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!session_id || !event) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin.from("funnel_events").insert({
    session_id,
    event,
    page,
    metadata: metadata ?? null,
  });

  if (error) console.error("[Track/Event]", error.message);

  return NextResponse.json({ ok: !error });
}

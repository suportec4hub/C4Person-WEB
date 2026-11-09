export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function makeClients(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return { supabase, admin };
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const { supabase } = makeClients(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end   = searchParams.get("end");

  let query = supabase.from("calendar_events").select("*").eq("user_id", user.id);
  if (start) query = query.gte("event_date", start);
  if (end)   query = query.lte("event_date", end);
  query = query.order("event_date", { ascending: true }).order("start_time", { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const { supabase, admin } = makeClients(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    title: string; description?: string; type: string;
    event_date: string; start_time?: string; end_time?: string;
    all_day?: boolean; remind_min?: number; color?: string;
    sync_google?: boolean;
  };

  if (!body.title || !body.event_date) {
    return NextResponse.json({ error: "title and event_date required" }, { status: 400 });
  }

  let google_event_id: string | null = null;

  // Optionally create event in Google Calendar
  if (body.sync_google && body.start_time) {
    try {
      const { data: integration } = await admin
        .from("calendar_integrations")
        .select("access_token, expires_at, refresh_token")
        .eq("user_id", user.id).eq("provider", "google").single();

      if (integration?.access_token) {
        let token = integration.access_token;
        // Auto-refresh if needed
        if (integration.expires_at && new Date(integration.expires_at).getTime() < Date.now() + 5 * 60_000 && integration.refresh_token) {
          const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: integration.refresh_token, grant_type: "refresh_token" }),
          });
          if (r.ok) {
            const rd = await r.json() as { access_token: string; expires_in: number };
            token = rd.access_token;
            await admin.from("calendar_integrations").update({ access_token: token, expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("provider", "google");
          }
        }
        const startDT = `${body.event_date}T${body.start_time}:00`;
        const endDT   = body.end_time ? `${body.event_date}T${body.end_time}:00` : `${body.event_date}T${body.start_time}:00`;
        const gPayload = {
          summary: body.title, description: body.description ?? "",
          start: { dateTime: startDT, timeZone: "America/Sao_Paulo" },
          end:   { dateTime: endDT,   timeZone: "America/Sao_Paulo" },
        };
        const gr = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(gPayload),
        });
        if (gr.ok) {
          const gd = await gr.json() as { id: string };
          google_event_id = gd.id;
        }
      }
    } catch (err) {
      console.error("[CalEvents POST] Google sync error:", err);
    }
  }

  const { data, error } = await supabase.from("calendar_events").insert([{
    user_id: user.id,
    title:       body.title,
    description: body.description ?? null,
    type:        body.type ?? "task",
    event_date:  body.event_date,
    start_time:  body.start_time ?? null,
    end_time:    body.end_time   ?? null,
    all_day:     body.all_day    ?? false,
    remind_min:  body.remind_min ?? null,
    color:       body.color ?? "#8B5CF6",
    google_event_id,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const { supabase } = makeClients(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { id: string; [key: string]: unknown };
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase.from("calendar_events")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const { supabase } = makeClients(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

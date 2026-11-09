export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  provider: "google" | "microsoft";
  color: string;
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    return { access_token: data.access_token, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString() };
  } catch { return null; }
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
        scope:         "Calendars.Read User.Read offline_access",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    return { access_token: data.access_token, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString() };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start") ?? new Date().toISOString();
  const end   = searchParams.get("end")   ?? new Date(Date.now() + 7 * 86400000).toISOString();

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: integrations } = await supabaseAdmin
    .from("calendar_integrations")
    .select("*")
    .eq("user_id", user.id);

  const events: CalEvent[] = [];

  for (const integration of integrations ?? []) {
    let { access_token, refresh_token, expires_at, provider } = integration;

    // Refresh token if expired (with 5-min buffer)
    if (expires_at && new Date(expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
      if (refresh_token) {
        const refreshed = provider === "google"
          ? await refreshGoogleToken(refresh_token)
          : await refreshMicrosoftToken(refresh_token);
        if (refreshed) {
          access_token = refreshed.access_token;
          await supabaseAdmin.from("calendar_integrations").update({ access_token, expires_at: refreshed.expires_at, updated_at: new Date().toISOString() }).eq("id", integration.id);
        }
      }
    }

    try {
      if (provider === "google") {
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=50`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
        if (res.ok) {
          const data = await res.json() as { items?: Array<{ id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }> };
          for (const item of data.items ?? []) {
            const isAllDay = !item.start.dateTime;
            events.push({
              id: `google_${item.id}`,
              title: item.summary ?? "(sem título)",
              start: item.start.dateTime ?? item.start.date ?? start,
              end:   item.end.dateTime   ?? item.end.date   ?? end,
              allDay: isAllDay,
              provider: "google",
              color: "#4285F4",
            });
          }
        }
      } else if (provider === "microsoft") {
        const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$select=id,subject,start,end,isAllDay&$top=50`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
        if (res.ok) {
          const data = await res.json() as { value?: Array<{ id: string; subject?: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string }; isAllDay?: boolean }> };
          for (const item of data.value ?? []) {
            events.push({
              id: `microsoft_${item.id}`,
              title: item.subject ?? "(sem título)",
              start: new Date(item.start.dateTime + "Z").toISOString(),
              end:   new Date(item.end.dateTime   + "Z").toISOString(),
              allDay: item.isAllDay ?? false,
              provider: "microsoft",
              color: "#0078D4",
            });
          }
        }
      }
    } catch (err) {
      console.error(`[CalEvents] ${provider} fetch error:`, err);
    }
  }

  return NextResponse.json({ events });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=google_denied`);
  }

  const storedState = req.cookies.get("oauth_state")?.value;
  const userId      = req.cookies.get("oauth_user_id")?.value;

  if (!storedState || storedState !== state || !userId) {
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=invalid_state`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = `${appUrl}/api/integrations/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });

  if (!tokenRes.ok) {
    console.error("[Google OAuth] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=google_token`);
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number };

  // Get connected email
  let email = "";
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json() as { email?: string };
    email = info.email ?? "";
  } catch {}

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await supabaseAdmin.from("calendar_integrations").upsert(
    { user_id: userId, provider: "google", access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? null, expires_at: expiresAt, email, updated_at: new Date().toISOString() },
    { onConflict: "user_id,provider" }
  );

  const res = NextResponse.redirect(`${appUrl}/C4Person/calendar?connected=google`);
  res.cookies.delete("oauth_state");
  res.cookies.delete("oauth_user_id");
  return res;
}

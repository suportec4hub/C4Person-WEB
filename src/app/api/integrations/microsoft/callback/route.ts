import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=microsoft_denied`);
  }

  const storedState = req.cookies.get("oauth_state")?.value;
  const userId      = req.cookies.get("oauth_user_id")?.value;

  if (!storedState || storedState !== state || !userId) {
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=invalid_state`);
  }

  const clientId     = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const redirectUri  = `${appUrl}/api/integrations/microsoft/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", scope: "Calendars.Read User.Read offline_access" }),
  });

  if (!tokenRes.ok) {
    console.error("[Microsoft OAuth] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/C4Person/calendar?error=microsoft_token`);
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number };

  // Get connected email
  let email = "";
  try {
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json() as { mail?: string; userPrincipalName?: string };
    email = me.mail ?? me.userPrincipalName ?? "";
  } catch {}

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await supabaseAdmin.from("calendar_integrations").upsert(
    { user_id: userId, provider: "microsoft", access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? null, expires_at: expiresAt, email, updated_at: new Date().toISOString() },
    { onConflict: "user_id,provider" }
  );

  const res = NextResponse.redirect(`${appUrl}/C4Person/calendar?connected=microsoft`);
  res.cookies.delete("oauth_state");
  res.cookies.delete("oauth_user_id");
  return res;
}

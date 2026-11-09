import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (!clientId) {
    return NextResponse.json({ error: "MICROSOFT_CLIENT_ID não configurado" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${appUrl}/api/integrations/microsoft/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "Calendars.Read User.Read offline_access",
    response_mode: "query",
    state,
  });

  const res = NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
  res.cookies.set("oauth_state", state, { httpOnly: true, secure: true, maxAge: 300, path: "/" });
  res.cookies.set("oauth_user_id", user.id, { httpOnly: true, secure: true, maxAge: 300, path: "/" });
  return res;
}

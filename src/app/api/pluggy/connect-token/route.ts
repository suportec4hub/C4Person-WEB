export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { PluggyClient } from "pluggy-sdk";

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reconnectItemId = (body?.itemId as string) || undefined;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Fetch user's own Pluggy credentials
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("pluggy_client_id, pluggy_client_secret")
    .eq("id", user.id)
    .single();

  const clientId = profile?.pluggy_client_id ?? process.env.PLUGGY_CLIENT_ID;
  const clientSecret = profile?.pluggy_client_secret ?? process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Configure suas credenciais Pluggy em Configurações → Dívidas" },
      { status: 400 }
    );
  }

  try {
    const pluggy = new PluggyClient({ clientId, clientSecret });
    // If reconnectItemId is provided, PluggyConnect will pre-fill the connector
    // for re-authentication of that specific expired item.
    const token = await pluggy.createConnectToken(undefined, {
      clientUserId: user.id,
      ...(reconnectItemId ? { itemId: reconnectItemId } : {}),
    } as any);
    return NextResponse.json({ accessToken: token.accessToken });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro ao gerar token Pluggy" }, { status: 500 });
  }
}

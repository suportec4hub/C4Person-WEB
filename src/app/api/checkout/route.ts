import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const API = "https://api.abacatepay.com/v1";

// Link de pagamento criado no dashboard do AbacatePay
const CHECKOUT_URL = "https://app.abacatepay.com/pay/bill_S54ZPCfzmMqTHjCJuqRuTZ2m";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function tryEnsureCustomer(email: string, name?: string): Promise<string | null> {
  try {
    const listRes = await fetch(`${API}/customers/list`, {
      headers: { Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}` },
    });
    const listText = await listRes.text();
    console.log(`[AbacatePay] GET /customers/list → ${listRes.status}: ${listText.slice(0, 300)}`);

    if (listRes.ok) {
      const list = JSON.parse(listText);
      const customers = Array.isArray(list.data) ? list.data : [];
      const found = customers.find(
        (c: { email?: string; id?: string }) => c.email === email
      );
      if (found?.id) return found.id;
    }

    // Cria cliente
    const createRes = await fetch(`${API}/customers/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, name }),
    });
    const createText = await createRes.text();
    console.log(`[AbacatePay] POST /customers/create → ${createRes.status}: ${createText.slice(0, 300)}`);

    const created = JSON.parse(createText);
    const id = (created.data as { id?: string } | null)?.id;
    return id ?? null;
  } catch (err) {
    console.error("[AbacatePay] tryEnsureCustomer falhou (non-blocking):", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Tenta criar/encontrar cliente no AbacatePay (não bloqueia se falhar)
    const customerId = await tryEnsureCustomer(
      user.email!,
      profile?.full_name ?? undefined
    );

    // Persiste o mapeamento para o webhook usar no lookup
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (existingSub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          ...(customerId ? { abacatepay_customer_id: customerId } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: user.id,
        ...(customerId ? { abacatepay_customer_id: customerId } : {}),
        status: "pending",
        plan: "pro",
        updated_at: new Date().toISOString(),
      });
    }

    console.log(
      `[Checkout] user=${user.id} email=${user.email} customer=${customerId ?? "n/a"} → ${CHECKOUT_URL}`
    );

    // Sempre retorna a URL — o mapeamento customer é best-effort
    return NextResponse.json({ url: CHECKOUT_URL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Checkout] Erro crítico:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

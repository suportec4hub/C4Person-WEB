import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const API = "https://api.abacatepay.com/v1";

// URL do link de pagamento criado no dashboard do AbacatePay
const CHECKOUT_URL = "https://app.abacatepay.com/pay/bill_S54ZPCfzmMqTHjCJuqRuTZ2m";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AbacateResponse {
  data?: Record<string, unknown> | null;
  error?: string;
  [key: string]: unknown;
}

async function abacate(path: string, body?: object): Promise<AbacateResponse> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  const text = await res.text();
  console.log(`[AbacatePay] ${body ? "POST" : "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);

  try {
    return JSON.parse(text) as AbacateResponse;
  } catch {
    console.error(`[AbacatePay] Non-JSON response (${res.status}):`, text.slice(0, 500));
    throw new Error(`AbacatePay ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function ensureCustomer(email: string, name?: string): Promise<string> {
  const list = await abacate("/customers/list");
  const customers = Array.isArray(list.data) ? list.data : [];
  const found = customers.find((c: unknown) => {
    return (c as { email?: string }).email === email;
  });
  if (found) return (found as { id: string }).id;

  const created = await abacate("/customers/create", { email, name });
  const createdData = created.data as { id?: string } | null;
  if (!createdData?.id) {
    console.error("[AbacatePay] Customer create returned no id:", created);
    throw new Error(created.error ?? "Falha ao criar cliente no AbacatePay");
  }
  return createdData.id;
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Garante que o cliente existe no AbacatePay e obtém o ID
    // Isso permite que o webhook encontre o usuário pelo customerId
    const customerId = await ensureCustomer(
      user.email!,
      profile?.full_name ?? undefined
    );

    // Persiste o mapeamento customerId ↔ userId para o webhook usar como fallback
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (existingSub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          abacatepay_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: user.id,
        abacatepay_customer_id: customerId,
        status: "pending",
        plan: "pro",
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`[Checkout] Usuário ${user.id} → customer ${customerId} → redirect para checkout`);

    return NextResponse.json({ url: CHECKOUT_URL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Checkout] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

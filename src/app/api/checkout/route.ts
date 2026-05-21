import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const API = "https://api.abacatepay.com/v1";
const PRODUCT_EXTERNAL_ID = "c4person-pro";
const PLAN_PRICE = 2990; // R$29,90 — ajuste conforme necessário

async function abacate(path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

async function ensureProduct(): Promise<string> {
  const list = await abacate("/products/list");
  const found = list.data?.find((p: { externalId: string; id: string }) => p.externalId === PRODUCT_EXTERNAL_ID);
  if (found) return found.id;

  const created = await abacate("/products/create", {
    externalId: PRODUCT_EXTERNAL_ID,
    name: "C4 Person Pro",
    price: PLAN_PRICE,
    description: "Acesso completo ao C4 Person — Dashboard pessoal com IA",
    cycle: "MONTHLY",
  });
  return created.data.id;
}

async function ensureCustomer(email: string): Promise<string> {
  const list = await abacate("/customers/list");
  const found = list.data?.find((c: { email: string; id: string }) => c.email === email);
  if (found) return found.id;

  const created = await abacate("/customers/create", { email });
  return created.data.id;
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
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const [productId, customerId] = await Promise.all([
      ensureProduct(),
      ensureCustomer(user.email!),
    ]);

    const checkout = await abacate("/subscriptions/create", {
      items: [{ id: productId, quantity: 1 }],
      methods: ["CARD", "PIX"],
      customerId,
      externalId: `sub_${user.id}`,
      returnUrl: `${appUrl}/C4Person`,
      completionUrl: `${appUrl}/C4Person?payment=success`,
      metadata: { userId: user.id, email: user.email },
    });

    if (!checkout.data?.url) {
      console.error("AbacatePay error:", checkout);
      return NextResponse.json({ error: checkout.error || "Erro ao criar checkout" }, { status: 500 });
    }

    return NextResponse.json({ url: checkout.data.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

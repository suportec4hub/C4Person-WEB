import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const API = "https://api.abacatepay.com/v1";
const BILLING_ID = "bill_KaUC2TeCLALmSKqTXmZgQUR6";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function ensureCustomer(email: string, name?: string): Promise<string> {
  const list = await abacate("/customers/list");
  const found = list.data?.find((c: { email: string; id: string }) => c.email === email);
  if (found) return found.id;

  const created = await abacate("/customers/create", { email, name });
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const customerId = await ensureCustomer(user.email!, profile?.full_name ?? undefined);

    // Store customer_id → user_id mapping for webhook fallback lookup
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (existingSub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ abacatepay_customer_id: customerId, updated_at: new Date().toISOString() })
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

    // Fetch billing link URL
    const billing = await abacate(`/billing/${BILLING_ID}`);
    const url = billing.data?.url;

    if (!url) {
      console.error("AbacatePay billing link error:", billing);
      return NextResponse.json({ error: billing.error || "Erro ao obter link de pagamento" }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

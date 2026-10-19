export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Use sandbox URL for testing: https://sandbox.asaas.com/api/v3
const ASAAS_API = process.env.ASAAS_API_URL ?? "https://api.asaas.com/v3";
const PLAN_VALUE = 15.90;

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

function asaasHeaders() {
  return {
    access_token: process.env.ASAAS_API_KEY!,
    "Content-Type": "application/json",
    "User-Agent": "C4Person/1.0",
  };
}

async function findOrCreateCustomer(email: string, name: string, userId: string): Promise<{ id: string } | { error: string }> {
  try {
    // Search by email first
    const searchRes = await fetch(
      `${ASAAS_API}/customers?email=${encodeURIComponent(email)}&limit=1`,
      { headers: asaasHeaders() }
    );
    const searchText = await searchRes.text();
    console.log(`[ASAAS] GET /customers → ${searchRes.status}: ${searchText.slice(0, 400)}`);

    if (!searchRes.ok) {
      return { error: `ASAAS ${searchRes.status}: ${searchText.slice(0, 200)}` };
    }

    const searchData = JSON.parse(searchText);
    const existing = searchData.data?.[0];
    if (existing?.id) {
      console.log(`[ASAAS] Customer found: ${existing.id}`);
      return { id: existing.id };
    }

    // Create new customer
    const createRes = await fetch(`${ASAAS_API}/customers`, {
      method: "POST",
      headers: asaasHeaders(),
      body: JSON.stringify({ name, email, externalReference: userId }),
    });
    const createText = await createRes.text();
    console.log(`[ASAAS] POST /customers → ${createRes.status}: ${createText.slice(0, 400)}`);

    if (!createRes.ok) {
      return { error: `ASAAS ${createRes.status}: ${createText.slice(0, 200)}` };
    }

    const customer = JSON.parse(createText);
    if (customer.id) {
      console.log(`[ASAAS] Customer created: ${customer.id}`);
      return { id: customer.id };
    }
    return { error: `ASAAS retornou sem id: ${createText.slice(0, 200)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ASAAS] findOrCreateCustomer error:", msg);
    return { error: msg };
  }
}

async function createSubscriptionAndGetPaymentUrl(customerId: string, userId: string): Promise<string | null> {
  try {
    // nextDueDate: tomorrow in YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 86_400_000);
    const nextDueDate = tomorrow.toISOString().split("T")[0];

    const subRes = await fetch(`${ASAAS_API}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED", // user chooses PIX/boleto/credit card on payment page
        value: PLAN_VALUE,
        nextDueDate,
        cycle: "MONTHLY",
        description: "C4Person Pro — Acesso completo",
        externalReference: userId,
      }),
    });
    const sub = await subRes.json();
    if (!sub.id) {
      console.error("[ASAAS] Subscription creation failed:", JSON.stringify(sub).slice(0, 300));
      return null;
    }
    console.log(`[ASAAS] Subscription created: ${sub.id}`);

    // Get first payment to obtain the invoiceUrl
    const paymentsRes = await fetch(
      `${ASAAS_API}/payments?subscription=${sub.id}&limit=1`,
      { headers: asaasHeaders() }
    );
    const payments = await paymentsRes.json();
    const invoiceUrl: string | undefined = payments.data?.[0]?.invoiceUrl;
    if (invoiceUrl) {
      console.log(`[ASAAS] Invoice URL: ${invoiceUrl}`);
      return invoiceUrl;
    }

    console.error("[ASAAS] No invoice URL in payments:", JSON.stringify(payments).slice(0, 300));
    return null;
  } catch (err) {
    console.error("[ASAAS] createSubscriptionAndGetPaymentUrl error:", err);
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

    const name = profile?.full_name ?? user.email ?? "Cliente";

    const customerResult = await findOrCreateCustomer(user.email!, name, user.id);

    if ("error" in customerResult) {
      console.error("[Checkout] ASAAS customer error:", customerResult.error);
      return NextResponse.json(
        { error: `Erro ao criar cliente no ASAAS: ${customerResult.error}` },
        { status: 502 }
      );
    }

    const customerId = customerResult.id;

    // Upsert subscription row as pending (webhook will activate it)
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        status: "pending",
        plan: "pro",
        abacatepay_customer_id: customerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    const paymentUrl = await createSubscriptionAndGetPaymentUrl(customerId, user.id);
    if (!paymentUrl) {
      return NextResponse.json(
        { error: "Não foi possível gerar o link de pagamento. Tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: paymentUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Checkout] Erro crítico:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

async function findOrCreateCustomer(
  email: string, name: string, userId: string, cpfCnpj?: string
): Promise<{ id: string } | { error: string }> {
  try {
    // Search existing customer by email
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
      // Update CPF if missing on existing customer
      if (cpfCnpj && !existing.cpfCnpj) {
        await fetch(`${ASAAS_API}/customers/${existing.id}`, {
          method: "PUT",
          headers: asaasHeaders(),
          body: JSON.stringify({ cpfCnpj }),
        });
        console.log(`[ASAAS] Customer ${existing.id} updated with CPF`);
      }
      return { id: existing.id };
    }

    // Create new customer with CPF
    const createRes = await fetch(`${ASAAS_API}/customers`, {
      method: "POST",
      headers: asaasHeaders(),
      body: JSON.stringify({ name, email, externalReference: userId, ...(cpfCnpj ? { cpfCnpj } : {}) }),
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

async function createChargeAndGetPaymentUrl(customerId: string, userId: string): Promise<{ url: string } | { error: string }> {
  try {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const dueDate = tomorrow.toISOString().split("T")[0];

    const res = await fetch(`${ASAAS_API}/payments`, {
      method: "POST",
      headers: asaasHeaders(),
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: PLAN_VALUE,
        dueDate,
        description: "C4Person Pro — Assinatura mensal",
        externalReference: userId,
      }),
    });
    const text = await res.text();
    console.log(`[ASAAS] POST /payments → ${res.status}: ${text.slice(0, 600)}`);

    if (!res.ok) {
      return { error: `ASAAS ${res.status}: ${text.slice(0, 300)}` };
    }

    const payment = JSON.parse(text);
    // ASAAS can return invoiceUrl directly or need it fetched
    const invoiceUrl: string | undefined = payment.invoiceUrl ?? payment.bankSlipUrl ?? payment.paymentLink;
    if (invoiceUrl) {
      console.log(`[ASAAS] Payment URL: ${invoiceUrl}`);
      return { url: invoiceUrl };
    }

    return { error: `ASAAS retornou sem URL de pagamento. Response: ${text.slice(0, 300)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ASAAS] createChargeAndGetPaymentUrl error:", msg);
    return { error: msg };
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
      .select("full_name, cpf")
      .eq("id", user.id)
      .single();

    const name = profile?.full_name ?? user.email ?? "Cliente";
    const cpf = profile?.cpf as string | undefined;

    const customerResult = await findOrCreateCustomer(user.email!, name, user.id, cpf);

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

    const chargeResult = await createChargeAndGetPaymentUrl(customerId, user.id);
    if ("error" in chargeResult) {
      console.error("[Checkout] Charge error:", chargeResult.error);
      return NextResponse.json({ error: chargeResult.error }, { status: 502 });
    }

    return NextResponse.json({ url: chargeResult.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Checkout] Erro crítico:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

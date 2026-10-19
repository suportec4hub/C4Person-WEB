export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

function verifyToken(req: NextRequest): boolean {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token) return true; // token not configured — allow (dev/test mode)
  const received = req.headers.get("asaas-access-token") ?? "";
  return received === token;
}

async function resolveUserId(
  externalReference?: string,
  customerId?: string,
  email?: string
): Promise<string | undefined> {
  // 1. externalReference is set to userId when creating the subscription
  if (externalReference) return externalReference;

  // 2. Look up by ASAAS customer ID stored in subscriptions table
  if (customerId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("abacatepay_customer_id", customerId)
      .single();
    if (data?.user_id) return data.user_id;
  }

  // 3. Look up by email in Supabase Auth
  if (email) {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const match = authData?.users?.find((u) => u.email === email);
    if (match) return match.id;
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    console.error("[ASAAS Webhook] Token inválido");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  console.log(`[ASAAS Webhook] Evento: ${event}`);
  console.log(`[ASAAS Webhook] Payload: ${JSON.stringify(body).slice(0, 600)}`);

  if (!event) {
    return NextResponse.json({ received: true, warning: "No event field" });
  }

  // Payment events carry a "payment" object; subscription events carry "subscription"
  const payment = body.payment as Record<string, unknown> | undefined;
  const subscription = body.subscription as Record<string, unknown> | undefined;

  const obj = payment ?? subscription ?? {};
  const externalReference = obj.externalReference as string | undefined;
  const customerId = obj.customer as string | undefined;
  const customerEmail = (obj as Record<string, unknown>).customerEmail as string | undefined;

  const userId = await resolveUserId(externalReference, customerId, customerEmail);

  if (!userId) {
    console.warn(`[ASAAS Webhook] userId não encontrado para ${event}. Payload: ${JSON.stringify(obj).slice(0, 300)}`);
    return NextResponse.json({ received: true, warning: "userId not found" });
  }

  switch (event) {
    // Payment confirmed (credit card) or received (PIX/boleto)
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          status: "active",
          plan: "pro",
          current_period_end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
          ...(customerId ? { abacatepay_customer_id: customerId } : {}),
          ...(payment?.id ? { abacatepay_checkout_id: payment.id as string } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      console.log(`[ASAAS Webhook] ✅ Assinatura ativada — userId=${userId}`);
      break;
    }

    // Subscription cancelled, inactivated or deleted
    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED":
    case "PAYMENT_DELETED":
    case "PAYMENT_OVERDUE": {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      console.log(`[ASAAS Webhook] ❌ Assinatura desativada — userId=${userId} evento=${event}`);
      break;
    }

    default:
      console.log(`[ASAAS Webhook] Evento ignorado: ${event}`);
  }

  return NextResponse.json({ received: true });
}

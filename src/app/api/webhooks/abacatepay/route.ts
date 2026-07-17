export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hmac, "hex"),
    Buffer.from(signature, "hex")
  );
}

/** Extrai o customerId de qualquer formato que o AbacatePay possa enviar */
function extractCustomerId(data: Record<string, unknown>): string | undefined {
  // Formato plano: { customerId: "cust_..." }
  if (typeof data.customerId === "string") return data.customerId;
  // Formato aninhado: { customer: { id: "cust_..." } }
  if (data.customer && typeof (data.customer as Record<string, unknown>).id === "string") {
    return (data.customer as Record<string, unknown>).id as string;
  }
  // customer_id com underscore
  if (typeof data.customer_id === "string") return data.customer_id;
  return undefined;
}

async function findUserByCustomerId(customerId: string): Promise<string | undefined> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("abacatepay_customer_id", customerId)
    .single();
  return sub?.user_id;
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verifica assinatura HMAC-SHA256 se o secret estiver configurado
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET ?? "";
  if (secret) {
    const signature =
      req.headers.get("x-abacatepay-signature") ||
      req.headers.get("x-webhook-secret") ||
      "";
    if (!signature || !verifySignature(body, signature, secret)) {
      console.error("[Webhook] Assinatura inválida");
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  let event: { event: string; data: Record<string, unknown> } |
             { type: string;  data: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // AbacatePay pode usar "event" ou "type" como campo do tipo
  const type = ("event" in event ? event.event : event.type) ?? "";
  const data = event.data ?? {};

  // Loga o payload completo para facilitar debugging nos logs da Vercel
  console.log(`[Webhook] Evento: ${type}`);
  console.log(`[Webhook] Payload: ${JSON.stringify(data).slice(0, 600)}`);

  // Tenta obter userId via metadata (caso o billing tenha sido criado com metadata)
  let userId = (data?.metadata as Record<string, string> | undefined)?.userId;

  // Fallback 1: busca pelo customerId no banco
  if (!userId) {
    const customerId = extractCustomerId(data);
    if (customerId) {
      userId = await findUserByCustomerId(customerId);
      console.log(`[Webhook] customerId=${customerId} → userId=${userId}`);
    }
  }

  // Fallback 2: busca pelo email do cliente via Supabase Auth
  if (!userId) {
    const customerEmail =
      (data.customer as Record<string, unknown> | undefined)?.email as string | undefined ??
      data.customerEmail as string | undefined ??
      data.email as string | undefined;

    if (customerEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
      const match = authUser?.users?.find(u => u.email === customerEmail);
      if (match) {
        userId = match.id;
        console.log(`[Webhook] email=${customerEmail} → userId=${userId}`);
      }
    }
  }

  if (!userId) {
    console.warn(`[Webhook] userId não encontrado para o evento ${type}. Data: ${JSON.stringify(data).slice(0, 300)}`);
    // Retorna 200 para o AbacatePay não retentar indefinidamente
    return NextResponse.json({ received: true, warning: "userId not found" });
  }

  const customerId = extractCustomerId(data);

  switch (type) {
    // Pagamento confirmado (cobrança avulsa ou assinatura)
    case "billing.paid":
    case "subscription.paid":
    case "subscription.renewed": {
      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
        status: "active",
        plan: "pro",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (customerId) upsertPayload.abacatepay_customer_id = customerId;
      if (data.id) upsertPayload.abacatepay_checkout_id = data.id as string;
      await supabaseAdmin.from("subscriptions").upsert(upsertPayload, { onConflict: "user_id" });
      console.log(`[Webhook] ✅ Assinatura ativada para userId=${userId}`);
      break;
    }

    // Assinatura encerrada
    case "billing.expired":
    case "subscription.cancelled":
    case "subscription.expired": {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      console.log(`[Webhook] ❌ Assinatura desativada para userId=${userId}`);
      break;
    }

    default:
      console.log(`[Webhook] Evento ignorado: ${type}`);
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Admin client — bypassa RLS para atualizar assinaturas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return true; // sem secret configurado, aceita tudo (dev)
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // AbacatePay envia assinatura HMAC-SHA256 no header
  const signature =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-abacatepay-signature") ||
    "";

  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET || "";

  if (secret && !verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { type, data } = event;
  let userId = (data?.metadata as Record<string, string>)?.userId;

  // Fallback: find user by AbacatePay customer ID
  if (!userId && data?.customerId) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("abacatepay_customer_id", data.customerId as string)
      .single();
    userId = sub?.user_id;
  }

  console.log(`[AbacatePay] Evento: ${type} | userId: ${userId}`);

  switch (type) {
    case "billing.paid":
    case "subscription.paid":
    case "subscription.renewed": {
      if (!userId) break;
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          abacatepay_customer_id: data.customerId as string,
          abacatepay_checkout_id: data.id as string,
          status: "active",
          plan: "pro",
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "billing.expired":
    case "subscription.cancelled":
    case "subscription.expired": {
      if (!userId) break;
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

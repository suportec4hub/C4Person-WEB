export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PluggyClient } from "pluggy-sdk";

const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

async function syncDebtsForItem(itemId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, pluggy_client_id, pluggy_client_secret")
    .eq("pluggy_item_id", itemId)
    .single();

  if (!profile) return;

  const clientId = profile.pluggy_client_id ?? process.env.PLUGGY_CLIENT_ID;
  const clientSecret = profile.pluggy_client_secret ?? process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const pluggy = new PluggyClient({ clientId, clientSecret });
  const { results: accounts } = await pluggy.fetchAccounts(itemId);
  const debtAccounts = accounts.filter((a) => DEBT_TYPES.has(a.type));

  for (const acc of debtAccounts) {
    const creditLimit = acc.creditData?.creditLimit ?? null;
    const available = acc.creditData?.availableCreditLimit ?? null;
    const used = creditLimit != null && available != null
      ? creditLimit - available
      : Math.abs(Number(acc.balance ?? 0));
    if (used <= 0) continue;

    const total = creditLimit ?? used;
    const paid = Math.max(0, total - used);

    await supabaseAdmin.from("debts").upsert(
      {
        user_id: profile.id,
        pluggy_account_id: acc.id,
        name: acc.name ?? "Conta importada",
        creditor: null,
        total_amount: total,
        paid_amount: paid,
        status: "active",
        source: "pluggy",
      },
      { onConflict: "user_id,pluggy_account_id" }
    );
  }
}

export async function POST(req: Request) {
  // Must respond 2XX within 5 seconds — always return immediately
  const event = await req.json().catch(() => ({}));

  switch (event.event) {
    case "item/created":
    case "item/updated":
      if (event.itemId) syncDebtsForItem(event.itemId).catch(console.error);
      break;
    case "item/error":
      console.error("Pluggy item error:", event.itemId, event.error);
      break;
    // Pluggy sends a test ping with no specific event — just acknowledge
  }

  return NextResponse.json({ received: true });
}

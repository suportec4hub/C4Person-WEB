export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);
const TX_TYPES   = new Set(["CHECKING", "SAVINGS", "CREDIT_CARD"]);

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

async function fullSyncForItem(itemId: string) {
  if (!supabaseAdmin) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, pluggy_client_id, pluggy_client_secret")
    .eq("pluggy_item_id", itemId)
    .single();

  if (!profile) return;

  const clientId     = profile.pluggy_client_id     ?? process.env.PLUGGY_CLIENT_ID;
  const clientSecret = profile.pluggy_client_secret  ?? process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const { PluggyClient } = await import("pluggy-sdk");
  const pluggy = new PluggyClient({ clientId, clientSecret });
  const { results: accounts } = await pluggy.fetchAccounts(itemId);

  const from = new Date();
  from.setDate(from.getDate() - 7); // last 7 days on webhook updates
  const fromStr = from.toISOString().split("T")[0];

  for (const acc of accounts) {
    // ── Sync account balance ────────────────────────────────────────────────
    await supabaseAdmin.from("bank_accounts").upsert(
      {
        user_id:          profile.id,
        pluggy_account_id: acc.id,
        name:              acc.name ?? "Conta",
        type:              acc.type,
        balance:           Number(acc.balance ?? 0),
        institution_name:  (acc as any).institution?.name ?? null,
        credit_limit:      acc.creditData?.creditLimit     != null ? Number(acc.creditData.creditLimit)            : null,
        available_credit:  acc.creditData?.availableCreditLimit != null ? Number(acc.creditData.availableCreditLimit) : null,
        last_synced_at:    new Date().toISOString(),
      },
      { onConflict: "user_id,pluggy_account_id" }
    );

    // ── Sync debts ──────────────────────────────────────────────────────────
    if (DEBT_TYPES.has(acc.type)) {
      const creditLimit = acc.creditData?.creditLimit ?? null;
      const available   = acc.creditData?.availableCreditLimit ?? null;
      const used =
        creditLimit != null && available != null
          ? creditLimit - available
          : Math.abs(Number(acc.balance ?? 0));
      if (used > 0) {
        const total = creditLimit ?? used;
        const paid  = Math.max(0, total - used);
        await supabaseAdmin.from("debts").upsert(
          {
            user_id:           profile.id,
            pluggy_account_id: acc.id,
            name:              acc.name ?? "Conta importada",
            creditor:          null,
            total_amount:      total,
            paid_amount:       paid,
            status:            "active",
            source:            "pluggy",
          },
          { onConflict: "user_id,pluggy_account_id" }
        );
      }
    }

    // ── Sync transactions ───────────────────────────────────────────────────
    if (TX_TYPES.has(acc.type)) {
      try {
        const { results: txList } = await pluggy.fetchTransactions(acc.id, { from: fromStr } as any);
        for (const tx of txList ?? []) {
          const txType = (tx as any).type === "CREDIT" ? "in" : "out";
          await supabaseAdmin.from("transactions").upsert(
            {
              user_id:               profile.id,
              pluggy_transaction_id: (tx as any).id,
              name:                  (tx as any).description ?? (tx as any).descriptionRaw ?? "Transação importada",
              amount:                Math.abs(Number((tx as any).amount ?? 0)),
              type:                  txType,
              category:              (tx as any).category ?? null,
              transaction_date:      (tx as any).date
                ? String((tx as any).date).split("T")[0]
                : new Date().toISOString().split("T")[0],
              source:                "pluggy",
              payment_source:        [acc.name ?? "Banco"],
            },
            { onConflict: "user_id,pluggy_transaction_id" }
          );
        }
      } catch {
        // some account types don't support transaction listing
      }
    }
  }

  // Update last sync timestamp
  await supabaseAdmin.from("profiles")
    .update({ last_pluggy_sync_at: new Date().toISOString() })
    .eq("id", profile.id);
}

export async function POST(req: Request) {
  // Always respond 2XX immediately — Pluggy requires response within 5s
  let event: any = {};
  try { event = await req.json(); } catch { /* ignore parse errors */ }

  if (event.itemId && (event.event === "item/created" || event.event === "item/updated")) {
    fullSyncForItem(event.itemId).catch(console.error);
  }

  return NextResponse.json({ received: true });
}

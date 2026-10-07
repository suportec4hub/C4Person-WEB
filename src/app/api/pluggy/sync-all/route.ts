export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Pluggy SDK v2 uses "BANK"/"CREDIT" as types; older docs used subtype strings.
// We accept both so the route works regardless of SDK version.
const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

async function upsertBankAccount(payload: Record<string, unknown>, onConflict: string) {
  // Try with logo column first; if it errors (column not yet migrated), retry without it
  const { error } = await supabaseAdmin.from("bank_accounts").upsert(payload, { onConflict });
  if (error?.message?.includes("institution_logo_url")) {
    const { institution_logo_url: _omit, ...rest } = payload;
    return supabaseAdmin.from("bank_accounts").upsert(rest, { onConflict });
  }
  return { error };
}

export async function POST(req: Request) {
  const { itemId } = await req.json();
  if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

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
    .select("pluggy_client_id, pluggy_client_secret")
    .eq("id", user.id)
    .single();

  const clientId     = profile?.pluggy_client_id     ?? process.env.PLUGGY_CLIENT_ID;
  const clientSecret = profile?.pluggy_client_secret  ?? process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Configure suas credenciais Pluggy em Configurações → Dívidas" }, { status: 400 });
  }

  await supabaseAdmin.from("profiles")
    .update({ pluggy_item_id: itemId, last_pluggy_sync_at: new Date().toISOString() })
    .eq("id", user.id);

  try {
    const { PluggyClient } = await import("pluggy-sdk");
    const pluggy = new PluggyClient({ clientId, clientSecret });

    // Fetch item to get institution name + logo from connector
    const item = await pluggy.fetchItem(itemId);
    const institutionName    = item.connector?.name     ?? null;
    const institutionLogoUrl = (item.connector as any)?.imageUrl ?? null;

    // Persist this itemId — gracefully skip if pluggy_items table not yet migrated
    try {
      await supabaseAdmin.from("pluggy_items").upsert(
        { user_id: user.id, item_id: itemId, institution_name: institutionName, institution_logo_url: institutionLogoUrl },
        { onConflict: "user_id,item_id" }
      );
    } catch { /* table not yet migrated */ }

    const { results: accounts } = await pluggy.fetchAccounts(itemId);

    // Current month start for transaction history (always fetch from month start)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Also fetch 2 extra months back on first sync to build history
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const fromStr = from.toISOString().split("T")[0];

    let importedDebts    = 0;
    let importedTx       = 0;
    let importedAccounts = 0;

    for (const acc of accounts) {
      // ── Bank account balance + credit data ───────────────────────────────
      const { error: baErr } = await upsertBankAccount(
        {
          user_id:               user.id,
          pluggy_account_id:     acc.id,
          name:                  acc.name ?? "Conta",
          type:                  acc.type,
          subtype:               (acc as any).subtype ?? null,
          balance:               Number(acc.balance ?? 0),
          institution_name:      institutionName,
          institution_logo_url:  institutionLogoUrl,
          credit_limit:          acc.creditData?.creditLimit          != null ? Number(acc.creditData.creditLimit)            : null,
          available_credit:      acc.creditData?.availableCreditLimit != null ? Number(acc.creditData.availableCreditLimit)   : null,
          last_synced_at:        now.toISOString(),
        },
        "user_id,pluggy_account_id"
      );
      if (!baErr) importedAccounts++;

      // ── Debts (credit cards, loans) ──────────────────────────────────────
      // CREDIT type = credit card / loan in Pluggy SDK v2
      if (DEBT_TYPES.has(acc.type) || DEBT_TYPES.has((acc as any).subtype)) {
        const creditLimit = acc.creditData?.creditLimit ?? null;
        const available   = acc.creditData?.availableCreditLimit ?? null;
        const used =
          creditLimit != null && available != null
            ? creditLimit - available
            : Math.abs(Number(acc.balance ?? 0));
        if (used > 0) {
          const total = creditLimit ?? used;
          const paid  = Math.max(0, total - used);
          const { error } = await supabaseAdmin.from("debts").upsert(
            {
              user_id:            user.id,
              pluggy_account_id:  acc.id,
              name:               acc.name ?? "Conta importada",
              creditor:           null,
              total_amount:       total,
              paid_amount:        paid,
              status:             "active",
              source:             "pluggy",
            },
            { onConflict: "user_id,pluggy_account_id" }
          );
          if (!error) importedDebts++;
        }
      }

      // ── Transactions — try ALL account types, catch silently if unsupported ──
      try {
        const { results: txList } = await pluggy.fetchTransactions(acc.id, { from: fromStr } as any);
        for (const tx of txList ?? []) {
          // Pluggy v2: transaction.type "CREDIT" = money coming in, "DEBIT" = going out
          const txType = (tx as any).type === "CREDIT" ? "in" : "out";
          const { error } = await supabaseAdmin.from("transactions").upsert(
            {
              user_id:                user.id,
              pluggy_transaction_id:  (tx as any).id,
              name:                   (tx as any).description ?? (tx as any).descriptionRaw ?? "Transação importada",
              amount:                 Math.abs(Number((tx as any).amount ?? 0)),
              type:                   txType,
              category:               (tx as any).category ?? null,
              transaction_date:       (tx as any).date
                ? String((tx as any).date).split("T")[0]
                : now.toISOString().split("T")[0],
              source:                 "pluggy",
              payment_source:         [acc.name ?? institutionName ?? "Banco"],
            },
            { onConflict: "user_id,pluggy_transaction_id" }
          );
          if (!error) importedTx++;
        }
      } catch {
        // This account type doesn't support transaction listing — skip silently
      }
    }

    return NextResponse.json({ importedDebts, importedTx, importedAccounts, accounts: accounts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno" }, { status: 500 });
  }
}

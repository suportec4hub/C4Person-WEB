export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Pluggy SDK v2 uses "BANK"/"CREDIT" as types; older docs used subtype strings.
// We accept both so the route works regardless of SDK version.
const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);

// If the account name starts with a bank-sounding keyword, treat it as the institution name.
// This handles Pluggy's test connector "MeuPluggy" which gives accounts named "BANCO INTER",
// "Banco Bradesco", etc. For real connectors the account name is a product name like
// "Conta Corrente" and we fall back to the connector name (which IS the bank name).
const BANK_PREFIX_RE = /^(banco|bco|bank|caixa|nubank|inter|bradesco|itau|ita(ú|u)|santander|sicoob|sicredi|c6\s|c6bank|picpay|bmg|safra|votorantim|original|pan\s|banpara|banrisul|next|neon|will|stone|mercado\s*pago)/i;
function resolveInstitution(accountName: string, connectorName: string | null): string | null {
  if (accountName && BANK_PREFIX_RE.test(accountName.trim())) return accountName;
  return connectorName;
}

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

async function putBankAccount(userId: string, pluggyAccountId: string, payload: Record<string, unknown>) {
  const { data: existing } = await supabaseAdmin
    .from("bank_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("pluggy_account_id", pluggyAccountId)
    .maybeSingle();

  const doWrite = async (p: Record<string, unknown>) => {
    if (existing) {
      return supabaseAdmin.from("bank_accounts").update(p).eq("id", existing.id);
    }
    return supabaseAdmin.from("bank_accounts").insert(p);
  };

  // Core fields guaranteed to exist in all schema versions
  const corePayload = {
    user_id:           payload.user_id,
    pluggy_account_id: payload.pluggy_account_id,
    name:              payload.name,
    type:              payload.type,
    balance:           payload.balance,
    last_synced_at:    payload.last_synced_at,
  };

  let { error } = await doWrite(payload);
  if (error) {
    // Retry without optional columns that may not be in the schema yet
    const stripped = { ...corePayload, institution_name: payload.institution_name };
    const retry = await doWrite(stripped);
    error = retry.error ?? null;
  }
  return { error };
}

async function putTransaction(payload: Record<string, unknown>) {
  // Try dedup via pluggy_transaction_id (requires the column to exist in the schema)
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("user_id", payload.user_id as string)
    .eq("pluggy_transaction_id", payload.pluggy_transaction_id as string)
    .maybeSingle();

  if (selErr) {
    // Column likely not yet migrated — fall back to plain insert without dedup
    const { pluggy_transaction_id: _id, ...rest } = payload;
    return supabaseAdmin.from("transactions").insert(rest);
  }
  if (existing) {
    return supabaseAdmin.from("transactions").update(payload).eq("id", existing.id);
  }
  return supabaseAdmin.from("transactions").insert(payload);
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

    // Pluggy item status values that require user re-authentication
    const EXPIRED_STATUSES = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "OUTDATED"]);
    // Poll until item is no longer UPDATING (up to 30s, 3s intervals)
    let itemStatus = (item as any).status ?? "";
    if (itemStatus === "UPDATING") {
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const refreshed = await pluggy.fetchItem(itemId);
        itemStatus = (refreshed as any).status ?? "";
        if (itemStatus !== "UPDATING") break;
      }
    }
    if (EXPIRED_STATUSES.has(itemStatus)) {
      const institutionName = item.connector?.name ?? "banco";
      return NextResponse.json({
        error: `${institutionName} precisa ser reconectado (status: ${itemStatus})`,
        needsReconnect: true,
        itemId,
        importedAccounts: 0, importedTx: 0, importedDebts: 0,
      });
    }

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

    const now = new Date();
    // 12-month lookback for full history
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().split("T")[0];

    let importedDebts    = 0;
    let importedTx       = 0;
    let importedAccounts = 0;

    for (const acc of accounts) {
      // ── Bank account balance + credit data ───────────────────────────────
      const { error: baErr } = await putBankAccount(
        user.id,
        acc.id,
        {
          user_id:               user.id,
          pluggy_account_id:     acc.id,
          name:                  acc.name ?? "Conta",
          type:                  acc.type,
          subtype:               (acc as any).subtype ?? null,
          balance:               Number(acc.balance ?? 0),
          institution_name:      resolveInstitution(acc.name ?? "", institutionName),
          institution_logo_url:  institutionLogoUrl,
          credit_limit:          acc.creditData?.creditLimit          != null ? Number(acc.creditData.creditLimit)            : null,
          available_credit:      acc.creditData?.availableCreditLimit != null ? Number(acc.creditData.availableCreditLimit)   : null,
          last_synced_at:        now.toISOString(),
        }
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

      // ── Transactions — fetchAllTransactions handles cursor pagination ───────
      try {
        // SDK 0.91+: fetchAllTransactions uses cursor-based pagination internally.
        // dateFrom (not from) is the correct filter key for the v2 cursor endpoint.
        const txList = await pluggy.fetchAllTransactions(acc.id, { dateFrom } as any);
        for (const tx of txList ?? []) {
          // Pluggy v2: transaction.type "CREDIT" = money coming in, "DEBIT" = going out
          const txType = (tx as any).type === "CREDIT" ? "in" : "out";
          const { error } = await putTransaction({
            user_id:                user.id,
            pluggy_transaction_id:  (tx as any).id,
            name:                   (tx as any).description ?? (tx as any).descriptionRaw ?? "Transação importada",
            amount:                 Math.abs(Number((tx as any).amount ?? 0)),
            type:                   txType,
            category:               (tx as any).category ?? null,
            transaction_date:       (tx as any).date
              ? new Date((tx as any).date).toISOString().split("T")[0]
              : now.toISOString().split("T")[0],
            source:                 "pluggy",
            payment_source:         [acc.name ?? institutionName ?? "Banco"],
          });
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

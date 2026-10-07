export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);
const TX_TYPES   = new Set(["CHECKING", "SAVINGS", "CREDIT_CARD"]);

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null as unknown as ReturnType<typeof createClient>;
  return createClient(url, key);
})();

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
    const { results: accounts } = await pluggy.fetchAccounts(itemId);

    // 3-month window for transaction history
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fromStr = from.toISOString().split("T")[0];

    let importedDebts = 0;
    let importedTx    = 0;

    for (const acc of accounts) {
      // ── Debts (credit cards, loans) ──────────────────────────────────────
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

      // ── Transactions (checking, savings, credit card) ─────────────────────
      if (TX_TYPES.has(acc.type)) {
        try {
          const { results: txList } = await pluggy.fetchTransactions(acc.id, { from: fromStr } as any);
          for (const tx of txList ?? []) {
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
                  : new Date().toISOString().split("T")[0],
                source:                 "pluggy",
                payment_source:         [acc.name ?? "Banco"],
              },
              { onConflict: "user_id,pluggy_transaction_id" }
            );
            if (!error) importedTx++;
          }
        } catch {
          // account type may not support transaction listing — skip silently
        }
      }
    }

    return NextResponse.json({ importedDebts, importedTx, accounts: accounts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno" }, { status: 500 });
  }
}

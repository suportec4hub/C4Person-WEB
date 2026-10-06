export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { PluggyClient } from "pluggy-sdk";

const DEBT_TYPES = new Set(["CREDIT", "CREDIT_CARD", "LOAN", "FINANCING"]);

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
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Persist itemId on the user's profile
  await supabaseAdmin
    .from("profiles")
    .update({ pluggy_item_id: itemId })
    .eq("id", user.id);

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
    });

    const { results: accounts } = await pluggy.fetchAccounts(itemId);
    const debtAccounts = accounts.filter((a) => DEBT_TYPES.has(a.type));

    let imported = 0;
    for (const acc of debtAccounts) {
      // Credit cards: used = limit - available; Loans: balance = remaining principal
      const creditLimit = acc.creditData?.creditLimit ?? null;
      const available = acc.creditData?.availableCreditLimit ?? null;
      const used = creditLimit != null && available != null
        ? creditLimit - available
        : Math.abs(Number(acc.balance ?? 0));
      if (used <= 0) continue;

      const total = creditLimit ?? used;
      const paid = Math.max(0, total - used);

      const { error } = await supabaseAdmin.from("debts").upsert(
        {
          user_id: user.id,
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

      if (!error) imported++;
    }

    return NextResponse.json({ imported, total: debtAccounts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json(); // 'active' | 'inactive'

  if (!["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: id,
      status,
      plan: "pro",
      updated_at: new Date().toISOString(),
      ...(status === "active" && {
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ success: true });
}

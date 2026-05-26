import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

const VALID_ROLES = ["user", "ADM_PADRAO", "ADMIN_C4HUB"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const { role } = await req.json();

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 400 });
  }

  // Tenta atualizar; se não houver linha (profile não existe), cria com upsert
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("id");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (!updated || updated.length === 0) {
    // Perfil ainda não existe — cria agora
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({ id, role });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

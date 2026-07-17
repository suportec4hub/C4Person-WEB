export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: "Não é possível excluir sua própria conta." }, { status: 400 });
  }

  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (targetProfile?.role === "ADMIN_C4HUB" || targetProfile?.role === "admin") {
    return NextResponse.json({ error: "Não é possível excluir outro Admin C4Hub." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { full_name, email } = body as { full_name?: string; email?: string };

  if (full_name !== undefined) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: full_name.trim() || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (email?.trim()) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { email: email.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

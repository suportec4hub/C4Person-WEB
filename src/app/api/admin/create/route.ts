import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, supabaseAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { full_name, email, password, role } = await req.json();
  if (!full_name || !email || !password) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const validRoles = ["ADMIN_C4HUB", "ADM_PADRAO"];
  const assignedRole = validRoles.includes(role) ? role : "ADMIN_C4HUB";

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name,
    role: assignedRole,
  });

  return NextResponse.json({ success: true, userId: data.user.id });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    // Auth: somente usuários logados podem abrir chamado
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
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const title   = (body?.title  ?? "").trim().slice(0, 200);
    const message = (body?.message ?? "").trim().slice(0, 5000);

    if (!title || !message) {
      return NextResponse.json(
        { error: "Título e descrição são obrigatórios." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Fallback: log no servidor e retorna OK para não travar o usuário
      console.error("[Support] RESEND_API_KEY não configurado. Chamado recebido:", {
        from: user.email,
        title,
        message,
      });
      return NextResponse.json({ ok: true });
    }

    const resend = new Resend(apiKey);
    const fromAddress = process.env.SUPPORT_FROM_EMAIL ?? "suporte@c4person.com.br";

    await resend.emails.send({
      from: `C4Person Suporte <${fromAddress}>`,
      to: ["suporte@c4os.com.br"],
      replyTo: user.email,
      subject: `[Suporte C4Person] ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#7c3aed;margin-bottom:4px;">Novo chamado de suporte</h2>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>

          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:100px;vertical-align:top"><strong>Usuário</strong></td>
              <td style="padding:6px 0">${user.email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;vertical-align:top"><strong>Título</strong></td>
              <td style="padding:6px 0">${title}</td>
            </tr>
          </table>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>

          <h3 style="font-size:14px;color:#374151;margin-bottom:8px;">Descrição do problema</h3>
          <p style="font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:16px;">${message}</p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
          <p style="font-size:12px;color:#9ca3af;">Para responder, use Reply-To (já configurado com o e-mail do usuário).</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Support] Erro ao enviar e-mail:", err);
    return NextResponse.json({ error: "Erro ao enviar. Tente novamente." }, { status: 500 });
  }
}

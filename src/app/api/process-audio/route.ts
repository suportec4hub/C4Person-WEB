import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "dummy_key",
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio enviado." }, { status: 400 });
    }

    // 1. Transcrição via Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
    });

    const transcriptText = transcription.text;

    // 2. Resumo + extração de tarefas estruturadas via GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um assistente pessoal produtivo. Analise a transcrição e retorne um JSON com exatamente duas chaves:
- "summary": resumo conciso em Markdown com títulos (## Resumo, ## Pontos Principais) e listas
- "actionItems": array de strings com as tarefas/ações identificadas (máximo 10 itens, frases curtas e diretas no infinitivo)

Se não houver tarefas identificadas, retorne "actionItems" como array vazio.

Exemplo de resposta válida:
{
  "summary": "## Resumo\\nReunião sobre lançamento do produto...\\n\\n## Pontos Principais\\n- Prazo definido para 15/03",
  "actionItems": ["Enviar proposta para o cliente", "Marcar reunião de follow-up com o time"]
}

Responda SEMPRE em Português do Brasil.`,
        },
        {
          role: "user",
          content: transcriptText,
        },
      ],
    });

    let summary = "";
    let actionItems: string[] = [];

    try {
      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      summary = parsed.summary || "";
      actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
    } catch {
      summary = completion.choices[0].message.content || "";
    }

    return NextResponse.json({
      transcription: transcriptText,
      summary,
      actionItems,
    });

  } catch (error: unknown) {
    console.error("Erro na API da OpenAI:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno no servidor.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

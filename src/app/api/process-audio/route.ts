import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function generateSummary(transcript: string) {
  // Estima duração aproximada com base no tamanho do texto (150 palavras/min em pt-BR)
  const wordCount = transcript.split(/\s+/).length;
  const estimatedMinutes = Math.round(wordCount / 150);
  const isLong = estimatedMinutes >= 20; // reunião longa = mais detalhe

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: isLong ? 4096 : 2048,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é um assistente executivo especialista em análise de reuniões de negócios. Sua tarefa é analisar a transcrição completa e produzir um relatório COMPLETO, DETALHADO e ESTRUTURADO.

Retorne um JSON com exatamente cinco chaves:

"summary": string em Markdown com TODAS as seções abaixo (use os emojis nos títulos):

## 📋 Visão Geral
Descreva o contexto, objetivo e participantes mencionados na reunião. 2-4 parágrafos.

## 🗣️ Tópicos Discutidos
Liste e explique CADA tópico abordado na reunião, com subdetalhes relevantes. Seja completo — não omita nenhum assunto.

## ✅ Decisões Tomadas
Liste todas as decisões concretas que foram tomadas. Se responsáveis foram mencionados, inclua-os.

## ⚠️ Pontos de Atenção
Riscos, problemas, bloqueios ou preocupações levantadas durante a reunião.

## 📅 Próximos Passos
Prazos, datas e responsabilidades definidas na reunião.

## 💡 Insights e Observações
Observações estratégicas, tendências ou padrões identificados na discussão.

"actionItems": array de strings com TODAS as tarefas e ações identificadas (sem limite de itens). Cada item deve ser:
- Uma frase direta no infinitivo
- Incluir o responsável quando mencionado: "Enviar proposta para o cliente (João)"
- Incluir prazo quando mencionado: "Revisar contrato até sexta-feira"
- Incluir prioridade entre colchetes quando detectável: "Enviar proposta até sexta [URGENTE]"
- Ser específico e acionável

"tags": array de 3 a 7 strings curtas em Português do Brasil com as palavras-chave do tema da reunião. Exemplos: ["vendas", "cliente", "proposta"]. Preencha mesmo para reuniões curtas.

"meetingType": string com o tipo de reunião detectado automaticamente. Deve ser exatamente um dos valores: "Comercial", "Interna", "1:1", "Planejamento", "Retrospectiva", "Técnica", "Outro". Preencha mesmo para reuniões curtas.

"attendees": array de strings com os nomes de pessoas mencionadas na transcrição. Inclua apenas nomes próprios de participantes ou pessoas citadas. Retorne array vazio se nenhum nome for identificado. Preencha mesmo para reuniões curtas.

IMPORTANTE: Seja PROPORCIONAL ao conteúdo. Reuniões longas exigem resumos longos e detalhados. Não resuma demais — capture TODOS os pontos importantes.
Responda SEMPRE em Português do Brasil.`,
      },
      {
        role: "user",
        content: `Duração estimada da reunião: ~${estimatedMinutes} minutos.\n\nTranscrição completa:\n\n${transcript}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      summary: parsed.summary || "",
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      meetingType: parsed.meetingType || "Outro",
      attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    };
  } catch {
    return {
      summary: completion.choices[0].message.content || "",
      actionItems: [],
      tags: [],
      meetingType: "Outro",
      attendees: [],
    };
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada. Adicione a variável de ambiente no Vercel." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const mode = (formData.get("mode") as string) || "full";

    // ── Modo: apenas gerar resumo a partir de transcrição já pronta ──
    if (mode === "summarize") {
      const transcript = formData.get("transcript") as string;
      if (!transcript?.trim()) {
        return NextResponse.json({ error: "Transcrição não fornecida." }, { status: 400 });
      }
      const { summary, actionItems, tags, meetingType, attendees } = await generateSummary(transcript);
      return NextResponse.json({ summary, actionItems, tags, meetingType, attendees });
    }

    // ── Modo: transcrever áudio (+ opcionalmente gerar resumo) ──
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio enviado." }, { status: 400 });
    }

    if (file.size > 24 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Segmento de áudio excede 24 MB. Reduza a duração do segmento." },
        { status: 400 }
      );
    }

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "pt",
    });

    const transcriptText = transcription.text;

    // mode=transcribe → devolve só o texto (para processamento em chunks)
    if (mode === "transcribe") {
      return NextResponse.json({ transcription: transcriptText });
    }

    // mode=full (padrão) → transcreve + gera resumo numa chamada só
    const { summary, actionItems, tags, meetingType, attendees } = await generateSummary(transcriptText);
    return NextResponse.json({ transcription: transcriptText, summary, actionItems, tags, meetingType, attendees });

  } catch (error: unknown) {
    console.error("Erro no Groq:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno no servidor.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

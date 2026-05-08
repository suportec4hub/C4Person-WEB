import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio enviado." }, { status: 400 });
    }

    // 1. Transcrição usando a API da OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt", 
    });

    const transcriptText = transcription.text;

    // 2. Geração de Resumo e Tarefas com GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Usando gpt-4o-mini para velocidade e eficiência
      messages: [
        {
          role: "system",
          content: "Você é um assistente pessoal produtivo. Seu objetivo é analisar a transcrição de uma nota de voz ou reunião e retornar:\n1. Um resumo muito conciso.\n2. Itens de ação extraídos (tarefas), se houver.\nResponda sempre em Português do Brasil usando formatação Markdown (use títulos e listas).",
        },
        {
          role: "user",
          content: transcriptText,
        },
      ],
    });

    const summaryText = completion.choices[0].message.content;

    return NextResponse.json({ 
      transcription: transcriptText,
      summary: summaryText
    });

  } catch (error: unknown) {
    console.error("Erro na API da OpenAI:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno no servidor.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

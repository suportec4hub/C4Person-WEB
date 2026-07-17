export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RecentTransaction {
  name: string;
  amount: number;
  type: "in" | "out";
}

// Summary context shape sent by the frontend (avoids sending full arrays)
interface ChatContext {
  totalTasks: number;
  doneTasks: number;
  totalHabits: number;
  completedHabits: number;
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  recentTransactions: RecentTransaction[];
}

const groq = (() => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null as unknown as OpenAI;
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
})();

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history,
      context,
    }: { message: string; history: ChatMessage[]; context: ChatContext } = await req.json();

    const today = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const pendingTasks = context.totalTasks - context.doneTasks;

    const txLine =
      context.recentTransactions.length > 0
        ? context.recentTransactions
            .map(
              (t) =>
                `  ${t.type === "in" ? "+" : "-"}R$ ${Number(t.amount).toFixed(2)} — ${t.name}`
            )
            .join("\n")
        : "  Nenhuma transação registrada.";

    const systemPrompt = [
      "Você é o C4 Assistant, assistente pessoal integrado ao dashboard C4 Person.",
      "Responda de forma concisa, direta e útil. Use listas quando fizer sentido. Sempre em Português do Brasil.",
      `Hoje é ${today}.`,
      "",
      "=== DADOS DO USUÁRIO ===",
      "",
      `TAREFAS: ${pendingTasks} pendentes, ${context.doneTasks} concluídas (total ${context.totalTasks}).`,
      "",
      `HÁBITOS: ${context.completedHabits} de ${context.totalHabits} concluídos hoje.`,
      "",
      "FINANÇAS:",
      `- Saldo atual: R$ ${(context.totalBalance ?? 0).toFixed(2)}`,
      `- Receitas: R$ ${(context.totalIn ?? 0).toFixed(2)} | Despesas: R$ ${(context.totalOut ?? 0).toFixed(2)}`,
      "- Últimas transações:",
      txLine,
    ].join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-12),
        { role: "user", content: message },
      ],
    });

    return NextResponse.json({ reply: completion.choices[0].message.content });
  } catch (error: unknown) {
    console.error("Erro no chat Groq:", error);
    const msg = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

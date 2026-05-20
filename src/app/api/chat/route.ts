import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Task {
  title: string;
  is_done: boolean;
  priority: string;
  time: string;
}

interface Habit {
  name: string;
  streak: number;
  is_completed_today: boolean;
}

interface Transaction {
  name: string;
  amount: number;
  type: "in" | "out";
}

interface ChatContext {
  tasks: Task[];
  habits: Habit[];
  transactions: Transaction[];
  totalBalance: number;
  totalIn: number;
  totalOut: number;
}

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy_key" });

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

    const tasksPending = context.tasks.filter((t) => !t.is_done);
    const tasksDone = context.tasks.filter((t) => t.is_done);
    const habitsToday = context.habits.filter((h) => h.is_completed_today);

    const tasksLine = tasksPending.length > 0
      ? tasksPending.map((t) => `- ${t.title}${t.priority === "alta" ? " [ALTA]" : ""}${t.time !== "Livre" ? ` @ ${t.time}` : ""}`).join("\n")
      : "Nenhuma tarefa pendente.";

    const doneLine = tasksDone.length > 0
      ? `\nConcluídas hoje: ${tasksDone.map((t) => t.title).join(", ")}`
      : "";

    const habitsLine = context.habits.length > 0
      ? context.habits.map((h) => `- ${h.name}: ${h.is_completed_today ? "✓ feito hoje" : "○ pendente"} | ${h.streak} dias de streak`).join("\n")
      : "Nenhum hábito cadastrado.";

    const txLine = context.transactions.length > 0
      ? context.transactions.slice(0, 10).map((t) => `  ${t.type === "in" ? "+" : "-"}R$ ${Number(t.amount).toFixed(2)} — ${t.name}`).join("\n")
      : "  Nenhuma transação registrada.";

    const systemPrompt = [
      "Você é o C4 Assistant, assistente pessoal integrado ao dashboard C4 Person.",
      "Responda de forma concisa, direta e útil. Use listas quando fizer sentido. Sempre em Português do Brasil.",
      `Hoje é ${today}.`,
      "",
      "=== DADOS DO USUÁRIO ===",
      "",
      `TAREFAS (${tasksPending.length} pendentes, ${tasksDone.length} concluídas):`,
      tasksLine,
      doneLine,
      "",
      `HÁBITOS (${habitsToday.length}/${context.habits.length} concluídos hoje):`,
      habitsLine,
      "",
      "FINANÇAS:",
      `- Saldo atual: R$ ${context.totalBalance.toFixed(2)}`,
      `- Receitas: R$ ${context.totalIn.toFixed(2)} | Despesas: R$ ${context.totalOut.toFixed(2)}`,
      "- Últimas transações:",
      txLine,
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-10),
        { role: "user", content: message },
      ],
    });

    return NextResponse.json({ reply: completion.choices[0].message.content });
  } catch (error: unknown) {
    console.error("Erro no chat IA:", error);
    const msg = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

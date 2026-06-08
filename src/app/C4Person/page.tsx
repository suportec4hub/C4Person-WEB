"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SkeletonPage } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HabitHeatmap } from "@/components/HabitHeatmap";
import {
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Mic,
  Target,
  Calendar,
  Plus,
  X,
  Square,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Trash2,
  CheckSquare,
  ListChecks,
  Bot,
  Send,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableTaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: any;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors ${task.is_done ? "opacity-50" : ""}`}
    >
      <button
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={15} />
      </button>
      <div onClick={onToggle} className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
        {task.is_done ? <CheckCircle2 size={20} className="text-accent flex-shrink-0" /> : <Circle size={20} className="text-muted-foreground flex-shrink-0" />}
        <span className={`flex-1 truncate ${task.is_done ? "line-through text-muted-foreground" : "text-white"}`}>{task.title}</span>
        {task.priority === "alta" && (
          <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex-shrink-0">Alta</span>
        )}
        {task.recurrence && task.recurrence !== "none" && (
          <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex-shrink-0">
            {{ daily: "Diária", weekly: "Semanal", monthly: "Mensal" }[task.recurrence as string]}
          </span>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0"><Clock size={12} /> {task.time || "Livre"}</span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function nextRecurrenceDate(recurrence: string, fromIso?: string): string {
  const base = fromIso ? new Date(fromIso) : new Date();
  if (recurrence === "daily") base.setDate(base.getDate() + 1);
  else if (recurrence === "weekly") base.setDate(base.getDate() + 7);
  else if (recurrence === "monthly") base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 0 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const { undoToast, toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTasks(prev => {
        const oldIdx = prev.findIndex(t => t.id === active.id);
        const newIdx = prev.findIndex(t => t.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const [mounted, setMounted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const today = new Date();

  // Estados do Gravador
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, phase: "" });
  const [result, setResult] = useState<{ transcription: string; summary: string; actionItems: string[] } | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const initChunkRef = useRef<Blob | null>(null);   // primeiro chunk — contém o cabeçalho WebM
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados do Chat IA
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados de Tarefas
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'alta'>('normal');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');

  // Estados de Hábitos e Transações
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<string, string[]>>({});
  const [transactions, setTransactions] = useState<any[]>([]);

  const [showHabitModal, setShowHabitModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");

  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [newTransactionName, setNewTransactionName] = useState("");
  const [newTransactionAmount, setNewTransactionAmount] = useState("");
  const [newTransactionType, setNewTransactionType] = useState<"in" | "out">("out");

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (data) setTasks(data);
  }, []);

  const fetchHabits = useCallback(async () => {
    const { data } = await supabase.from('habits').select('*').order('created_at', { ascending: true });
    if (data) {
      // Reset diário: se last_completed_date < hoje, limpa is_completed_today
      const today = new Date().toISOString().slice(0, 10);
      const toReset = data.filter((h: any) => h.is_completed_today && h.last_completed_date !== today);
      if (toReset.length > 0) {
        await Promise.all(
          toReset.map((h: any) =>
            supabase.from('habits').update({ is_completed_today: false }).eq('id', h.id)
          )
        );
        const { data: refreshed } = await supabase.from('habits').select('*').order('created_at', { ascending: true });
        if (refreshed) setHabits(refreshed);
      } else {
        setHabits(data);
      }
    }
  }, []);

  const fetchHabitLogs = useCallback(async () => {
    const from = subDays(new Date(), 14 * 7).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date")
      .gte("log_date", from);
    if (error || !data) return;
    const map: Record<string, string[]> = {};
    for (const row of data) {
      if (!map[row.habit_id]) map[row.habit_id] = [];
      map[row.habit_id].push(row.log_date);
    }
    setHabitLogs(map);
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data);
  }, []);

  const toggleTask = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    // Capture task BEFORE the optimistic setTasks so we read the correct state
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: newStatus } : t));
    await supabase.from("tasks").update({ is_done: newStatus }).eq("id", id);
    if (newStatus) {
      if (task?.recurrence && task.recurrence !== "none") {
        const nextDate = nextRecurrenceDate(task.recurrence, task.task_date);
        const { data } = await supabase.from("tasks").insert([{
          title: task.title,
          time: task.time,
          is_done: false,
          priority: task.priority,
          recurrence: task.recurrence,
          task_date: nextDate,
          user_id: task.user_id,
        }]).select();
        if (data) {
          setTasks(prev => [...prev, data[0]]);
          toast({ message: `Próxima recorrência agendada`, type: "success" });
        }
      }
    }
  };

  const toggleHabit = async (id: string, currentStatus: boolean, currentStreak: number) => {
    const newStatus = !currentStatus;
    const newStreak = newStatus ? currentStreak + 1 : Math.max(0, currentStreak - 1);
    const todayIso = new Date().toISOString().slice(0, 10);
    setHabits(habits.map(h => h.id === id ? { ...h, is_completed_today: newStatus, streak: newStreak } : h));
    if (newStatus) {
      setHabitLogs(prev => ({
        ...prev,
        [id]: [...(prev[id] || []).filter(d => d !== todayIso), todayIso],
      }));
      supabase.from("habit_logs").upsert(
        { habit_id: id, log_date: todayIso, user_id: userId },
        { onConflict: "habit_id,log_date" }
      );
    } else {
      setHabitLogs(prev => ({
        ...prev,
        [id]: (prev[id] || []).filter(d => d !== todayIso),
      }));
      supabase.from("habit_logs").delete().eq("habit_id", id).eq("log_date", todayIso);
    }
    await supabase.from("habits").update({
      is_completed_today: newStatus,
      streak: newStreak,
      last_completed_date: newStatus ? todayIso : null,
    }).eq("id", id);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newTask = { title: newTaskTitle, time: newTaskTime || "Livre", is_done: false, priority: newTaskPriority, recurrence: newTaskRecurrence, user_id: userId };

    // Optimistic update
    const tempId = Date.now().toString();
    setTasks([...tasks, { id: tempId, ...newTask }]);
    setShowTaskModal(false);
    setNewTaskTitle("");
    setNewTaskTime("");
    setNewTaskPriority('normal');
    setNewTaskRecurrence('none');

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    const newHabit = { name: newHabitName, streak: 0, is_completed_today: false, user_id: userId };
    const tempId = Date.now().toString();
    setHabits([...habits, { id: tempId, ...newHabit }]);
    setShowHabitModal(false);
    setNewHabitName("");

    const { data } = await supabase.from('habits').insert([newHabit]).select();
    if (data) setHabits(prev => prev.map(h => h.id === tempId ? data[0] : h));
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransactionName.trim() || !newTransactionAmount) return;
    const amountNum = parseFloat(newTransactionAmount.replace(',', '.'));
    if (isNaN(amountNum)) return;

    const newTx = { name: newTransactionName, amount: amountNum, type: newTransactionType, transaction_date: new Date().toISOString(), user_id: userId };
    const tempId = Date.now().toString();
    setTransactions([ { id: tempId, ...newTx }, ...transactions ]);
    setShowFinanceModal(false);
    setNewTransactionName("");
    setNewTransactionAmount("");

    const { data } = await supabase.from('transactions').insert([newTx]).select();
    if (data) setTransactions(prev => prev.map(t => t.id === tempId ? data[0] : t));
  };

  const deleteTask = (id: string) => {
    const idx = tasks.findIndex(t => t.id === id);
    const item = tasks[idx];
    if (!item) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    supabase.from('tasks').delete().eq('id', id);
    undoToast(`Tarefa "${item.title}" removida`, () => {
      setTasks(prev => {
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, item);
        return next;
      });
      supabase.from('tasks').insert([item]);
    });
  };

  const deleteHabit = (id: string) => {
    const item = habits.find(h => h.id === id);
    if (!item) return;
    setHabits(prev => prev.filter(h => h.id !== id));
    supabase.from('habits').delete().eq('id', id);
    undoToast(`Hábito "${item.name}" removido`, () => {
      setHabits(prev => [...prev, item]);
      supabase.from('habits').insert([item]);
    });
  };

  const deleteTransaction = (id: string) => {
    const item = transactions.find(t => t.id === id);
    if (!item) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    supabase.from('transactions').delete().eq('id', id);
    undoToast(`"${item.name}" removido`, () => {
      setTransactions(prev => [item, ...prev]);
      supabase.from('transactions').insert([item]);
    });
  };

  useEffect(() => {
    setMounted(true);

    Promise.all([fetchTasks(), fetchHabits(), fetchTransactions(), fetchHabitLogs()]).finally(() => setLoading(false));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from("profiles").select("full_name").eq("id", user.id).single()
        .then(({ data }) => {
          const raw =
            data?.full_name ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split("@")[0] ||
            "";
          const parts = raw.trim().split(/\s+/).filter(Boolean);
          const display =
            parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "";
          setFirstName(display);
        });
    });

    // Realtime subscriptions
    const channel = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks)
      .on("postgres_changes", { event: "*", schema: "public", table: "habits" }, fetchHabits)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchTransactions)
      .subscribe();

    // Keyboard shortcuts
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n" || e.key === "N") setShowTaskModal(true);
      if (e.key === "h" || e.key === "H") setShowHabitModal(true);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("keydown", onKey);
    };
  }, [fetchTasks, fetchHabits, fetchTransactions, fetchHabitLogs]);

  // Timer para o gravador
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 10 minutos por fatia — ~2-4 MB cada (Opus/WebM de voz; seguro abaixo de 4.5 MB do Vercel)
  const SEGMENT_MS = 10 * 60 * 1000;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      initChunkRef.current = null;
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        if (!initChunkRef.current) {
          // Primeiro chunk: contém o cabeçalho EBML/WebM — necessário para decodificação
          initChunkRef.current = event.data;
          audioChunksRef.current.push(event.data);
        } else {
          // Chunks subsequentes: reúne init + dados para formar um WebM completo e válido
          const segment = new Blob([initChunkRef.current, event.data], { type: "audio/webm" });
          audioChunksRef.current.push(segment);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await processSegments(audioChunksRef.current);
      };

      // timeslice: dispara ondataavailable a cada SEGMENT_MS (fatias de 5 min)
      mediaRecorder.start(SEGMENT_MS);
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processSegments = async (segments: Blob[]) => {
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: segments.length, phase: "transcribe" });
    try {
      // Get fresh user ID at save time — avoids stale closure from startRecording
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uid = authUser?.id ?? userId;

      let fullTranscript = "";

      for (let i = 0; i < segments.length; i++) {
        setProcessingProgress({ current: i + 1, total: segments.length, phase: "transcribe" });

        // Para gravações muito curtas (1 segmento), usa modo full direto
        if (segments.length === 1) {
          const fd = new FormData();
          fd.append("file", segments[i], "recording.webm");
          fd.append("mode", "full");
          const res = await fetch("/api/process-audio", { method: "POST", body: fd });
          if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Erro ao processar."); }
          const data = await res.json();
          setResult(data);
          setSelectedActions(data.actionItems ?? []);
          const { error: noteErr } = await supabase.from("notes").insert([{
            title: `Reunião ${format(new Date(), "dd/MM 'às' HH:mm")}`,
            transcription: data.transcription,
            summary: data.summary,
            user_id: uid,
          }]);
          if (noteErr) {
            console.error("[notes] insert failed:", noteErr.message);
          } else {
            toast({ message: "Reunião salva em Notas!", type: "success" });
          }
          return;
        }

        // Múltiplos segmentos: transcreve cada um separadamente
        const fd = new FormData();
        fd.append("file", segments[i], `segment_${i + 1}.webm`);
        fd.append("mode", "transcribe");
        const res = await fetch("/api/process-audio", { method: "POST", body: fd });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Erro no segmento ${i + 1}.`); }
        const data = await res.json();
        fullTranscript += (i > 0 ? " " : "") + data.transcription;
      }

      // Gera o resumo com a transcrição completa combinada
      setProcessingProgress({ current: segments.length, total: segments.length, phase: "summarize" });
      const fd = new FormData();
      fd.append("mode", "summarize");
      fd.append("transcript", fullTranscript);
      const res = await fetch("/api/process-audio", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Erro ao gerar resumo."); }
      const sumData = await res.json();

      setResult({ transcription: fullTranscript, summary: sumData.summary, actionItems: sumData.actionItems });
      setSelectedActions(sumData.actionItems ?? []);

      const { error: noteErr } = await supabase.from("notes").insert([{
        title: `Reunião ${format(new Date(), "dd/MM 'às' HH:mm")}`,
        transcription: fullTranscript,
        summary: sumData.summary,
        user_id: uid,
      }]);
      if (noteErr) {
        console.error("[notes] insert failed:", noteErr.message);
      } else {
        toast({ message: "Reunião salva em Notas!", type: "success" });
      }

    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido.";
      alert(`Erro ao processar o áudio:\n\n${msg}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0, phase: "" });
    }
  };

  const handleImportTasks = async () => {
    if (selectedActions.length === 0) return;
    const newTasks = selectedActions.map(title => ({
      title,
      time: "Livre",
      is_done: false,
      priority: 'normal' as const,
      user_id: userId,
    }));
    const { data } = await supabase.from('tasks').insert(newTasks).select();
    if (data) {
      setTasks(prev => [...prev, ...data]);
      setImportSuccess(true);
    }
  };

  const closeRecorder = () => {
    if (isRecording) stopRecording();
    setShowRecorder(false);
    setTimeout(() => {
      setResult(null);
      setRecordingTime(0);
      setSelectedActions([]);
      setImportSuccess(false);
      setProcessingProgress({ current: 0, total: 0, phase: "" });
      audioChunksRef.current = [];
      initChunkRef.current = null;
    }, 300);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const MAX_CHAT_MESSAGES = 40; // ~20 trocas visíveis na UI

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    setChatInput("");
    setIsChatLoading(true);

    // Build history BEFORE updating state (to include the current user message correctly)
    const trimHistory = (msg: { role: string; content: string }) => ({
      ...msg,
      content: msg.content.length > 500 ? msg.content.slice(0, 500) + "…" : msg.content,
    });
    // Last 11 prior messages + current user message = 12 total sent to API
    const history = [
      ...chatMessages.slice(-11).map(trimHistory),
      { role: "user" as const, content: text },
    ];

    // Update UI after capturing history
    setChatMessages(prev => {
      const next = [...prev, { role: "user" as const, content: text }];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });

    try {

      // Contexto resumido (não envia arrays completos, só contagens e totais)
      const ctx = {
        totalTasks: tasks.length,
        doneTasks: tasks.filter(t => t.is_done).length,
        totalHabits: habits.length,
        completedHabits: habits.filter(h => h.is_completed_today).length,
        totalBalance,
        totalIn,
        totalOut,
        recentTransactions: transactions.slice(0, 5).map(t => ({
          name: t.name, amount: t.amount, type: t.type,
        })),
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, context: ctx }),
      });
      const data = await res.json();
      setChatMessages(prev => {
        const next = [...prev, { role: "assistant" as const, content: data.reply || "Não consegui responder. Tente novamente." }];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
      });
    } catch {
      setChatMessages(prev => [...prev, {
        role: "assistant" as const,
        content: "Erro ao conectar com a IA. Verifique sua chave de API.",
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalIn = transactions.filter(t => t.type === 'in').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalBalance = totalIn - totalOut;

  const topPriorityTask = tasks.find(t => t.priority === 'alta' && !t.is_done) || tasks.find(t => !t.is_done) || tasks[0];
  const otherTasks = topPriorityTask ? tasks.filter(t => t.id !== topPriorityTask.id) : tasks;
  const upcomingEvents = tasks.filter(t => t.time && t.time !== "Livre" && !t.is_done).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  if (!mounted) return null;
  if (loading) return <SkeletonPage />;

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative z-0">
        {/* Gradients */}
        <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <header className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">{getGreeting()}{firstName ? `, ${firstName}` : ""}</h1>
          </motion.div>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              onClick={() => setShowChat(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-full font-medium transition-all text-sm"
            >
              <Sparkles size={16} className="text-primary shrink-0" />
              <span className="hidden xs:inline">Assistente IA</span>
            </motion.button>

            <motion.button
              onClick={() => setShowRecorder(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-full font-medium shadow-[0_4px_20px_rgba(139,92,246,0.3)] transition-all text-sm"
            >
              <Mic size={16} className="shrink-0" />
              <span>Gravar Nota</span>
            </motion.button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Foco Principal */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-1 lg:col-span-8 glass-card p-4 md:p-6 flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Target size={120} /></div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Target size={20} className="text-primary" />
              Foco do Dia
            </h3>
            
            {topPriorityTask ? (
              <div onClick={() => toggleTask(topPriorityTask.id, topPriorityTask.is_done)} className={`bg-background/50 border border-white/5 rounded-xl p-5 mb-6 flex items-start gap-4 group cursor-pointer hover:border-primary/50 transition-all relative z-10 ${topPriorityTask.is_done ? 'opacity-50' : ''}`}>
                <button className={`mt-1 transition-colors ${topPriorityTask.is_done ? 'text-accent' : 'text-muted-foreground group-hover:text-primary'}`}>
                  {topPriorityTask.is_done ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                <div>
                  <h4 className={`text-xl font-medium mb-1 ${topPriorityTask.is_done ? 'line-through text-muted-foreground' : 'text-white'}`}>{topPriorityTask.title}</h4>
                  <p className="text-muted-foreground text-sm">{topPriorityTask.time && topPriorityTask.time !== 'Livre' ? `Marcado para ${topPriorityTask.time}` : 'Sem horário definido'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {topPriorityTask.priority === 'alta' && (
                    <div className="bg-red-500/20 text-red-400 text-xs font-medium px-3 py-1 rounded-full border border-red-500/30">Alta</div>
                  )}
                  <div className="bg-primary/20 text-primary text-xs font-medium px-3 py-1 rounded-full">Principal</div>
                  <button onClick={(e) => { e.stopPropagation(); deleteTask(topPriorityTask.id); }} className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-background/50 border border-white/5 rounded-xl p-5 mb-6 text-center text-muted-foreground relative z-10">
                Nenhuma tarefa pendente!
              </div>
            )}

            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Outras Tarefas</h3>
            {otherTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic relative z-10">Nenhuma tarefa. Adicione uma nova!</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={otherTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-3 relative z-10">
                    {otherTasks.map(task => (
                      <SortableTaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(task.id, task.is_done)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
            
            <button 
              onClick={() => setShowTaskModal(true)}
              className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-fit relative z-10"
            >
              <Plus size={16} /> Adicionar Tarefa
            </button>
          </motion.section>

          {/* Hábitos e Rotina */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="col-span-1 lg:col-span-4 flex flex-col gap-4 md:gap-6"
          >
            {/* Hábitos */}
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Flame size={20} className="text-orange-500" />
                  Hábitos
                </h3>
                <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                  Lvl {Math.floor(habits.reduce((acc, h) => acc + (h.streak || 0), 0) / 7) + 1}
                </span>
              </div>
              
              <div className="space-y-4">
                {habits.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum hábito cadastrado.</p>
                ) : (
                  habits.map((habit) => (
                    <div key={habit.id} onClick={() => toggleHabit(habit.id, habit.is_completed_today, habit.streak)} className="flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${habit.is_completed_today ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-secondary text-muted-foreground border border-white/5 group-hover:border-white/20'}`}>
                          {habit.is_completed_today && <CheckCircle2 size={16} />}
                        </div>
                        <span className={habit.is_completed_today ? 'text-white/80' : 'text-white'}>{habit.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-orange-400">
                          <Flame size={12} /> {habit.streak}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => setShowHabitModal(true)} className="mt-5 flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors">
                <Plus size={16} /> Novo Hábito
              </button>

              {/* Heatmaps por hábito */}
              {habits.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-white/5 pt-5">
                  {habits.map(habit => (
                    <HabitHeatmap
                      key={habit.id}
                      habitId={habit.id}
                      habitName={habit.name}
                      streak={habit.streak || 0}
                      logs={habitLogs[habit.id] || []}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Agenda Resumo */}
            <div className="glass-card p-6 flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-5">
                <Calendar size={20} className="text-blue-400" />
                Próximos Eventos
              </h3>
              <div className="relative border-l border-white/10 ml-3 pl-5 space-y-6">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sua agenda está livre hoje!</p>
                ) : (
                  upcomingEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="relative">
                      <div className="absolute -left-[25.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] border border-background" />
                      <p className="text-xs text-blue-400 font-medium mb-1">{event.time}</p>
                      <p className="text-sm font-medium text-white">{event.title}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        </div>

        {/* Néctar: Módulo Financeiro */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 glass-card p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Wallet size={160} /></div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wallet size={20} className="text-emerald-400" />
              Visão Financeira
            </h3>
            <button className="text-xs font-medium text-muted-foreground hover:text-white transition-colors">Ver Relatório Completo</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* Saldo Atual */}
            <div className="bg-background/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <p className="text-muted-foreground text-sm font-medium mb-2">Saldo Total</p>
              <h4 className={`text-3xl font-bold tracking-tight ${totalBalance < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(totalBalance)}</h4>
              <div className={`mt-4 flex items-center gap-2 text-xs font-medium w-fit px-2 py-1 rounded-md ${totalBalance < 0 ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                {totalBalance < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {totalBalance < 0 ? 'Saldo Negativo' : 'Atualizado'}
              </div>
            </div>

            {/* Receitas vs Despesas */}
            <div className="bg-background/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-center gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ArrowUpRight size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Receitas</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(totalIn)}</p>
                  </div>
                </div>
              </div>
              <div className="h-[1px] w-full bg-white/5" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                    <ArrowDownRight size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Despesas</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(totalOut)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transações Recentes */}
            <div className="bg-background/40 border border-white/5 rounded-2xl p-5 flex flex-col">
              <p className="text-muted-foreground text-sm font-medium mb-4">Transações Recentes</p>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhuma transação.</p>
                ) : (
                  transactions.slice(0, 4).map((t) => (
                    <div key={t.id} className="group flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.transaction_date ? format(new Date(t.transaction_date), "d MMM", { locale: ptBR }) : 'Hoje'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.type === 'in' ? '+ ' : '- '}
                          {formatCurrency(Number(t.amount))}
                        </span>
                        <button onClick={() => deleteTransaction(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => setShowFinanceModal(true)} className="mt-5 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                <Plus size={16} /> Nova Transação
              </button>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Modal do Gravador e Resumo de IA */}
      <AnimatePresence>
        {showRecorder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-2xl shadow-2xl relative"
            >
              <button 
                onClick={closeRecorder}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Mic className="text-primary" />
                Assistente de Reunião (IA)
              </h2>

              {!result ? (
                <div className="flex flex-col items-center justify-center py-10">
                  
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-5 text-primary w-full max-w-sm">
                      <Loader2 size={44} className="animate-spin" />
                      {processingProgress.total > 1 ? (
                        <>
                          <div className="text-center space-y-1">
                            <p className="text-base font-semibold text-white">
                              {processingProgress.phase === "summarize"
                                ? "✨ Gerando resumo completo e detalhado…"
                                : `🎙️ Transcrevendo parte ${processingProgress.current} de ${processingProgress.total}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {processingProgress.phase === "summarize"
                                ? "Analisando toda a reunião para extrair decisões, tarefas e insights"
                                : `~${(processingProgress.total - processingProgress.current) * 4}s restantes`}
                            </p>
                          </div>
                          <div className="w-full space-y-1.5">
                            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.round(
                                    ((processingProgress.phase === "summarize"
                                      ? processingProgress.total + 0.8
                                      : processingProgress.current - 0.5) /
                                      (processingProgress.total + 1)) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Transcrição</span>
                              <span>Resumo</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            Reunião de ~{processingProgress.total * 10} min · {processingProgress.total} segmentos de 10 min
                          </p>
                        </>
                      ) : (
                        <div className="text-center space-y-1">
                          <p className="text-base font-semibold text-white">IA processando o áudio…</p>
                          <p className="text-sm text-muted-foreground">Transcrevendo e gerando resumo detalhado</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="text-6xl font-mono text-white mb-8">
                        {formatTime(recordingTime)}
                      </div>
                      
                      {!isRecording ? (
                        <button 
                          onClick={startRecording}
                          className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-all group"
                        >
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.6)] group-hover:scale-110 transition-transform">
                            <Mic size={32} color="white" />
                          </div>
                        </button>
                      ) : (
                        <button 
                          onClick={stopRecording}
                          className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30 transition-all group"
                        >
                          <div className="w-16 h-16 rounded-lg bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] group-hover:scale-95 transition-transform">
                            <Square size={24} color="white" fill="white" />
                          </div>
                        </button>
                      )}
                      
                      <p className="mt-8 text-muted-foreground text-center text-sm">
                        {isRecording
                          ? `Gravando… Clique no quadrado para parar.\nO áudio será processado em segmentos de 10 min automaticamente.`
                          : "Clique no microfone para começar a gravar.\nSuporta até 10 horas de reunião."}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar space-y-5">

                  {/* Resumo */}
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                      <Target size={18} />
                      Resumo da Reunião
                    </h3>
                    <div className="text-sm text-white/90 leading-relaxed prose-meeting">
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold text-white mt-5 mb-2 first:mt-0">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold text-white/90 mt-3 mb-1">{children}</h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="space-y-1 my-2 ml-3">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="flex gap-2 text-white/85 leading-snug">
                              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                              <span>{children}</span>
                            </li>
                          ),
                          p: ({ children }) => (
                            <p className="text-white/85 leading-relaxed mb-2">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="text-white font-semibold">{children}</strong>
                          ),
                        }}
                      >
                        {result.summary}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Tarefas identificadas pela IA */}
                  {result.actionItems && result.actionItems.length > 0 && (
                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                      <h3 className="font-semibold text-accent mb-3 flex items-center gap-2">
                        <ListChecks size={18} />
                        Tarefas Identificadas pela IA
                      </h3>
                      <div className="space-y-2 mb-4">
                        {result.actionItems.map((item, i) => (
                          <label key={i} className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative mt-0.5">
                              <input
                                type="checkbox"
                                checked={selectedActions.includes(item)}
                                onChange={(e) => {
                                  setImportSuccess(false);
                                  setSelectedActions(prev =>
                                    e.target.checked
                                      ? [...prev, item]
                                      : prev.filter(a => a !== item)
                                  );
                                }}
                                className="w-4 h-4 rounded border-white/20 bg-background accent-accent cursor-pointer"
                              />
                            </div>
                            <span className="text-sm text-white/90 leading-snug group-hover:text-white transition-colors">
                              {item}
                            </span>
                          </label>
                        ))}
                      </div>

                      {importSuccess ? (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-accent text-sm font-medium"
                        >
                          <CheckCircle2 size={16} />
                          {selectedActions.length} tarefa(s) adicionada(s) ao seu Foco do Dia!
                        </motion.div>
                      ) : (
                        <button
                          onClick={handleImportTasks}
                          disabled={selectedActions.length === 0}
                          className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <CheckSquare size={16} />
                          Criar {selectedActions.length} tarefa{selectedActions.length !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transcrição */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transcrição Completa</h3>
                    <p className="text-sm text-white/70 leading-relaxed italic">
                      &quot;{result.transcription}&quot;
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Adicionar Tarefa */}
        {showTaskModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowTaskModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-white">Nova Tarefa</h2>
              
              <form onSubmit={handleAddTask} className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">O que você precisa fazer?</label>
                  <input 
                    type="text" 
                    autoFocus
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ex: Pagar a conta de luz"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Horário (Opcional)</label>
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Prioridade</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setNewTaskPriority('normal')} className={`flex-1 py-2 rounded-lg font-medium border text-sm transition-colors ${newTaskPriority === 'normal' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>Normal</button>
                    <button type="button" onClick={() => setNewTaskPriority('alta')} className={`flex-1 py-2 rounded-lg font-medium border text-sm transition-colors ${newTaskPriority === 'alta' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>Alta</button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Repetição</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["none", "daily", "weekly", "monthly"] as const).map(r => {
                      const labels = { none: "Não repete", daily: "Diária", weekly: "Semanal", monthly: "Mensal" };
                      const active = newTaskRecurrence === r;
                      return (
                        <button key={r} type="button" onClick={() => setNewTaskRecurrence(r)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-primary/20 text-primary border-primary/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>
                          {labels[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="mt-2 w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Adicionar Hábito */}
        {showHabitModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowHabitModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-white">Novo Hábito</h2>
              
              <form onSubmit={handleAddHabit} className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Qual hábito quer construir?</label>
                  <input 
                    type="text" 
                    autoFocus
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Ex: Ler 10 páginas"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={!newHabitName.trim()}
                  className="mt-2 w-full bg-orange-500 hover:bg-orange-500/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Adicionar Transação */}
        {showFinanceModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowFinanceModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-white">Nova Transação</h2>
              
              <form onSubmit={handleAddTransaction} className="flex flex-col gap-5">
                <div className="flex gap-4 mb-2">
                  <button type="button" onClick={() => setNewTransactionType('out')} className={`flex-1 py-2 rounded-lg font-medium border ${newTransactionType === 'out' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>Despesa</button>
                  <button type="button" onClick={() => setNewTransactionType('in')} className={`flex-1 py-2 rounded-lg font-medium border ${newTransactionType === 'in' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>Receita</button>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nome da transação</label>
                  <input 
                    type="text" 
                    autoFocus
                    value={newTransactionName}
                    onChange={(e) => setNewTransactionName(e.target.value)}
                    placeholder="Ex: Almoço"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Valor (R$)</label>
                  <input 
                    type="number"
                    step="0.01" 
                    value={newTransactionAmount}
                    onChange={(e) => setNewTransactionAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={!newTransactionName.trim() || !newTransactionAmount}
                  className={`mt-2 w-full py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${newTransactionType === 'in' ? 'bg-emerald-500 hover:bg-emerald-500/90' : 'bg-red-500 hover:bg-red-500/90'} text-white`}
                >
                  Adicionar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <>
            {/* Backdrop semitransparente */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="fixed inset-0 z-30 bg-black/30"
            />

            {/* Painel lateral */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-white/10 z-40 flex flex-col shadow-2xl"
            >
              {/* Header do chat */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Bot size={19} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-none mb-0.5">C4 Assistant</h3>
                    <p className="text-xs text-muted-foreground">Powered by GPT-4o-mini</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-muted-foreground hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Sparkles size={14} className="text-primary" />
                      <span>Pergunte sobre seus dados</span>
                    </div>
                    {[
                      "O que tenho para fazer hoje?",
                      "Como estão meus hábitos?",
                      "Qual é meu saldo atual?",
                      "Me dê um resumo do meu dia.",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setChatInput(s)}
                        className="text-left text-sm px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                          <Bot size={13} className="text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-white/5 text-white/90 border border-white/5 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}

                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <Bot size={13} className="text-primary" />
                    </div>
                    <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendChatMessage} className="px-4 py-4 border-t border-white/10">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pergunte sobre tarefas, hábitos, finanças…"
                    className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary/90 rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

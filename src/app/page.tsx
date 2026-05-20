"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  LayoutDashboard,
  Mic,
  PenTool,
  Target,
  Calendar,
  Settings,
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const today = new Date();

  // Estados do Gravador
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ transcription: string; summary: string; actionItems: string[] } | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de Tarefas
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'alta'>('normal');

  // Estados de Hábitos e Transações
  const [habits, setHabits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [showHabitModal, setShowHabitModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");

  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [newTransactionName, setNewTransactionName] = useState("");
  const [newTransactionAmount, setNewTransactionAmount] = useState("");
  const [newTransactionType, setNewTransactionType] = useState<"in" | "out">("out");

  const fetchTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (data) setTasks(data);
    else if (error) console.error("Erro ao buscar tarefas", error);
  };

  const fetchHabits = async () => {
    const { data, error } = await supabase.from('habits').select('*').order('created_at', { ascending: true });
    if (data) setHabits(data);
    else if (error) console.error("Erro ao buscar hábitos", error);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data);
    else if (error) console.error("Erro ao buscar transações", error);
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setTasks(tasks.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t));
    await supabase.from('tasks').update({ is_done: !currentStatus }).eq('id', id);
  };

  const toggleHabit = async (id: string, currentStatus: boolean, currentStreak: number) => {
    const newStatus = !currentStatus;
    const newStreak = newStatus ? currentStreak + 1 : Math.max(0, currentStreak - 1);
    setHabits(habits.map(h => h.id === id ? { ...h, is_completed_today: newStatus, streak: newStreak } : h));
    await supabase.from('habits').update({ is_completed_today: newStatus, streak: newStreak }).eq('id', id);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newTask = { title: newTaskTitle, time: newTaskTime || "Livre", is_done: false, priority: newTaskPriority };
    
    // Optimistic update
    const tempId = Date.now().toString();
    setTasks([...tasks, { id: tempId, ...newTask }]);
    setShowTaskModal(false);
    setNewTaskTitle("");
    setNewTaskTime("");
    setNewTaskPriority('normal');

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    const newHabit = { name: newHabitName, streak: 0, is_completed_today: false };
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

    const newTx = { name: newTransactionName, amount: amountNum, type: newTransactionType, transaction_date: new Date().toISOString() };
    const tempId = Date.now().toString();
    setTransactions([ { id: tempId, ...newTx }, ...transactions ]);
    setShowFinanceModal(false);
    setNewTransactionName("");
    setNewTransactionAmount("");

    const { data } = await supabase.from('transactions').insert([newTx]).select();
    if (data) setTransactions(prev => prev.map(t => t.id === tempId ? data[0] : t));
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  const deleteHabit = async (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    await supabase.from('habits').delete().eq('id', id);
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await supabase.from('transactions').delete().eq('id', id);
  };

  useEffect(() => {
    setMounted(true);
    fetchTasks();
    fetchHabits();
    fetchTransactions();
  }, []);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
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

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao processar o áudio.");
      }
      
      const data = await response.json();
      setResult(data);
      setSelectedActions(data.actionItems ?? []);

      // Salvar a nota na nuvem (Supabase)
      await supabase.from('notes').insert([{
        title: `Reunião ${format(new Date(), "dd/MM")}`,
        transcription: data.transcription,
        summary: data.summary
      }]);

    } catch (error) {
      console.error(error);
      alert("Erro ao processar o áudio. Verifique sua chave da API.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportTasks = async () => {
    if (selectedActions.length === 0) return;
    const newTasks = selectedActions.map(title => ({
      title,
      time: "Livre",
      is_done: false,
      priority: 'normal' as const,
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
    }, 300);
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

  return (
    <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 glass border-r border-border flex flex-col items-center py-8 gap-8 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(139,92,246,0.5)]">
          NL
        </div>
        <nav className="flex flex-col gap-6 mt-8 text-muted-foreground">
          <button className="p-3 rounded-xl bg-white/5 text-primary"><LayoutDashboard size={22} /></button>
          <button className="p-3 rounded-xl hover:bg-white/5 hover:text-white transition-all"><Target size={22} /></button>
          <button className="p-3 rounded-xl hover:bg-white/5 hover:text-white transition-all"><Calendar size={22} /></button>
          <button className="p-3 rounded-xl hover:bg-white/5 hover:text-white transition-all"><PenTool size={22} /></button>
        </nav>
          <div className="mt-auto flex flex-col gap-6 text-muted-foreground">
          <button className="p-3 rounded-xl hover:bg-white/5 hover:text-white transition-all"><Settings size={22} /></button>
          <div className="w-10 h-10 rounded-full bg-secondary border border-border overflow-hidden relative">
             <Image src="https://ui-avatars.com/api/?name=Lucas+Machado&background=27272a&color=fff" alt="User" fill className="object-cover" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative z-0">
        {/* Gradients */}
        <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <header className="mb-10 flex justify-between items-end">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <h1 className="text-4xl font-bold tracking-tight">Bom dia, Lucas</h1>
          </motion.div>
          
          <motion.button 
            onClick={() => setShowRecorder(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-full font-medium shadow-[0_4px_20px_rgba(139,92,246,0.3)] transition-all"
          >
            <Mic size={18} />
            <span>Gravar Reunião / Nota</span>
          </motion.button>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Foco Principal */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-8 glass-card p-6 flex flex-col relative overflow-hidden"
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
                  <button onClick={(e) => { e.stopPropagation(); deleteTask(topPriorityTask.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1">
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
            <ul className="space-y-3 relative z-10">
              {otherTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma tarefa. Adicione uma nova!</p>
              ) : (
                otherTasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => toggleTask(task.id, task.is_done)}
                    className={`group flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors ${task.is_done ? 'opacity-50' : ''} cursor-pointer`}
                  >
                    {task.is_done ? <CheckCircle2 size={20} className="text-accent" /> : <Circle size={20} className="text-muted-foreground" />}
                    <span className={`flex-1 ${task.is_done ? 'line-through text-muted-foreground' : 'text-white'}`}>{task.title}</span>
                    {task.priority === 'alta' && (
                      <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">Alta</span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12}/> {task.time || "Livre"}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))
              )}
            </ul>
            
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
            className="col-span-4 flex flex-col gap-6"
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
                    <div className="flex flex-col items-center gap-4 text-primary">
                      <Loader2 size={48} className="animate-spin" />
                      <p className="text-lg font-medium text-white">IA processando o áudio e gerando o resumo...</p>
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
                      
                      <p className="mt-8 text-muted-foreground">
                        {isRecording ? "Gravando... Clique no quadrado para parar e processar." : "Clique no microfone para começar a gravar."}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar space-y-5">

                  {/* Resumo */}
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <Target size={18} />
                      Resumo da Reunião
                    </h3>
                    <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                      {result.summary}
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
    </div>
  );
}

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
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const today = new Date();

  // Estados do Gravador
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{transcription: string, summary: string} | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de Tarefas
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  // Estados de Hábitos e Transações
  const [habits, setHabits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

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

  const toggleHabit = async (id: string, currentStatus: boolean) => {
    setHabits(habits.map(h => h.id === id ? { ...h, is_completed_today: !currentStatus } : h));
    await supabase.from('habits').update({ is_completed_today: !currentStatus }).eq('id', id);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newTask = { title: newTaskTitle, time: newTaskTime || "Livre", is_done: false, priority: 'normal' };
    
    // Optimistic update
    const tempId = Date.now().toString();
    setTasks([...tasks, { id: tempId, ...newTask }]);
    setShowTaskModal(false);
    setNewTaskTitle("");
    setNewTaskTime("");

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

      if (!response.ok) throw new Error("Falha na API da OpenAI");
      
      const data = await response.json();
      setResult(data);

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

  const closeRecorder = () => {
    if (isRecording) stopRecording();
    setShowRecorder(false);
    setTimeout(() => {
      setResult(null);
      setRecordingTime(0);
    }, 300);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalIn = transactions.filter(t => t.type === 'in').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalBalance = totalIn - totalOut;

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
            
            <div className="bg-background/50 border border-white/5 rounded-xl p-5 mb-6 flex items-start gap-4 group cursor-pointer hover:border-primary/50 transition-all relative z-10">
              <button className="mt-1 text-muted-foreground group-hover:text-primary transition-colors">
                <Circle size={24} />
              </button>
              <div>
                <h4 className="text-xl font-medium text-white mb-1">Finalizar Arquitetura do C4 Person App</h4>
                <p className="text-muted-foreground text-sm">Estruturar o banco de dados no Supabase e definir os esquemas principais.</p>
              </div>
              <div className="ml-auto bg-primary/20 text-primary text-xs font-medium px-3 py-1 rounded-full">
                Alta Prioridade
              </div>
            </div>

            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Outras Tarefas</h3>
            <ul className="space-y-3 relative z-10">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma tarefa. Adicione uma nova!</p>
              ) : (
                tasks.map((task) => (
                  <li 
                    key={task.id} 
                    onClick={() => toggleTask(task.id, task.is_done)}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors ${task.is_done ? 'opacity-50' : ''} cursor-pointer`}
                  >
                    {task.is_done ? <CheckCircle2 size={20} className="text-accent" /> : <Circle size={20} className="text-muted-foreground" />}
                    <span className={`flex-1 ${task.is_done ? 'line-through text-muted-foreground' : 'text-white'}`}>{task.title}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12}/> {task.time}</span>
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
                  Lvl 12
                </span>
              </div>
              
              <div className="space-y-4">
                {habits.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum hábito cadastrado.</p>
                ) : (
                  habits.map((habit) => (
                    <div key={habit.id} onClick={() => toggleHabit(habit.id, habit.is_completed_today)} className="flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${habit.is_completed_today ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-secondary text-muted-foreground border border-white/5 group-hover:border-white/20'}`}>
                          {habit.is_completed_today && <CheckCircle2 size={16} />}
                        </div>
                        <span className={habit.is_completed_today ? 'text-white/80' : 'text-white'}>{habit.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-orange-400">
                        <Flame size={12} /> {habit.streak}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Agenda Resumo */}
            <div className="glass-card p-6 flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-5">
                <Calendar size={20} className="text-blue-400" />
                Próximos Eventos
              </h3>
              <div className="relative border-l border-white/10 ml-3 pl-5 space-y-6">
                {[
                  { time: "11:30", title: "Sync Diária", type: "work" },
                  { time: "14:00", title: "Mentoria Técnica", type: "meeting" },
                  { time: "18:00", title: "Inglês", type: "study" }
                ].map((event, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[25.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] border border-background" />
                    <p className="text-xs text-blue-400 font-medium mb-1">{event.time}</p>
                    <p className="text-sm font-medium text-white">{event.title}</p>
                  </div>
                ))}
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
              <h4 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(totalBalance)}</h4>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 w-fit px-2 py-1 rounded-md">
                <TrendingUp size={14} /> Atualizado
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
                    <div key={t.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.transaction_date ? format(new Date(t.transaction_date), "d MMM", { locale: ptBR }) : 'Hoje'}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-400' : 'text-white'}`}>
                        {t.type === 'in' ? '+ ' : '- '}
                        {formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
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
                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <Target size={18} />
                      Resumo da IA e Itens de Ação
                    </h3>
                    <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                      {result.summary}
                    </div>
                  </div>

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
      </AnimatePresence>
    </div>
  );
}

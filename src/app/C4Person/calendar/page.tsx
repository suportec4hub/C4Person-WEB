"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Circle, Plus, X } from "lucide-react";

interface Task {
  id: string;
  title: string;
  is_done: boolean;
  priority: string;
  task_date: string | null;
}

export default function CalendarPage() {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "alta">("normal");
  const [userId, setUserId] = useState("");

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    fetchTasks();

    const channel = supabase.channel("calendar-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id,title,is_done,priority,task_date")
      .order("created_at", { ascending: true });
    if (data) setTasks(data as Task[]);
  };

  const tasksForDay = (day: Date) =>
    tasks.filter(t => t.task_date && isSameDay(new Date(t.task_date + "T12:00:00"), day));

  const tasksSelected = useMemo(() => tasksForDay(selectedDay), [tasks, selectedDay]);

  const toggleTask = async (id: string, current: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: !current } : t));
    await supabase.from("tasks").update({ is_done: !current }).eq("id", id);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    const payload = { title: newTitle, time: "Livre", is_done: false, priority: newPriority, task_date: dateStr, user_id: userId };
    setShowAddModal(false);
    setNewTitle("");
    const { data } = await supabase.from("tasks").insert([payload]).select();
    if (data) setTasks(prev => [...prev, data[0] as Task]);
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Planejar</h2>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => subWeeks(w, 1))}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => { const now = new Date(); setWeekStart(startOfWeek(now, { weekStartsOn: 1 })); setSelectedDay(now); }}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </motion.header>

      {/* Week strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-7 gap-2 mb-6"
      >
        {days.map((day, i) => {
          const count = tasksForDay(day).length;
          const active = isSameDay(day, selectedDay);
          const today = isToday(day);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all ${
                active
                  ? "bg-primary text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
                  : today
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/5 text-muted-foreground"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
              </span>
              <span className="text-base font-bold">{format(day, "d")}</span>
              {count > 0 && (
                <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/70" : "bg-primary"}`} />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Day title + add */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">
          {isToday(selectedDay)
            ? "Hoje"
            : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          <span className="ml-2 text-sm text-muted-foreground font-normal">
            {tasksSelected.length} tarefa{tasksSelected.length !== 1 ? "s" : ""}
          </span>
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-all shadow-[0_4px_16px_rgba(139,92,246,0.25)]"
        >
          <Plus size={16} /> Nova tarefa
        </button>
      </div>

      {/* Tasks for selected day */}
      <AnimatePresence mode="popLayout">
        {tasksSelected.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-40 text-center"
          >
            <CalendarDays size={36} className="text-primary/30 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhuma tarefa para este dia</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              + Adicionar tarefa
            </button>
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-2">
            {tasksSelected.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card px-4 py-3.5 flex items-center gap-3"
              >
                <button
                  onClick={() => toggleTask(task.id, task.is_done)}
                  className="flex-shrink-0 text-muted-foreground hover:text-white transition-colors"
                >
                  {task.is_done
                    ? <CheckCircle2 size={20} className="text-accent" />
                    : <Circle size={20} />}
                </button>
                <span className={`flex-1 text-sm ${task.is_done ? "line-through text-muted-foreground" : "text-white"}`}>
                  {task.title}
                </span>
                {task.priority === "alta" && (
                  <span className="text-[10px] font-medium text-red-400 border border-red-400/30 px-2 py-0.5 rounded-full flex-shrink-0">
                    Alta
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl p-7 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  Nova tarefa — {format(selectedDay, "d/MM", { locale: ptBR })}
                </h2>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white">
                  <X size={22} />
                </button>
              </div>
              <form onSubmit={addTask} className="flex flex-col gap-4">
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Título da tarefa…"
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex gap-3">
                  {(["normal", "alta"] as const).map(p => (
                    <button
                      key={p} type="button"
                      onClick={() => setNewPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        newPriority === p
                          ? p === "alta" ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-white/10 border-white/20 text-white"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {p === "normal" ? "Normal" : "Alta prioridade"}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
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

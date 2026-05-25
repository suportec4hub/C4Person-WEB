"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  Flag,
  ClipboardList,
} from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  color: string;
  created_at: string;
}

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  is_done: boolean;
  created_at: string;
}

const COLORS = [
  "#8b5cf6",
  "#10b981",
  "#3b82f6",
  "#f97316",
  "#ef4444",
  "#ec4899",
];

interface Task {
  id: string;
  title: string;
  is_done: boolean;
  goal_id: string | null;
}

export default function GoalsPage() {
  const [mounted, setMounted] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  const [userId, setUserId] = useState("");
  const [milestoneInputs, setMilestoneInputs] = useState<Record<string, string>>({});
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  const fetchAll = async () => {
    const [{ data: goalsData }, { data: msData }, { data: tasksData }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("id,title,is_done,goal_id").order("created_at", { ascending: true }),
    ]);
    if (goalsData) setGoals(goalsData);
    if (msData) setMilestones(msData);
    if (tasksData) setTasks(tasksData as Task[]);
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    fetchAll();
  }, []);

  const getMilestones = (goalId: string) => milestones.filter((m) => m.goal_id === goalId);

  const getProgress = (goalId: string) => {
    const ms = getMilestones(goalId);
    if (ms.length === 0) return 0;
    return Math.round((ms.filter((m) => m.is_done).length / ms.length) * 100);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const payload = {
      title: newTitle,
      description: newDescription || null,
      target_date: newTargetDate || null,
      color: newColor,
      user_id: userId,
    };

    setShowModal(false);
    setNewTitle("");
    setNewDescription("");
    setNewTargetDate("");
    setNewColor(COLORS[0]);

    const { data } = await supabase.from("goals").insert([payload]).select();
    if (data) setGoals((prev) => [data[0], ...prev]);
  };

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setMilestones((prev) => prev.filter((m) => m.goal_id !== id));
    await supabase.from("goals").delete().eq("id", id);
  };

  const addMilestone = async (goalId: string) => {
    const title = milestoneInputs[goalId]?.trim();
    if (!title) return;

    setMilestoneInputs((prev) => ({ ...prev, [goalId]: "" }));
    const tempId = `temp-${Date.now()}`;
    const tempMs: Milestone = { id: tempId, goal_id: goalId, title, is_done: false, created_at: new Date().toISOString() };
    setMilestones((prev) => [...prev, tempMs]);

    const { data } = await supabase.from("milestones").insert([{ goal_id: goalId, title, is_done: false, user_id: userId }]).select();
    if (data) setMilestones((prev) => prev.map((m) => (m.id === tempId ? data[0] : m)));
  };

  const toggleMilestone = async (id: string, current: boolean) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, is_done: !current } : m)));
    await supabase.from("milestones").update({ is_done: !current }).eq("id", id);
  };

  const deleteMilestone = async (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("milestones").delete().eq("id", id);
  };

  const getGoalTasks = (goalId: string) => tasks.filter((t) => t.goal_id === goalId);

  const addTaskToGoal = async (goalId: string) => {
    const title = taskInputs[goalId]?.trim();
    if (!title) return;
    setTaskInputs((prev) => ({ ...prev, [goalId]: "" }));
    const tempId = `temp-task-${Date.now()}`;
    const tempTask: Task = { id: tempId, title, is_done: false, goal_id: goalId };
    setTasks((prev) => [...prev, tempTask]);
    const { data } = await supabase
      .from("tasks")
      .insert([{ title, time: "Livre", is_done: false, priority: "normal", goal_id: goalId, user_id: userId }])
      .select();
    if (data) setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...data[0], goal_id: goalId } : t)));
  };

  const toggleGoalTask = async (id: string, current: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, is_done: !current } : t)));
    await supabase.from("tasks").update({ is_done: !current }).eq("id", id);
  };

  const deleteGoalTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  if (!mounted) return null;

  const activeGoals = goals.filter((g) => getProgress(g.id) < 100);
  const completedGoals = goals.filter((g) => getProgress(g.id) === 100);

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      {/* Background */}
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Nexus</h2>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Minhas Metas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeGoals.length} ativa{activeGoals.length !== 1 ? "s" : ""}
            {completedGoals.length > 0
              ? ` · ${completedGoals.length} concluída${completedGoals.length !== 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        <motion.button
          onClick={() => setShowModal(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-full font-medium shadow-[0_4px_20px_rgba(139,92,246,0.3)] transition-all text-sm w-fit"
        >
          <Plus size={17} />
          Nova Meta
        </motion.button>
      </motion.header>

      {/* Empty state */}
      {goals.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Target size={32} className="text-primary/50" />
          </div>
          <h3 className="text-xl font-semibold text-white/80 mb-2">Nenhuma meta ainda</h3>
          <p className="text-muted-foreground text-sm">
            Crie sua primeira meta para começar a acompanhar seu progresso.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            + Criar primeira meta
          </button>
        </motion.div>
      )}

      {/* Metas ativas */}
      {activeGoals.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Em andamento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {activeGoals.map((goal, idx) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                milestones={getMilestones(goal.id)}
                progress={getProgress(goal.id)}
                milestoneInput={milestoneInputs[goal.id] || ""}
                onMilestoneInputChange={(v) => setMilestoneInputs((prev) => ({ ...prev, [goal.id]: v }))}
                onAddMilestone={() => addMilestone(goal.id)}
                onToggleMilestone={toggleMilestone}
                onDeleteMilestone={deleteMilestone}
                onDeleteGoal={() => deleteGoal(goal.id)}
                goalTasks={getGoalTasks(goal.id)}
                taskInput={taskInputs[goal.id] || ""}
                onTaskInputChange={(v) => setTaskInputs((prev) => ({ ...prev, [goal.id]: v }))}
                onAddTask={() => addTaskToGoal(goal.id)}
                onToggleTask={toggleGoalTask}
                onDeleteTask={deleteGoalTask}
                delay={idx * 0.05}
              />
            ))}
          </div>
        </section>
      )}

      {/* Metas concluídas */}
      {completedGoals.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Concluídas 🎉
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {completedGoals.map((goal, idx) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                milestones={getMilestones(goal.id)}
                progress={100}
                milestoneInput={milestoneInputs[goal.id] || ""}
                onMilestoneInputChange={(v) => setMilestoneInputs((prev) => ({ ...prev, [goal.id]: v }))}
                onAddMilestone={() => addMilestone(goal.id)}
                onToggleMilestone={toggleMilestone}
                onDeleteMilestone={deleteMilestone}
                onDeleteGoal={() => deleteGoal(goal.id)}
                goalTasks={getGoalTasks(goal.id)}
                taskInput={taskInputs[goal.id] || ""}
                onTaskInputChange={(v) => setTaskInputs((prev) => ({ ...prev, [goal.id]: v }))}
                onAddTask={() => addTaskToGoal(goal.id)}
                onToggleTask={toggleGoalTask}
                onDeleteTask={deleteGoalTask}
                delay={idx * 0.05}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modal criar meta */}
      <AnimatePresence>
        {showModal && (
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
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <Flag size={22} className="text-primary" />
                Nova Meta
              </h2>

              <form onSubmit={handleCreateGoal} className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Qual é sua meta?
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Aprender a tocar violão"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Por que essa meta é importante para você?"
                    rows={2}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Prazo (opcional)
                  </label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2.5 block">Cor</label>
                  <div className="flex gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className="w-8 h-8 rounded-full transition-all hover:scale-110"
                        style={{
                          backgroundColor: c,
                          boxShadow:
                            newColor === c
                              ? `0 0 0 2px #121214, 0 0 0 4px ${c}`
                              : "none",
                          transform: newColor === c ? "scale(1.15)" : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="mt-2 w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar Meta
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── GoalCard ─── */

interface GoalCardProps {
  goal: Goal;
  milestones: Milestone[];
  progress: number;
  milestoneInput: string;
  onMilestoneInputChange: (v: string) => void;
  onAddMilestone: () => void;
  onToggleMilestone: (id: string, current: boolean) => void;
  onDeleteMilestone: (id: string) => void;
  onDeleteGoal: () => void;
  goalTasks: Task[];
  taskInput: string;
  onTaskInputChange: (v: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: string, current: boolean) => void;
  onDeleteTask: (id: string) => void;
  delay: number;
}

function GoalCard({
  goal,
  milestones,
  progress,
  milestoneInput,
  onMilestoneInputChange,
  onAddMilestone,
  onToggleMilestone,
  onDeleteMilestone,
  onDeleteGoal,
  goalTasks,
  taskInput,
  onTaskInputChange,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  delay,
}: GoalCardProps) {
  const done = milestones.filter((m) => m.is_done).length;
  const isComplete = progress === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5 flex flex-col gap-4 group relative overflow-hidden"
      style={{ borderTop: `2px solid ${goal.color}` }}
    >
      {/* Glow de fundo sutil */}
      <div
        className="absolute top-0 left-0 w-full h-24 opacity-5 pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${goal.color} 0%, transparent 100%)` }}
      />

      {/* Delete goal */}
      <button
        onClick={onDeleteGoal}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 z-10"
      >
        <Trash2 size={15} />
      </button>

      {/* Título */}
      <div className="pr-6 relative z-10">
        <div className="flex items-start gap-2 mb-1">
          <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: goal.color }} />
          <h3 className={`font-semibold text-white leading-snug ${isComplete ? "line-through opacity-60" : ""}`}>
            {goal.title}
          </h3>
        </div>
        {goal.description && (
          <p className="text-sm text-muted-foreground ml-4 leading-relaxed">{goal.description}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-muted-foreground">
            {milestones.length > 0 ? `${done}/${milestones.length} marcos` : "Sem marcos"}
          </span>
          <span className="text-xs font-bold" style={{ color: isComplete ? "#10b981" : goal.color }}>
            {isComplete ? "✓ Concluída" : `${progress}%`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: delay + 0.1 }}
            className="h-full rounded-full"
            style={{ backgroundColor: isComplete ? "#10b981" : goal.color }}
          />
        </div>
      </div>

      {/* Prazo */}
      {goal.target_date && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground relative z-10">
          <Calendar size={12} />
          <span>
            Prazo:{" "}
            {format(new Date(goal.target_date + "T12:00:00"), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="space-y-2 relative z-10">
          {milestones.map((ms) => (
            <div key={ms.id} className="flex items-center gap-2 group/ms">
              <button
                onClick={() => onToggleMilestone(ms.id, ms.is_done)}
                className="flex-shrink-0 text-muted-foreground hover:text-white transition-colors"
              >
                {ms.is_done ? (
                  <CheckCircle2 size={16} className="text-accent" />
                ) : (
                  <Circle size={16} />
                )}
              </button>
              <span
                className={`text-sm flex-1 leading-snug ${
                  ms.is_done ? "line-through text-muted-foreground" : "text-white/90"
                }`}
              >
                {ms.title}
              </span>
              <button
                onClick={() => onDeleteMilestone(ms.id)}
                className="opacity-0 group-hover/ms:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5 flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add milestone */}
      <div className="flex gap-2 pt-2 border-t border-white/5 relative z-10">
        <input
          type="text"
          value={milestoneInput}
          onChange={(e) => onMilestoneInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddMilestone()}
          placeholder="Adicionar marco…"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/40 outline-none"
        />
        <button
          onClick={onAddMilestone}
          disabled={!milestoneInput.trim()}
          className="text-muted-foreground hover:text-white disabled:opacity-20 transition-colors flex-shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tarefas vinculadas */}
      <div className="pt-3 border-t border-white/5 relative z-10">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ClipboardList size={11} /> Tarefas
          {goalTasks.length > 0 && (
            <span className="ml-1 text-xs font-semibold" style={{ color: goal.color }}>
              {goalTasks.filter(t => t.is_done).length}/{goalTasks.length}
            </span>
          )}
        </p>

        {goalTasks.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {goalTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 group/task">
                <button onClick={() => onToggleTask(t.id, t.is_done)} className="flex-shrink-0 text-muted-foreground hover:text-white transition-colors">
                  {t.is_done
                    ? <CheckCircle2 size={14} className="text-accent" />
                    : <Circle size={14} />}
                </button>
                <span className={`text-xs flex-1 ${t.is_done ? "line-through text-muted-foreground" : "text-white/80"}`}>
                  {t.title}
                </span>
                <button
                  onClick={() => onDeleteTask(t.id)}
                  className="opacity-0 group-hover/task:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5 flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => onTaskInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddTask()}
            placeholder="Adicionar tarefa…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-muted-foreground/40 outline-none"
          />
          <button
            onClick={onAddTask}
            disabled={!taskInput.trim()}
            className="text-muted-foreground hover:text-white disabled:opacity-20 transition-colors flex-shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

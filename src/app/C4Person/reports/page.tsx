"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart3,
  CheckSquare,
  Flame,
  Wallet,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Award,
} from "lucide-react";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const [tasks, setTasks]             = useState<any[]>([]);
  const [habits, setHabits]           = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [goals, setGoals]             = useState<any[]>([]);
  const [milestones, setMilestones]   = useState<any[]>([]);

  const weekStart = useMemo(
    () => startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  );
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("habits").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("goals").select("*"),
      supabase.from("milestones").select("*"),
    ]).then(([t, h, tr, g, ms]) => {
      if (t.data)  setTasks(t.data);
      if (h.data)  setHabits(h.data);
      if (tr.data) setTransactions(tr.data);
      if (g.data)  setGoals(g.data);
      if (ms.data) setMilestones(ms.data);
    });
  }, []);

  const inWeek = (dateStr: string) => {
    const d = new Date(dateStr);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  };

  // Tasks completed in week
  const tasksDone = useMemo(
    () => tasks.filter(t => t.is_done && t.updated_at && inWeek(t.updated_at)),
    [tasks, weekStart, weekEnd]
  );
  const tasksTotal = useMemo(
    () => tasks.filter(t => t.created_at && inWeek(t.created_at)),
    [tasks, weekStart, weekEnd]
  );

  // Habit completions in week
  const habitCompletions = useMemo(
    () => habits.filter(h => h.last_completed_date && inWeek(h.last_completed_date + "T12:00:00")),
    [habits, weekStart, weekEnd]
  );

  // Finances in week
  const weekTx = useMemo(
    () => transactions.filter(tx => inWeek(tx.created_at)),
    [transactions, weekStart, weekEnd]
  );
  const weekIncome  = weekTx.filter(tx => tx.type === "in").reduce((s, tx) => s + Number(tx.amount), 0);
  const weekExpense = weekTx.filter(tx => tx.type === "out").reduce((s, tx) => s + Number(tx.amount), 0);

  // Goals milestone progress
  const msCompleted = useMemo(
    () => milestones.filter(m => m.is_done && m.updated_at && inWeek(m.updated_at)).length,
    [milestones, weekStart, weekEnd]
  );

  // Productivity score (simple formula)
  const score = useMemo(() => {
    const tScore = tasksTotal.length > 0 ? Math.round((tasksDone.length / tasksTotal.length) * 40) : 0;
    const hScore = habits.length > 0 ? Math.round((habitCompletions.length / habits.length) * 40) : 0;
    const gScore = msCompleted > 0 ? Math.min(20, msCompleted * 5) : 0;
    return Math.min(100, tScore + hScore + gScore);
  }, [tasksDone, tasksTotal, habitCompletions, habits, msCompleted]);

  const scoreLabel = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Melhorar";
  const scoreColor = score >= 80 ? "text-accent" : score >= 60 ? "text-primary" : score >= 40 ? "text-yellow-400" : "text-red-400";

  const isCurrentWeek = weekOffset === 0;

  if (!mounted) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 left-[30%] w-[500px] h-[500px] bg-accent/6 rounded-full blur-[140px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Análise</h2>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Relatório Semanal</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} – {format(weekEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            disabled={isCurrentWeek}
            onClick={() => setWeekOffset(0)}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-white transition-all disabled:opacity-40"
          >
            Esta semana
          </button>
          <button
            disabled={isCurrentWeek}
            onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all disabled:opacity-40"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </motion.header>

      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card p-6 mb-6 flex items-center gap-6"
      >
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r="36" fill="none"
              stroke={score >= 80 ? "#10b981" : score >= 60 ? "#8b5cf6" : score >= 40 ? "#eab308" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - score / 100)}`}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
            <span className="text-[10px] text-muted-foreground">pts</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award size={18} className={scoreColor} />
            <h3 className={`text-xl font-bold ${scoreColor}`}>{scoreLabel}</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {score >= 80
              ? "Semana incrível! Você está no caminho certo para seus objetivos."
              : score >= 60
              ? "Boa semana! Há espaço para melhorar a consistência nos hábitos."
              : score >= 40
              ? "Semana ok. Tente completar mais tarefas e manter seus hábitos."
              : "Semana difícil. Que tal definir metas menores para a próxima?"}
          </p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          {
            icon: CheckSquare,
            label: "Tarefas Concluídas",
            value: `${tasksDone.length}/${tasksTotal.length}`,
            sub: tasksTotal.length > 0 ? `${Math.round((tasksDone.length / tasksTotal.length) * 100)}% de aproveitamento` : "Nenhuma tarefa",
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            icon: Flame,
            label: "Hábitos Mantidos",
            value: `${habitCompletions.length}/${habits.length}`,
            sub: habits.length > 0 ? `${Math.round((habitCompletions.length / habits.length) * 100)}% de consistência` : "Nenhum hábito",
            color: "text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            icon: weekIncome >= weekExpense ? TrendingUp : TrendingDown,
            label: "Saldo da Semana",
            value: `R$ ${(weekIncome - weekExpense).toFixed(2)}`,
            sub: `${weekTx.length} transaç${weekTx.length !== 1 ? "ões" : "ão"}`,
            color: weekIncome >= weekExpense ? "text-accent" : "text-red-400",
            bg: weekIncome >= weekExpense ? "bg-accent/10" : "bg-red-500/10",
          },
          {
            icon: Target,
            label: "Marcos Concluídos",
            value: String(msCompleted),
            sub: `em ${goals.length} meta${goals.length !== 1 ? "s" : ""}`,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-card p-5 flex flex-col gap-3"
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <Icon size={20} className={stat.color} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Finance breakdown */}
      {weekTx.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-6"
        >
          <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
            <Wallet size={18} className="text-accent" />
            Finanças da Semana
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-accent/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Receitas</p>
              <p className="text-xl font-bold text-accent">R$ {weekIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Despesas</p>
              <p className="text-xl font-bold text-red-400">R$ {weekExpense.toFixed(2)}</p>
            </div>
          </div>
          {/* Category breakdown */}
          {(() => {
            const byCategory: Record<string, number> = {};
            weekTx.filter(tx => tx.type === "out").forEach(tx => {
              byCategory[tx.category] = (byCategory[tx.category] ?? 0) + Number(tx.amount);
            });
            const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a).slice(0, 5);
            if (sorted.length === 0) return null;
            const max = sorted[0][1];
            return (
              <div className="space-y-3">
                {sorted.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/80">{cat}</span>
                      <span className="text-muted-foreground">R$ {amt.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(amt / max) * 100}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full bg-red-400/60 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* Weekly productivity chart (tasks per day) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
          <BarChart3 size={18} className="text-primary" />
          Tarefas por Dia
        </h3>
        <div className="flex items-end gap-2 h-28">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);
            const dayTasks = tasks.filter(t => {
              if (!t.created_at) return false;
              const d = new Date(t.created_at);
              return d.getFullYear() === day.getFullYear() &&
                     d.getMonth() === day.getMonth() &&
                     d.getDate() === day.getDate();
            });
            const done = dayTasks.filter(t => t.is_done).length;
            const total = dayTasks.length;
            const maxHeight = 80;
            const barH = total > 0 ? Math.max(8, Math.round((total / Math.max(...Array.from({ length: 7 }, (_, j) => {
              const d2 = new Date(weekStart);
              d2.setDate(d2.getDate() + j);
              return tasks.filter(t => {
                if (!t.created_at) return false;
                const d = new Date(t.created_at);
                return d.getFullYear() === d2.getFullYear() && d.getMonth() === d2.getMonth() && d.getDate() === d2.getDate();
              }).length;
            }).concat(1))) * maxHeight)) : 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{total > 0 ? total : ""}</span>
                <div className="w-full rounded-t-lg overflow-hidden" style={{ height: barH }}>
                  <div
                    className="w-full rounded-t-lg bg-white/5"
                    style={{ height: "100%" }}
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: total > 0 ? `${(done / total) * 100}%` : "0%" }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                      className="w-full bg-primary rounded-t-lg"
                      style={{ marginTop: "auto" }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Roxo = concluídas · Cinza = pendentes
        </p>
      </motion.div>
    </div>
  );
}

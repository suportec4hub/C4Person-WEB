"use client";

import { useMemo } from "react";
import { format, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  habitId: string;
  habitName: string;
  streak: number;
  logs: string[]; // datas ISO no formato "yyyy-MM-dd"
}

const WEEKS = 14; // 14 semanas = ~3 meses
const today = new Date();
const start = subDays(today, WEEKS * 7 - 1);

function intensityClass(count: number): string {
  if (count === 0) return "bg-white/5";
  return "bg-primary shadow-[0_0_6px_rgba(139,92,246,0.5)]";
}

export function HabitHeatmap({ habitName, streak, logs }: Props) {
  const days = useMemo(() =>
    eachDayOfInterval({ start, end: today }),
    []
  );

  const logSet = useMemo(() => new Set(logs), [logs]);

  const weeks = useMemo(() => {
    const grid: Date[][] = [];
    let week: Date[] = [];
    // pad início da semana
    const startDay = days[0].getDay(); // 0=Dom
    for (let i = 0; i < startDay; i++) week.push(null as unknown as Date);
    for (const d of days) {
      week.push(d);
      if (week.length === 7) { grid.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null as unknown as Date);
      grid.push(week);
    }
    return grid;
  }, [days]);

  const totalDone = logSet.size;
  const pct = Math.round((totalDone / (WEEKS * 7)) * 100);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{habitName}</p>
          <p className="text-xs text-muted-foreground">{totalDone} dias nos últimos {WEEKS * 7} dias · {pct}%</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-orange-400 font-semibold">
          🔥 {streak} dias
        </div>
      </div>

      {/* Grid: dom → sáb nas linhas */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5" style={{ minWidth: WEEKS * 14 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="w-2.5 h-2.5" />;
                const iso = format(day, "yyyy-MM-dd");
                const done = logSet.has(iso);
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={di}
                    title={`${format(day, "d 'de' MMMM", { locale: ptBR })}${done ? " ✓" : ""}`}
                    className={`w-2.5 h-2.5 rounded-sm transition-all ${
                      done ? intensityClass(1) : "bg-white/5"
                    } ${isToday ? "ring-1 ring-white/30" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="w-2 h-2 rounded-sm bg-white/5" />
        <div className="w-2 h-2 rounded-sm bg-primary/40" />
        <div className="w-2 h-2 rounded-sm bg-primary" />
        <span>Mais</span>
      </div>
    </div>
  );
}

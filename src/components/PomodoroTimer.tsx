"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, X, Brain, Coffee } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MODES = {
  focus: { label: "Foco",        minutes: 25, color: "text-primary",     bg: "bg-primary/10",      border: "border-primary/30",      ring: "#8b5cf6" },
  short: { label: "Pausa Curta", minutes: 5,  color: "text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/30",  ring: "#10b981" },
  long:  { label: "Pausa Longa", minutes: 15, color: "text-blue-400",    bg: "bg-blue-500/10",     border: "border-blue-500/30",     ring: "#3b82f6" },
} as const;

type Mode = keyof typeof MODES;

export function PomodoroTimer() {
  const [open, setOpen]           = useState(false);
  const [mode, setMode]           = useState<Mode>("focus");
  const [timeLeft, setTimeLeft]   = useState(MODES.focus.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions]   = useState(0);
  const [finished, setFinished]   = useState(false);

  const totalSeconds  = MODES[mode].minutes * 60;
  const progress      = (timeLeft / totalSeconds) * 100;
  const mins          = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs          = String(timeLeft % 60).padStart(2, "0");
  const circumference = 2 * Math.PI * 52;
  const dashOffset    = circumference - (progress / 100) * circumference;
  const cur           = MODES[mode];

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx  = audioCtxRef.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1);
    } catch { /* permission denied or SSR */ }
  }, []);

  // Countdown
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Completion trigger
  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return;
    setIsRunning(false);
    setFinished(true);
    playBeep();
    if (mode === "focus") setSessions(s => s + 1);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("C4 Person · Pomodoro", {
        body: mode === "focus" ? "Sessão concluída! Hora de descansar." : "Pausa encerrada! Bora focar.",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTimeLeft(MODES[m].minutes * 60);
    setIsRunning(false);
    setFinished(false);
  };

  const reset = () => {
    setTimeLeft(MODES[mode].minutes * 60);
    setIsRunning(false);
    setFinished(false);
  };

  const startNext = () => {
    if (mode === "focus") {
      const nextMode = sessions % 4 === 0 && sessions > 0 ? "long" : "short";
      switchMode(nextMode);
    } else {
      switchMode("focus");
    }
  };

  const requestNotifications = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed right-4 z-40 w-12 h-12 rounded-full glass border border-white/10 shadow-lg flex items-center justify-center transition-colors ${
          isRunning ? "text-primary border-primary/30" : "text-muted-foreground hover:text-white"
        }`}
        style={{ bottom: "calc(max(5rem, env(safe-area-inset-bottom, 5rem)) + 4px)" }}
        title="Pomodoro"
      >
        {isRunning ? (
          <span className="text-[10px] font-bold font-mono text-primary leading-none">{mins}:{secs}</span>
        ) : (
          <Timer size={18} />
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 rounded-3xl p-6 w-full max-w-xs shadow-2xl relative"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Timer size={16} className="text-primary" />
                <h2 className="text-base font-bold text-white">Pomodoro</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                {sessions} sessão{sessions !== 1 ? "ões" : ""} concluída{sessions !== 1 ? "s" : ""}
              </p>

              {/* Mode tabs */}
              <div className="flex gap-1.5 mb-6">
                {(Object.keys(MODES) as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      mode === m
                        ? `${MODES[m].color} ${MODES[m].bg} ${MODES[m].border}`
                        : "text-muted-foreground bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {MODES[m].label}
                  </button>
                ))}
              </div>

              {/* Circular timer */}
              <div className="flex justify-center mb-6">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 116 116">
                    <circle cx="58" cy="58" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                      cx="58" cy="58" r="52" fill="none"
                      stroke={cur.ring}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      style={{ transition: isRunning ? "stroke-dashoffset 1s linear" : "stroke-dashoffset 0.3s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-mono font-bold ${cur.color}`}>{mins}:{secs}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{cur.label}</span>
                  </div>
                </div>
              </div>

              {/* Completion message */}
              <AnimatePresence>
                {finished && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-center text-xs font-semibold mb-4 py-2 rounded-xl ${cur.bg} ${cur.color} ${cur.border} border`}
                  >
                    {mode === "focus" ? "🎉 Sessão concluída! Descanse um pouco." : "✅ Pronto para focar novamente?"}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-5">
                <button
                  onClick={reset}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                >
                  <RotateCcw size={15} />
                </button>

                {finished ? (
                  <button
                    onClick={startNext}
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold shadow-lg transition-all hover:scale-105 ${cur.bg} ${cur.border} border-2 ${cur.color}`}
                  >
                    {mode === "focus" ? <Coffee size={22} /> : <Brain size={22} />}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsRunning(r => !r)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold shadow-lg transition-all hover:scale-105 ${cur.bg} ${cur.border} border-2 ${cur.color}`}
                  >
                    {isRunning ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                  </button>
                )}

                <button
                  onClick={requestNotifications}
                  title="Ativar notificações"
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                >
                  <Brain size={15} />
                </button>
              </div>

              {/* Session dots */}
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i < (sessions % 4) ? "bg-primary" : "bg-white/10"}`}
                  />
                ))}
              </div>
              <p className="text-center text-[10px] text-muted-foreground mt-1.5">
                {4 - (sessions % 4 || 4)} pomodoro{4 - (sessions % 4 || 4) !== 1 ? "s" : ""} até pausa longa
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

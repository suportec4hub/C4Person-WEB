"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, X, Coffee, Focus, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MODES = {
  focus: { label: "Foco",        minutes: 25, color: "text-primary",     bg: "bg-primary/10",      border: "border-primary/30",      ring: "#8b5cf6" },
  short: { label: "Pausa Curta", minutes: 5,  color: "text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/30",  ring: "#10b981" },
  long:  { label: "Pausa Longa", minutes: 15, color: "text-blue-400",    bg: "bg-blue-500/10",     border: "border-blue-500/30",     ring: "#3b82f6" },
} as const;

type Mode = keyof typeof MODES;

export function PomodoroTimer() {
  const [open, setOpen]               = useState(false);
  const [mode, setMode]               = useState<Mode>("focus");
  const [timeLeft, setTimeLeft]       = useState(MODES.focus.minutes * 60);
  const [isRunning, setIsRunning]     = useState(false);
  const [sessions, setSessions]       = useState(0);
  const [finished, setFinished]       = useState(false);
  const [showFocusInfo, setShowFocusInfo] = useState(false);
  const [notifPerm, setNotifPerm]     = useState<NotificationPermission>("default");

  const totalSeconds  = MODES[mode].minutes * 60;
  const progress      = (timeLeft / totalSeconds) * 100;
  const mins          = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs          = String(timeLeft % 60).padStart(2, "0");
  const circumference = 2 * Math.PI * 52;
  const dashOffset    = circumference - (progress / 100) * circumference;
  const cur           = MODES[mode];

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const wakeLockRef  = useRef<WakeLockSentinel | null>(null);

  // Lê permissão de notificações ao montar
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window)
      setNotifPerm(Notification.permission);
  }, []);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current)
        wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch { /* não suportado */ }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Re-adquire wake lock se a aba voltar ao foco (visibilidade)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isRunning) acquireWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isRunning, acquireWakeLock]);

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

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted")
      new Notification(title, { body, icon: "/icon-192.png" });
  }, []);

  // Completion trigger
  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return;
    setIsRunning(false);
    setFinished(true);
    releaseWakeLock();
    playBeep();
    if (mode === "focus") setSessions(s => s + 1);
    sendNotification(
      "C4 Person · Pomodoro",
      mode === "focus" ? "🎉 Sessão concluída! Hora de descansar." : "✅ Pausa encerrada! Bora focar."
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTimeLeft(MODES[m].minutes * 60);
    setIsRunning(false);
    setFinished(false);
    releaseWakeLock();
  };

  const reset = () => {
    setTimeLeft(MODES[mode].minutes * 60);
    setIsRunning(false);
    setFinished(false);
    releaseWakeLock();
  };

  const startNext = () => {
    if (mode === "focus") {
      const nextMode = sessions % 4 === 0 && sessions > 0 ? "long" : "short";
      switchMode(nextMode);
    } else {
      switchMode("focus");
    }
  };

  const handlePlayPause = async () => {
    const starting = !isRunning;
    setIsRunning(starting);
    if (starting) {
      await acquireWakeLock();
      sendNotification("C4 Person · Modo Foco ativo 🎯", `${MODES[mode].label} de ${MODES[mode].minutes} min iniciado. Silencia seu dispositivo!`);
    } else {
      await releaseWakeLock();
    }
  };

  const requestNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
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
                    {mode === "focus" ? <Coffee size={22} /> : <Focus size={22} />}
                  </button>
                ) : (
                  <button
                    onClick={handlePlayPause}
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold shadow-lg transition-all hover:scale-105 ${cur.bg} ${cur.border} border-2 ${cur.color}`}
                  >
                    {isRunning ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                  </button>
                )}

                <button
                  onClick={() => setShowFocusInfo(v => !v)}
                  title="Modo Foco nos dispositivos"
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                    showFocusInfo
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Info size={15} />
                </button>
              </div>

              {/* Focus Mode Info Panel */}
              <AnimatePresence>
                {showFocusInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-[11px] text-muted-foreground space-y-2">
                      <p className="text-white font-semibold text-xs flex items-center gap-1.5">
                        <Focus size={12} className="text-primary" /> Como ativar o Modo Foco automático
                      </p>
                      {notifPerm !== "granted" && (
                        <button
                          onClick={requestNotifications}
                          className="w-full py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/30 transition-all"
                        >
                          🔔 Permitir notificações (obrigatório)
                        </button>
                      )}
                      {notifPerm === "granted" && (
                        <p className="text-emerald-400">✓ Notificações ativadas</p>
                      )}
                      <div className="space-y-1.5 pt-1 border-t border-white/10">
                        <p className="font-medium text-white/70">📱 iPhone / iPad</p>
                        <p>Ajustes → Foco → Adicionar Foco → Trabalho → Permitir notificações do Chrome/Safari</p>
                        <p className="font-medium text-white/70">🤖 Android</p>
                        <p>Configurações → Modo Foco → Adicionar ao horário OU use o app Rotinas para ativar ao receber notificação do C4Person</p>
                        <p className="font-medium text-white/70">💻 Windows</p>
                        <p>Configurações → Sistema → Assistência de Foco → Ativar quando estiver em tela cheia (o Pomodoro bloqueia a tela)</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, RotateCcw } from "lucide-react";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  undoFn?: () => void;
  undoLabel?: string;
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void;
  undoToast: (message: string, undoFn: () => void) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  undoToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
const COLOR = {
  success: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  error:   "text-red-400    border-red-500/20    bg-red-500/10",
  info:    "text-primary    border-primary/20    bg-primary/10",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { ...opts, id }]);
    timers.current[id] = setTimeout(() => dismiss(id), opts.undoFn ? 5000 : 3000);
  }, [dismiss]);

  const undoToast = useCallback((message: string, undoFn: () => void) => {
    toast({ message, type: "info", undoFn, undoLabel: "Desfazer" });
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, undoToast }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = ICON[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md bg-card/90 text-sm font-medium max-w-xs ${COLOR[t.type]}`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 text-white/90">{t.message}</span>
                {t.undoFn && (
                  <button
                    onClick={() => { t.undoFn!(); dismiss(t.id); }}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex-shrink-0 border border-primary/30 rounded-lg px-2 py-0.5"
                  >
                    <RotateCcw size={11} /> {t.undoLabel ?? "Desfazer"}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

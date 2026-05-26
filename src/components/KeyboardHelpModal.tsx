"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { section: "Geral" },
  { keys: ["Cmd", "K"],    desc: "Busca global" },
  { keys: ["?"],           desc: "Mostrar atalhos de teclado" },
  { section: "Dashboard" },
  { keys: ["N"],           desc: "Nova tarefa" },
  { keys: ["H"],           desc: "Novo hábito" },
  { section: "Navegação" },
  { keys: ["Esc"],         desc: "Fechar modal / busca" },
  { section: "Gravador" },
  { keys: ["Enter"],       desc: "Confirmar / salvar" },
  { keys: ["Esc"],         desc: "Cancelar" },
];

export function KeyboardHelpModal({ open, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Keyboard size={18} className="text-primary" />
                Atalhos de Teclado
              </h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {SHORTCUTS.map((s, i) => {
                if ("section" in s && !("keys" in s)) {
                  return (
                    <p key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-2">
                      {s.section}
                    </p>
                  );
                }
                const item = s as { keys: string[]; desc: string };
                return (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-white/80">{item.desc}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, j) => (
                        <span key={j}>
                          <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono text-muted-foreground bg-white/5 border border-white/10 rounded-md">
                            {k}
                          </kbd>
                          {j < item.keys.length - 1 && <span className="text-muted-foreground text-xs mx-0.5">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-white/5">
              <p className="text-xs text-muted-foreground text-center">
                Pressione <kbd className="font-mono px-1 py-0.5 bg-white/5 border border-white/10 rounded text-xs">?</kbd> a qualquer momento para abrir este painel
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

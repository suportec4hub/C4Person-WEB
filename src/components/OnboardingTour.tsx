"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Target, Wallet, X } from "lucide-react";

const STEPS = [
  {
    icon: CheckCircle2,
    color: "text-primary",
    bg: "bg-primary/15",
    title: "Bem-vindo ao C4Person!",
    description: "Seu sistema pessoal de produtividade. Aqui você gerencia tarefas, hábitos, metas e finanças em um só lugar.",
    hint: "Use a tecla N para criar uma nova tarefa rapidamente.",
  },
  {
    icon: Target,
    color: "text-accent",
    bg: "bg-accent/15",
    title: "Defina suas Metas",
    description: "No módulo Meta, crie grandes objetivos e divida-os em marcos menores. Acompanhe seu progresso visualmente.",
    hint: "Acesse pelo menu lateral → Meta.",
  },
  {
    icon: Wallet,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    title: "Controle Financeiro",
    description: "Registre receitas e despesas, defina orçamentos por categoria e exporte seus dados em CSV para análise.",
    hint: "Acesse pelo menu lateral → Finanças.",
  },
];

const STORAGE_KEY = "c4person_onboarding_done";

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // storage blocked
    }
  }, []);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -20 }}
          transition={{ duration: 0.25 }}
          className="bg-card border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative"
        >
          <button
            onClick={finish}
            className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Step dots */}
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-white/20"}`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl ${current.bg} flex items-center justify-center mb-5`}>
            <Icon size={26} className={current.color} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.description}</p>
          <p className="text-xs text-primary/70 bg-primary/8 rounded-lg px-3 py-2 mb-6">{current.hint}</p>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              >
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
            >
              {step < STEPS.length - 1 ? "Próximo →" : "Começar!"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

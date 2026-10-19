"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookie_consent")) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = (all: boolean) => {
    try {
      localStorage.setItem("cookie_consent", all ? "all" : "essential");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto bg-card border border-white/10 rounded-2xl p-5 shadow-[0_-4px_40px_rgba(0,0,0,0.4)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 leading-relaxed">
            Usamos cookies essenciais para o funcionamento do sistema e, com sua
            autorização, cookies de analytics para melhorar a experiência.
            Conforme a{" "}
            <Link
              href="/politica-privacidade"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              LGPD (Lei 13.709/18)
            </Link>
            , você tem controle sobre seus dados.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-white/15 text-muted-foreground hover:text-white transition-colors whitespace-nowrap"
          >
            Só essenciais
          </button>
          <button
            onClick={() => accept(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary/90 text-white transition-colors whitespace-nowrap"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}

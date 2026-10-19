"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CreditCard, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AssinarSignOut() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mx-auto"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <LogOut size={14} />
      )}
      Entrar com outra conta
    </button>
  );
}

export function AssinarActions({ hasCpf = false }: { hasCpf?: boolean }) {
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setCpfError("");
    const digits = cpf.replace(/\D/g, "");
    if (!hasCpf) {
      if (digits.length !== 11) {
        setCpfError("Informe um CPF válido (11 dígitos).");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: digits || undefined }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Erro ao iniciar pagamento. Tente novamente.");
      }
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!hasCpf && (
        <div>
          <div className="relative">
            <CreditCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={cpf}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                const formatted = digits
                  .replace(/(\d{3})(\d)/, "$1.$2")
                  .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                  .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
                setCpf(formatted);
                setCpfError("");
              }}
              placeholder="Seu CPF (obrigatório)"
              inputMode="numeric"
              className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          {cpfError && (
            <p className="text-xs text-red-400 mt-1.5">{cpfError}</p>
          )}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> Aguarde...</>
        ) : (
          <>Assinar agora <ArrowRight size={16} /></>
        )}
      </button>
    </div>
  );
}

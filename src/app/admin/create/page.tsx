"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, Mail, Lock, Shield, CheckCircle2 } from "lucide-react";

export default function AdminCreatePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (res.status === 403) { router.replace("/C4Person"); return; }
      setError(data.error || "Erro ao criar usuário.");
      return;
    }

    setSuccess(true);
    setFullName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Criar Admin</h1>
        <p className="text-muted-foreground mt-1">Novo usuário com acesso ao painel admin</p>
      </div>

      <div className="bg-card border border-white/8 rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-7 pb-6 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Shield size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Usuário Admin</p>
            <p className="text-muted-foreground text-xs">Acesso total ao painel administrativo</p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-sm font-medium">Admin criado com sucesso!</p>
          </div>
        )}

        {error && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-5">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nome completo</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo"
                className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-red-500 hover:bg-red-500/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : <><Shield size={16} /> Criar Admin</>}
          </button>
        </form>
      </div>
    </div>
  );
}

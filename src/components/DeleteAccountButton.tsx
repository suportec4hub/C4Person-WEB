"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao excluir conta.");
        setLoading(false);
        return;
      }
      router.push("/login");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-sm font-medium"
      >
        <Trash2 size={15} />
        Excluir minha conta (LGPD)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-5 space-y-4">
      <p className="text-sm text-white/90 leading-relaxed">
        <span className="font-semibold text-red-400">Atenção:</span> esta ação é
        irreversível. Todos os seus dados (tarefas, hábitos, metas, notas e
        finanças) serão excluídos permanentemente, conforme a LGPD (art. 18, IV).
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => { setConfirming(false); setError(""); }}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {loading ? "Excluindo…" : "Confirmar exclusão"}
        </button>
      </div>
    </div>
  );
}

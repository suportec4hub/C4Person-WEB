"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, CheckCircle2, XCircle, Shield, User } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  confirmed: boolean;
  subscription: { status: string; plan: string; current_period_end: string } | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => { if (r.status === 403) { router.replace("/C4Person"); return null; } return r.json(); })
      .then((d) => { if (d) setUsers(d.users); })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q)
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Usuários</h1>
          <p className="text-muted-foreground mt-1">{users.length} cadastrados</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="bg-card border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-72"
          />
        </div>
      </div>

      <div className="bg-card border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-muted-foreground">
              <th className="text-left px-5 py-3.5 font-medium">Usuário</th>
              <th className="text-left px-5 py-3.5 font-medium">Role</th>
              <th className="text-left px-5 py-3.5 font-medium">Cadastro</th>
              <th className="text-left px-5 py-3.5 font-medium">Email</th>
              <th className="text-left px-5 py-3.5 font-medium">Assinatura</th>
              <th className="text-left px-5 py-3.5 font-medium">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr
                key={u.id}
                className={`border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
              >
                <td className="px-5 py-4">
                  <div>
                    <p className="text-white font-medium">{u.full_name || "—"}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{u.email}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {u.role === "admin" ? (
                    <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                      <Shield size={11} /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                      <User size={11} /> Usuário
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-4">
                  {u.confirmed
                    ? <CheckCircle2 size={16} className="text-emerald-400" />
                    : <XCircle size={16} className="text-muted-foreground" />}
                </td>
                <td className="px-5 py-4">
                  {u.subscription?.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={11} /> Ativa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                      Sem assinatura
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-muted-foreground text-xs">
                  {u.subscription?.current_period_end
                    ? new Date(u.subscription.current_period_end).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

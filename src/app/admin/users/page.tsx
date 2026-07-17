"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, CheckCircle2, XCircle, Shield, User,
  ToggleLeft, ToggleRight, Crown, AlertCircle, Trash2, Pencil, X,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  confirmed: boolean;
  trial_ends_at: string | null;
  subscription: { status: string; plan: string; current_period_end: string } | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN_C4HUB: { label: "Admin C4Hub", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  ADM_PADRAO:  { label: "ADM Padrão",  color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  user:        { label: "Usuário",      color: "text-muted-foreground bg-white/5 border-white/10" },
  admin:       { label: "Admin",        color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSaved, setRoleSaved] = useState<string | null>(null);

  /* ── delete state ── */
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── edit state ── */
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (r.status === 403) { router.replace("/C4Person"); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setUsers(d.users);
          if (d.currentUserId) setCurrentAdminId(d.currentUserId);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const toggleSubscription = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setToggling(userId);
    await fetch(`/api/admin/users/${userId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, subscription: { ...(u.subscription ?? { plan: "pro", current_period_end: "" }), status: newStatus } }
          : u
      )
    );
    setToggling(null);
  };

  const changeRole = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    setRoleError(null);
    setRoleSaved(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setRoleError(data.error ?? `Erro ${res.status}`); return; }
      const verify = await fetch("/api/admin/users");
      if (verify.ok) { const fresh = await verify.json(); setUsers(fresh.users); }
      else { setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u)); }
      setRoleSaved(userId);
      setTimeout(() => setRoleSaved(null), 2000);
    } catch {
      setRoleError("Erro de rede ao salvar role.");
    } finally {
      setChangingRole(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setDeleteError(data.error ?? "Erro ao excluir."); setDeleting(false); return; }
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setEditName(u.full_name ?? "");
    setEditEmail(u.email ?? "");
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: editName, email: editEmail }),
    });
    const data = await res.json();
    if (!res.ok) { setSaveError(data.error ?? "Erro ao salvar."); setSaving(false); return; }
    setUsers((prev) =>
      prev.map((u) => u.id === editTarget.id
        ? { ...u, full_name: editName.trim() || null, email: editEmail.trim() || u.email }
        : u
      )
    );
    setEditTarget(null);
    setSaving(false);
  };

  const getTrialLabel = (u: UserRow) => {
    if (u.subscription?.status === "active") return null;
    if (!u.trial_ends_at) return null;
    const daysLeft = Math.ceil((new Date(u.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? `Trial: ${daysLeft}d` : "Trial expirado";
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
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

      {roleError && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={16} />
          <span>Erro ao salvar role: <strong>{roleError}</strong></span>
          <button onClick={() => setRoleError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      <div className="bg-card border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3.5 font-medium">Usuário</th>
              <th className="text-left px-5 py-3.5 font-medium">Role</th>
              <th className="text-left px-5 py-3.5 font-medium">Cadastro</th>
              <th className="text-left px-5 py-3.5 font-medium">E-mail</th>
              <th className="text-left px-5 py-3.5 font-medium">Vencimento</th>
              <th className="text-left px-5 py-3.5 font-medium">Assinatura</th>
              <th className="text-left px-5 py-3.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isActive = u.subscription?.status === "active";
              const isTogglingThis = toggling === u.id;
              const isChangingRoleThis = changingRole === u.id;
              const justSaved = roleSaved === u.id;
              const roleInfo = ROLE_LABELS[u.role] ?? ROLE_LABELS.user;
              const trialLabel = getTrialLabel(u);
              const isSelf = currentAdminId === u.id;
              const isProtected = u.role === "ADMIN_C4HUB" || u.role === "admin";

              return (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-white font-medium">{u.full_name || "—"}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{u.email}</p>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 border text-xs font-semibold px-2.5 py-1 rounded-full ${roleInfo.color}`}>
                        {u.role === "ADMIN_C4HUB" || u.role === "admin"
                          ? <Shield size={11} />
                          : u.role === "ADM_PADRAO"
                            ? <Crown size={11} />
                            : <User size={11} />}
                        {roleInfo.label}
                      </span>
                      {isChangingRoleThis
                        ? <Loader2 size={12} className="animate-spin text-muted-foreground" />
                        : (
                          <>
                            <select
                              value={u.role === "admin" ? "ADMIN_C4HUB" : u.role}
                              onChange={(e) => changeRole(u.id, e.target.value)}
                              className="bg-background border border-white/10 text-muted-foreground text-xs rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-primary/50 cursor-pointer"
                            >
                              <option value="user">Usuário</option>
                              <option value="ADM_PADRAO">ADM Padrão</option>
                              <option value="ADMIN_C4HUB">Admin C4Hub</option>
                            </select>
                            {justSaved && (
                              <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                            )}
                          </>
                        )}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>

                  <td className="px-5 py-4">
                    {u.confirmed
                      ? <CheckCircle2 size={16} className="text-emerald-400" />
                      : <XCircle size={16} className="text-muted-foreground" />}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground text-xs">
                    {u.subscription?.current_period_end
                      ? new Date(u.subscription.current_period_end).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <button
                        onClick={() => toggleSubscription(u.id, u.subscription?.status ?? "inactive")}
                        disabled={isTogglingThis}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          isActive
                            ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        {isTogglingThis ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : isActive ? (
                          <ToggleRight size={15} />
                        ) : (
                          <ToggleLeft size={15} />
                        )}
                        {isActive ? "Pago" : "Sem assinatura"}
                      </button>
                      {trialLabel && (
                        <span className={`text-xs px-1 ${trialLabel.includes("expirado") ? "text-red-400" : "text-amber-400"}`}>
                          {trialLabel}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        title="Editar usuário"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(u); setDeleteError(null); }}
                        disabled={isSelf || isProtected}
                        title={isSelf ? "Não pode excluir a si mesmo" : isProtected ? "Admin C4Hub não pode ser excluído" : "Excluir usuário"}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-muted-foreground"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteError(null); } }}
        >
          <div className="bg-card border border-white/10 rounded-2xl p-7 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1">Excluir usuário?</h2>
            <p className="text-sm text-muted-foreground mb-1">Esta ação é permanente e não pode ser desfeita.</p>
            <div className="mt-3 mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm font-semibold text-white">{deleteTarget.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{deleteTarget.email}</p>
            </div>

            {deleteError && (
              <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-500/90 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}
        >
          <div className="bg-card border border-white/10 rounded-2xl p-7 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setEditTarget(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Pencil size={18} className="text-primary" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1">Editar usuário</h2>
            <p className="text-xs text-muted-foreground mb-5">{editTarget.email}</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do usuário"
                  autoFocus
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-1">Altera o e-mail de login do usuário.</p>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {saveError}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

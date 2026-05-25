"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { UserCircle, Mail, Calendar, Shield, Edit2, Check, X, LogOut, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  role: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface Subscription {
  status: string | null;
  created_at: string | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN_C4HUB: { label: "Admin C4Hub",  color: "text-red-400",    bg: "bg-red-500/10" },
  ADM_PADRAO:  { label: "Admin Padrão", color: "text-orange-400", bg: "bg-orange-500/10" },
  user:        { label: "Usuário",       color: "text-primary",    bg: "bg-primary/10" },
};

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  return email[0].toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted]           = useState(false);
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [email, setEmail]               = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const [editingName, setEditingName]     = useState(false);
  const [editingBirth, setEditingBirth]   = useState(false);
  const [draftName, setDraftName]         = useState("");
  const [draftBirth, setDraftBirth]       = useState("");
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");

      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) {
        setProfile(p as Profile);
        setDraftName(p.full_name ?? "");
        setDraftBirth(p.birth_date ?? "");
      }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, created_at")
        .eq("user_id", user.id)
        .single();
      if (sub) setSubscription(sub as Subscription);
    });
  }, []);

  const saveName = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ full_name: draftName.trim() || null }).eq("id", profile.id);
    setProfile(prev => prev ? { ...prev, full_name: draftName.trim() || null } : prev);
    setEditingName(false);
    setSaving(false);
  };

  const saveBirth = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ birth_date: draftBirth || null }).eq("id", profile.id);
    setProfile(prev => prev ? { ...prev, birth_date: draftBirth || null } : prev);
    setEditingBirth(false);
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!mounted || !profile) return null;

  const role      = profile.role ?? "user";
  const roleInfo  = ROLE_LABELS[role] ?? ROLE_LABELS.user;
  const initials  = getInitials(profile.full_name, email);
  const isActive  = subscription?.status === "active";
  const trialEnd  = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const inTrial   = trialEnd && new Date() < trialEnd;
  const daysLeft  = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 left-[30%] w-[400px] h-[400px] bg-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Conta</h2>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Meu Perfil</h1>
      </motion.header>

      <div className="max-w-2xl space-y-5">

        {/* Avatar + name card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card p-6 flex items-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-2xl shadow-[0_0_20px_rgba(139,92,246,0.4)] flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-lg font-semibold focus:outline-none focus:border-primary/50"
                  placeholder="Seu nome"
                />
                <button onClick={saveName} disabled={saving} className="text-emerald-400 hover:text-emerald-300 p-1">
                  <Check size={18} />
                </button>
                <button onClick={() => { setEditingName(false); setDraftName(profile.full_name ?? ""); }} className="text-muted-foreground hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-xl font-bold text-white truncate">
                  {profile.full_name || "Sem nome"}
                </h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white transition-all p-1"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mt-1 ${roleInfo.bg} ${roleInfo.color}`}>
              <Shield size={11} />
              {roleInfo.label}
            </span>
          </div>
        </motion.div>

        {/* Info fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 space-y-5"
        >
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Informações da Conta</h3>

          {/* Email */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
              <p className="text-sm text-white truncate">{email}</p>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Birth date */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Calendar size={16} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Data de Nascimento</p>
              {editingBirth ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    autoFocus
                    value={draftBirth}
                    onChange={e => setDraftBirth(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveBirth(); if (e.key === "Escape") setEditingBirth(false); }}
                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-primary/50"
                  />
                  <button onClick={saveBirth} disabled={saving} className="text-emerald-400 hover:text-emerald-300 p-1">
                    <Check size={16} />
                  </button>
                  <button onClick={() => { setEditingBirth(false); setDraftBirth(profile.birth_date ?? ""); }} className="text-muted-foreground hover:text-white p-1">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <p className="text-sm text-white">
                    {profile.birth_date
                      ? format(new Date(profile.birth_date + "T12:00:00"), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                  <button
                    onClick={() => setEditingBirth(true)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white transition-all p-1"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Member since */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <UserCircle size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Membro desde</p>
              <p className="text-sm text-white">
                {format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Subscription status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card p-6"
        >
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Assinatura</h3>
          <div className="flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
              <CreditCard size={16} className={isActive ? "text-emerald-400" : "text-amber-400"} />
            </div>
            <div className="flex-1">
              {isActive ? (
                <>
                  <p className="text-sm font-semibold text-emerald-400">Plano Ativo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subscription?.created_at
                      ? `Assinante desde ${format(new Date(subscription.created_at), "MMMM 'de' yyyy", { locale: ptBR })}`
                      : "Acesso completo à plataforma"}
                  </p>
                </>
              ) : role === "ADMIN_C4HUB" || role === "ADM_PADRAO" ? (
                <>
                  <p className="text-sm font-semibold text-primary">Acesso Administrativo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Acesso completo sem assinatura</p>
                </>
              ) : inTrial ? (
                <>
                  <p className="text-sm font-semibold text-amber-400">Período de Teste</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-400">Sem Assinatura</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Assine para continuar usando</p>
                </>
              )}
            </div>
            {!isActive && role === "user" && (
              <a
                href="/assinar"
                className="text-xs font-medium bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary/30 transition-colors"
              >
                Assinar
              </a>
            )}
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-sm font-medium"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </motion.div>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CreditCard, UserCheck, TrendingUp, Loader2 } from "lucide-react";

interface Stats {
  totalUsers: number;
  activeSubs: number;
  newThisMonth: number;
  totalSubs: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => { if (r.status === 403) { router.replace("/C4Person"); return null; } return r.json(); })
      .then((d) => { if (d) setStats(d); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  const cards = [
    { label: "Total de Usuários",     value: stats?.totalUsers,    icon: Users,      color: "text-primary",    bg: "bg-primary/10 border-primary/20" },
    { label: "Assinaturas Ativas",    value: stats?.activeSubs,    icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    { label: "Novos este mês",        value: stats?.newThisMonth,  icon: TrendingUp, color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20" },
    { label: "Total de Assinaturas",  value: stats?.totalSubs,     icon: UserCheck,  color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Painel Admin</h1>
        <p className="text-muted-foreground mt-1">Visão geral do C4 Person</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-white/8 rounded-2xl p-6">
            <div className={`w-11 h-11 rounded-xl border ${bg} flex items-center justify-center mb-4`}>
              <Icon size={22} className={color} />
            </div>
            <p className="text-muted-foreground text-sm mb-1">{label}</p>
            <p className="text-4xl font-black text-white">{value ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

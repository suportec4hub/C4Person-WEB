"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, CreditCard, UserCheck, TrendingUp, Loader2,
  Activity, Eye, BarChart2, Clock, RefreshCw,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  activeSubs: number;
  newThisMonth: number;
  totalSubs: number;
}

interface Analytics {
  onlineNow: number;
  activeToday: number;
  activeThisWeek: number;
  pageViewsToday: number;
  topPages: { page: string; count: number }[];
  hourlyCounts: { hour: number; count: number }[];
  dailyLast14: { date: string; count: number }[];
  userActivity: {
    userId: string;
    email: string;
    name: string | null;
    views: number;
    uniquePages: number;
    lastSeen: string;
  }[];
}

function pageLabel(page: string) {
  const map: Record<string, string> = {
    "/C4Person": "Dashboard",
    "/C4Person/goals": "Metas",
    "/C4Person/finance": "Finanças",
    "/C4Person/notes": "Notas",
    "/C4Person/calendar": "Calendário",
    "/C4Person/reports": "Relatório",
    "/C4Person/profile": "Perfil",
    "/C4Person/finance/bolsa": "Bolsa",
  };
  return map[page] ?? page.replace("/C4Person/", "").replace("/C4Person", "Dashboard");
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function HourlyChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const now = new Date().getHours();
  return (
    <div className="flex items-end gap-[3px] h-16 w-full">
      {data.map(({ hour, count }) => (
        <div key={hour} className="flex flex-col items-center gap-0.5 flex-1" title={`${hour}h: ${count} views`}>
          <div
            className={`w-full rounded-sm transition-all ${hour === now ? "bg-primary" : "bg-white/15 hover:bg-white/25"}`}
            style={{ height: `${Math.max((count / max) * 100, count > 0 ? 8 : 2)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {data.map(({ date, count }) => (
        <div
          key={date}
          className="flex-1 rounded-sm bg-primary/60 hover:bg-primary transition-all cursor-default"
          style={{ height: `${Math.max((count / max) * 100, count > 0 ? 10 : 3)}%` }}
          title={`${date}: ${count} usuários ativos`}
        />
      ))}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats]         = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/analytics"),
      ]);
      if (statsRes.status === 403) { router.replace("/C4Person"); return; }
      const [statsData, analyticsData] = await Promise.all([statsRes.json(), analyticsRes.json()]);
      setStats(statsData);
      setAnalytics(analyticsData);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  const statCards = [
    { label: "Total de Usuários",    value: stats?.totalUsers,   icon: Users,      color: "text-primary",    bg: "bg-primary/10 border-primary/20" },
    { label: "Assinaturas Ativas",   value: stats?.activeSubs,   icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    { label: "Novos este mês",       value: stats?.newThisMonth, icon: TrendingUp, color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20" },
    { label: "Total de Assinaturas", value: stats?.totalSubs,    icon: UserCheck,  color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Painel Admin</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do C4 Person
            {lastUpdated && (
              <span className="ml-2 text-xs">· atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-muted-foreground hover:text-white transition-all border border-white/8"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* ── User Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-white/8 rounded-2xl p-6">
            <div className={`w-11 h-11 rounded-xl border ${bg} flex items-center justify-center mb-4`}>
              <Icon size={22} className={color} />
            </div>
            <p className="text-muted-foreground text-sm mb-1">{label}</p>
            <p className="text-4xl font-black text-white">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* ── Real-time Analytics ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          Analytics em Tempo Real
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Online Now */}
          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Online agora</p>
            </div>
            <p className="text-4xl font-black text-emerald-400">{analytics?.onlineNow ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">últimos 2 min</p>
          </div>

          {/* Active Today */}
          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-blue-400" />
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativos hoje</p>
            </div>
            <p className="text-4xl font-black text-blue-400">{analytics?.activeToday ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">usuários únicos</p>
          </div>

          {/* Active this week */}
          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-purple-400" />
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativos 7 dias</p>
            </div>
            <p className="text-4xl font-black text-purple-400">{analytics?.activeThisWeek ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">usuários únicos</p>
          </div>

          {/* Page Views today */}
          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-orange-400" />
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Views hoje</p>
            </div>
            <p className="text-4xl font-black text-orange-400">{analytics?.pageViewsToday ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">page views</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Hourly chart */}
          <div className="lg:col-span-2 bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-primary" />
              <p className="text-sm font-semibold text-white">Atividade por hora (hoje)</p>
            </div>
            {analytics?.hourlyCounts ? (
              <>
                <HourlyChart data={analytics.hourlyCounts} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-muted-foreground">0h</span>
                  <span className="text-[9px] text-muted-foreground">12h</span>
                  <span className="text-[9px] text-muted-foreground">23h</span>
                </div>
              </>
            ) : (
              <div className="h-16 flex items-center justify-center text-muted-foreground text-xs">Sem dados ainda</div>
            )}
          </div>

          {/* Top pages */}
          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={15} className="text-primary" />
              <p className="text-sm font-semibold text-white">Top páginas hoje</p>
            </div>
            {analytics?.topPages?.length ? (
              <div className="space-y-2">
                {analytics.topPages.map(({ page, count }, i) => {
                  const maxCount = analytics.topPages[0].count;
                  return (
                    <div key={page} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-white truncate">{pageLabel(page)}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            )}
          </div>
        </div>

        {/* 14-day sparkline */}
        <div className="bg-card border border-white/8 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" />
              <p className="text-sm font-semibold text-white">Usuários ativos — últimos 14 dias</p>
            </div>
            {analytics?.dailyLast14 && (
              <span className="text-xs text-muted-foreground">
                pico: {Math.max(...analytics.dailyLast14.map(d => d.count))} usuários
              </span>
            )}
          </div>
          {analytics?.dailyLast14 ? (
            <>
              <Sparkline data={analytics.dailyLast14} />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">{analytics.dailyLast14[0]?.date?.slice(5)}</span>
                <span className="text-[9px] text-muted-foreground">hoje</span>
              </div>
            </>
          ) : (
            <div className="h-8 flex items-center justify-center text-muted-foreground text-xs">Sem dados ainda</div>
          )}
        </div>
      </div>

      {/* ── User Activity Table ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          Atividade por Usuário (últimos 7 dias)
        </h2>
        <div className="bg-card border border-white/8 rounded-2xl overflow-hidden">
          {analytics?.userActivity?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Views</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Páginas únicas</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Último acesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {analytics.userActivity.map((u, i) => (
                    <tr key={u.userId} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-5 py-3">
                        <div>
                          {u.name && <p className="text-white text-xs font-medium">{u.name}</p>}
                          <p className={`text-xs ${u.name ? "text-muted-foreground" : "text-white"}`}>{u.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-white font-semibold">{u.views}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-muted-foreground">{u.uniquePages}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-muted-foreground">{timeAgo(u.lastSeen)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Activity size={32} className="text-white/10" />
              <div>
                <p className="text-white/40 font-medium text-sm">Nenhum dado de atividade ainda</p>
                <p className="text-muted-foreground text-xs mt-1">Os dados aparecerão após os usuários navegarem pelo app</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

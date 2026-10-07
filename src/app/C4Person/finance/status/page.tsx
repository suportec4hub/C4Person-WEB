"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Activity, Server, ArrowRight, Clock,
  Wallet, TrendingUp, ChevronRight,
} from "lucide-react";

// ── Finance sub-nav ──────────────────────────────────────────────────────────
const FINANCE_TABS = [
  { href: "/C4Person/finance",        label: "Finanças",      icon: Wallet },
  { href: "/C4Person/finance/bolsa",  label: "Bolsa",         icon: TrendingUp },
  { href: "/C4Person/finance/status", label: "Status Bancos", icon: Activity },
];

function FinanceNav() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto -mx-1 px-1 mb-6 scrollbar-none">
      <div className="flex items-center gap-1 bg-white/3 border border-white/8 rounded-2xl p-1.5 w-fit min-w-max">
        {FINANCE_TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                active ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Types (matching Pluggy's actual API schema) ───────────────────────────────
interface Institution {
  pluggy_id: string;
  name: string;
  logo_url?: string;
  status: "online" | "degraded" | "partial_outage" | "major_outage" | string;
  uptime?: number;
  bars?: string;
  is_open_finance?: boolean;
  supports_data?: boolean;
}

interface IncidentUpdate {
  id: string;
  state: string;
  body: string;
  created_at: string;
}

interface Incident {
  id: string;
  kind: string;
  title: string;
  description?: string;
  product: string;
  severity: string;
  state: string; // "investigating" | "identified" | "monitoring" | "resolved"
  institution_name?: string;
  institutions?: { pluggy_id: string; institution_name: string }[];
  started_at?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  updates?: IncidentUpdate[];
}

interface Component {
  key: string;
  name: string;
  status: string;
  sort_order?: number;
}

interface Summary {
  status: "op" | "dg" | "pt" | "mj" | "mn" | string;
  labels: { pt: string; es: string; en: string };
  openIncidents: number;
  updatedAt: string;
}

interface Snapshot {
  generatedAt: string;
  institutions: Institution[];
  incidents: Incident[];
  components: Component[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const OVERALL_STATUS: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  op: { color: "#10b981", icon: CheckCircle2 },
  dg: { color: "#f59e0b", icon: AlertTriangle },
  pt: { color: "#ef4444", icon: AlertTriangle },
  mj: { color: "#dc2626", icon: XCircle },
  mn: { color: "#3b82f6", icon: Clock },
};

const STATE_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  investigating: { label: "Investigando",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  identified:    { label: "Identificado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  monitoring:    { label: "Monitorando",   color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  resolved:      { label: "Resolvido",     color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  operational:   { label: "Operacional",   color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  degraded:      { label: "Degradado",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  online:        { label: "Online",        color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
};

function getBadge(state: string) {
  const key = state?.toLowerCase?.();
  return STATE_BADGE[key] ?? { label: state ?? "—", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
}

function StateBadge({ state }: { state: string }) {
  const b = getBadge(state);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
      style={{ color: b.color, background: b.bg, borderColor: b.border }}>
      {b.label}
    </span>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  degraded: "#f59e0b", partial_outage: "#ef4444", major_outage: "#dc2626", operational: "#10b981",
};

function relDate(iso?: string | null) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd MMM, HH:mm", { locale: ptBR }); } catch { return iso; }
}

// ── Uptime bar (like the Pluggy status page) ──────────────────────────────────
function UptimeBars({ bars, uptime }: { bars?: string; uptime?: number }) {
  if (!bars && uptime == null) return null;
  // bars is a string like "GGGGGGGGGG..." where G=good, D=degraded, U=unavailable
  const segments = bars ? bars.split("") : [];
  const barColor = (c: string) =>
    c === "G" || c === "1" ? "#10b981" : c === "D" || c === "2" ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 shrink-0">
      {segments.length > 0 && (
        <div className="hidden sm:flex gap-px items-end h-5">
          {segments.slice(-30).map((c, i) => (
            <div key={i} className="w-1 rounded-sm" style={{ background: barColor(c), height: `${60 + Math.random() * 40}%`, opacity: 0.8 }} />
          ))}
        </div>
      )}
      {uptime != null && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{uptime.toFixed(2)}%</span>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PluggyStatusPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [showAllInstitutions, setShowAllInstitutions] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/pluggy/status");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.summary)  setSummary(json.summary);
      if (json.snapshot) setSnapshot(json.snapshot);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err.message ?? "Falha ao carregar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Active incidents only (state !== "resolved")
  const activeIncidents = (snapshot?.incidents ?? []).filter(i => i.state !== "resolved");

  // Institutions split
  const degradedInstitutions   = (snapshot?.institutions ?? []).filter(i => i.status !== "online");
  const operationalInstitutions = (snapshot?.institutions ?? []).filter(i => i.status === "online");

  // Overall
  const overallKey = summary?.status ?? (activeIncidents.length > 0 ? "dg" : "op");
  const { color: overallColor, icon: OverallIcon } = OVERALL_STATUS[overallKey] ?? OVERALL_STATUS.dg;
  const overallLabel = summary?.labels?.pt ?? (overallKey === "op" ? "Todos os sistemas operacionais" : "Degradação em algumas instituições");

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 relative">
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
      <FinanceNav />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Status dos Bancos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Disponibilidade das instituições via Pluggy
          </p>
        </div>
        <button onClick={fetchStatus} disabled={loading}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {loading && !summary && !snapshot && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/3 animate-pulse border border-white/5" />)}
        </div>
      )}

      {(summary || snapshot) && (
        <>
          {/* Overall status banner */}
          <div className="rounded-2xl p-5 mb-6 flex items-center gap-4 border"
            style={{ background: `${overallColor}10`, borderColor: `${overallColor}30` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${overallColor}20` }}>
              <OverallIcon size={22} style={{ color: overallColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{overallLabel}</p>
              {lastFetched && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atualizado {format(lastFetched, "HH:mm:ss")}
                  {summary?.updatedAt && ` · dados de ${relDate(summary.updatedAt)}`}
                </p>
              )}
            </div>
            <a href="https://status.pluggy.ai" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors shrink-0">
              status.pluggy.ai <ArrowRight size={11} />
            </a>
          </div>

          {/* Count boxes */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {[
              {
                label: "Operacionais",
                value: operationalInstitutions.length || (snapshot?.institutions.length ? snapshot.institutions.length - degradedInstitutions.length : "—"),
                color: "#10b981", icon: CheckCircle2,
              },
              {
                label: "Com incidente",
                value: summary?.openIncidents ?? activeIncidents.length,
                color: "#f59e0b", icon: AlertTriangle,
              },
              {
                label: "Em manutenção",
                value: activeIncidents.filter(i => i.kind === "maintenance").length,
                color: "#3b82f6", icon: Clock,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-3 sm:p-4 border flex flex-col items-center gap-1.5 sm:gap-2"
                style={{ background: `${color}08`, borderColor: `${color}20` }}>
                <Icon size={16} style={{ color }} className="hidden sm:block" />
                <p className="text-xl sm:text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[9px] sm:text-[11px] text-muted-foreground text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Active incidents */}
          {activeIncidents.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-white uppercase tracking-wider">Incidentes ativos</p>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {activeIncidents.length}
                </span>
              </div>
              <div className="space-y-2">
                {activeIncidents.map(incident => {
                  const isOpen = expandedIncident === incident.id;
                  const severityColor = SEVERITY_COLOR[incident.severity?.toLowerCase()] ?? "#f59e0b";
                  const affectedNames = incident.institutions?.map(i => i.institution_name).filter(Boolean) ??
                    (incident.institution_name ? [incident.institution_name] : []);

                  return (
                    <div key={incident.id} className="rounded-2xl overflow-hidden border border-white/8 bg-white/3">
                      <button
                        onClick={() => setExpandedIncident(isOpen ? null : incident.id)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
                      >
                        {/* Severity dot */}
                        <div className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                          style={{ background: severityColor, boxShadow: `0 0 6px ${severityColor}` }} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{incident.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {incident.product && (
                              <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/8 capitalize">
                                {incident.product}
                              </span>
                            )}
                            {affectedNames.slice(0, 2).map(n => (
                              <span key={n} className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
                                {n}
                              </span>
                            ))}
                            {affectedNames.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">+{affectedNames.length - 2}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {relDate(incident.started_at ?? incident.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* State badge + chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <StateBadge state={incident.state} />
                          <div className={`w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                            <ChevronRight size={11} className="text-muted-foreground" />
                          </div>
                        </div>
                      </button>

                      {/* Timeline updates */}
                      {isOpen && (
                        <div className="px-5 pb-4 border-t border-white/8 pt-4 space-y-4">
                          {incident.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{incident.description}</p>
                          )}
                          {(incident.updates ?? []).slice(0, 6).map(u => (
                            <div key={u.id} className="flex gap-3">
                              <div className="mt-1.5 flex flex-col items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                <div className="w-px flex-1 bg-white/10 mt-1" />
                              </div>
                              <div className="flex-1 min-w-0 pb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <StateBadge state={u.state} />
                                  <span className="text-[10px] text-muted-foreground">{relDate(u.created_at)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{u.body}</p>
                              </div>
                            </div>
                          ))}
                          {(!incident.updates || incident.updates.length === 0) && (
                            <p className="text-xs text-muted-foreground/60 italic">Sem atualizações disponíveis.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Degraded institutions */}
          {degradedInstitutions.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                Instituições com problema ({degradedInstitutions.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {degradedInstitutions.map(inst => (
                  <div key={inst.pluggy_id} className="rounded-xl p-4 bg-white/3 border border-amber-500/15 flex items-center gap-3">
                    {inst.logo_url ? (
                      <div className="w-8 h-8 rounded-lg bg-white p-1 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={inst.logo_url} alt={inst.name} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white">{inst.name?.[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{inst.name}</p>
                      <UptimeBars bars={inst.bars} uptime={inst.uptime} />
                    </div>
                    <StateBadge state={inst.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Infrastructure components */}
          {(snapshot?.components?.length ?? 0) > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Infraestrutura</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {snapshot!.components.map(comp => (
                  <div key={comp.key} className="rounded-xl p-4 bg-white/3 border border-white/8 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Server size={14} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-white font-medium">{comp.name}</p>
                    </div>
                    <StateBadge state={comp.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operational institutions (collapsible) */}
          {operationalInstitutions.length > 0 && (
            <div>
              <button
                onClick={() => setShowAllInstitutions(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors mb-3"
              >
                <ChevronRight size={13} className={`transition-transform ${showAllInstitutions ? "rotate-90" : ""}`} />
                {showAllInstitutions ? "Ocultar" : "Ver"} {operationalInstitutions.length} instituições operacionais
              </button>
              {showAllInstitutions && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {operationalInstitutions.map(inst => (
                    <div key={inst.pluggy_id} className="rounded-xl p-3 bg-white/3 border border-white/8 flex items-center gap-2">
                      {inst.logo_url ? (
                        <div className="w-6 h-6 rounded-md bg-white p-0.5 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={inst.logo_url} alt={inst.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-emerald-400">{inst.name?.[0]}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate">{inst.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All clear */}
          {activeIncidents.length === 0 && degradedInstitutions.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Todos os sistemas operacionais</p>
                <p className="text-sm text-muted-foreground mt-1">Nenhum incidente ativo no momento.</p>
              </div>
            </div>
          )}
        </>
      )}
      </div>{/* end max-w inner */}
    </div>
  );
}

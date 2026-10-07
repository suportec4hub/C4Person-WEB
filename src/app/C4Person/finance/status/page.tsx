"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Activity, Wifi, Zap, Server, ArrowRight, Clock,
  Wallet, TrendingUp, BarChart3,
} from "lucide-react";

// ── Finance sub-nav ──────────────────────────────────────────────────────────
const FINANCE_TABS = [
  { href: "/C4Person/finance",        label: "Finanças",     icon: Wallet },
  { href: "/C4Person/finance/bolsa",  label: "Bolsa",        icon: TrendingUp },
  { href: "/C4Person/finance/status", label: "Status Bancos", icon: Activity },
];

function FinanceNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 mb-6 bg-white/3 border border-white/8 rounded-2xl p-1.5 w-fit">
      {FINANCE_TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-white/10 text-white shadow-sm"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
interface IncidentUpdate {
  id: string;
  body: string;
  created_at: string;
  status: string;
}

interface Component {
  id: string;
  name: string;
  status: string;
}

interface Incident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  updated_at: string;
  components?: Component[];
  incident_updates?: IncidentUpdate[];
  // Pluggy custom fields
  connector_name?: string;
  product?: string;
  started_at?: string;
}

interface InfraComponent {
  id: string;
  name: string;
  status: string;
  uptime?: number;
}

interface StatusData {
  // Standard statuspage.io format
  page?: { name: string; status: string };
  status?: { indicator: string; description: string };
  incidents?: Incident[];
  components?: InfraComponent[];
  // Pluggy custom format
  operational?: number;
  withIncident?: number;
  maintenance?: number;
  connectors?: Array<{ name: string; status: string; products?: string[] }>;
  infrastructure?: Array<{ name: string; status: string; uptime?: number }>;
  activeIncidents?: Incident[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  investigating:  { label: "Investigando",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  identified:     { label: "Identificado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  monitoring:     { label: "Monitorando",   color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  resolved:       { label: "Resolvido",     color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  operational:    { label: "Operacional",   color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  degraded_performance: { label: "Degradado", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  partial_outage: { label: "Parcial",       color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  major_outage:   { label: "Indisponível",  color: "#dc2626", bg: "rgba(220,38,38,0.12)",   border: "rgba(220,38,38,0.3)"   },
};

function getBadge(status: string) {
  const key = status?.toLowerCase().replace(/[\s-]/g, "_");
  return STATUS_BADGE[key] ?? { label: status, color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
}

function StatusBadge({ status }: { status: string }) {
  const b = getBadge(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
      style={{ color: b.color, background: b.bg, borderColor: b.border }}
    >
      {b.label}
    </span>
  );
}

const IMPACT_COLOR: Record<string, string> = {
  critical: "#ef4444", major: "#f59e0b", minor: "#3b82f6", none: "#10b981",
};

function relativeDate(iso: string) {
  try {
    return format(parseISO(iso), "dd MMM, HH:mm", { locale: ptBR });
  } catch { return iso; }
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PluggyStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pluggy/status");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRaw(json);
      // Normalize into our shape (handles both Pluggy custom and statuspage.io formats)
      const incidents: Incident[] = json.incidents ?? json.activeIncidents ?? [];
      const infra: InfraComponent[] = json.infrastructure ?? json.components ?? [];
      setData({
        operational:    json.operational   ?? json.connectors?.filter((c: any) => c.status === "operational").length,
        withIncident:   json.withIncident  ?? incidents.filter(i => i.status !== "resolved").length,
        maintenance:    json.maintenance   ?? 0,
        activeIncidents: incidents,
        infrastructure: infra,
        page:   json.page,
        status: json.status,
      });
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err.message ?? "Falha ao carregar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Overall indicator
  const indicator = data?.status?.indicator ?? (
    (data?.withIncident ?? 0) > 0 ? "major" : "none"
  );
  const isFullyOperational = indicator === "none" || indicator === "operational";

  const overallColor = isFullyOperational ? "#10b981" : IMPACT_COLOR[indicator] ?? "#f59e0b";
  const overallLabel = isFullyOperational
    ? "Todos os sistemas operacionais"
    : data?.status?.description ?? "Degradação em algumas instituições";

  return (
    <div className="space-y-0 p-4 md:p-6 max-w-4xl mx-auto">
      <FinanceNav />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Status dos Bancos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe a disponibilidade das instituições via Pluggy
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
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

      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-white/3 animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          <div
            className="rounded-2xl p-5 mb-6 flex items-center gap-4 border"
            style={{
              background: `${overallColor}10`,
              borderColor: `${overallColor}30`,
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${overallColor}20` }}
            >
              {isFullyOperational
                ? <CheckCircle2 size={22} style={{ color: overallColor }} />
                : <AlertTriangle size={22} style={{ color: overallColor }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{overallLabel}</p>
              {lastFetched && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atualizado {format(lastFetched, "HH:mm:ss")}
                </p>
              )}
            </div>
            <a
              href="https://status.pluggy.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors shrink-0"
            >
              status.pluggy.ai <ArrowRight size={11} />
            </a>
          </div>

          {/* Count boxes */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Operacionais", value: data.operational ?? "—", color: "#10b981", icon: CheckCircle2 },
              { label: "Com incidente", value: data.withIncident ?? (data.activeIncidents?.filter(i => i.status !== "resolved").length ?? 0), color: "#f59e0b", icon: AlertTriangle },
              { label: "Em manutenção", value: data.maintenance ?? 0, color: "#3b82f6", icon: Clock },
            ].map(({ label, value, color, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl p-4 border flex flex-col items-center gap-2"
                style={{ background: `${color}08`, borderColor: `${color}20` }}
              >
                <Icon size={18} style={{ color }} />
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[11px] text-muted-foreground text-center">{label}</p>
              </div>
            ))}
          </div>

          {/* Active incidents */}
          {(data.activeIncidents?.length ?? 0) > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-white uppercase tracking-wider">Incidentes ativos</p>
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {data.activeIncidents!.filter(i => i.status !== "resolved").length}
                </span>
              </div>
              <div className="space-y-2">
                {data.activeIncidents!.map(incident => {
                  const isExpanded = expandedIncident === incident.id;
                  const impactColor = IMPACT_COLOR[incident.impact ?? "minor"] ?? "#f59e0b";
                  return (
                    <div
                      key={incident.id}
                      className="rounded-2xl overflow-hidden border border-white/8 bg-white/3"
                    >
                      <button
                        onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        {/* Impact dot */}
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                          style={{ background: impactColor, boxShadow: `0 0 6px ${impactColor}` }}
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{incident.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {incident.product && (
                              <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
                                {incident.product}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {incident.created_at ? relativeDate(incident.created_at) : ""}
                            </span>
                          </div>
                        </div>

                        {/* Badge */}
                        <StatusBadge status={incident.status} />
                      </button>

                      {/* Expanded: incident updates */}
                      {isExpanded && incident.incident_updates && incident.incident_updates.length > 0 && (
                        <div className="px-5 pb-4 border-t border-white/8 pt-4 space-y-3">
                          {incident.incident_updates.slice(0, 5).map(u => (
                            <div key={u.id} className="flex gap-3">
                              <div className="mt-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <StatusBadge status={u.status} />
                                  <span className="text-[10px] text-muted-foreground">{relativeDate(u.created_at)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{u.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Infrastructure */}
          {(data.infrastructure?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Infraestrutura</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.infrastructure!.map(comp => {
                  const b = getBadge(comp.status);
                  return (
                    <div
                      key={comp.name}
                      className="rounded-xl p-4 bg-white/3 border border-white/8 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          <Server size={14} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{comp.name}</p>
                          {comp.uptime != null && (
                            <p className="text-[10px] text-muted-foreground">{comp.uptime.toFixed(2)}% uptime</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {comp.uptime != null && (
                          <div className="hidden sm:flex gap-px">
                            {Array.from({ length: 30 }, (_, i) => (
                              <div
                                key={i}
                                className="w-1 h-5 rounded-sm"
                                style={{ background: comp.uptime! > 99 ? "#10b981" : i > 27 ? "#f59e0b" : "#10b981", opacity: 0.7 + Math.random() * 0.3 }}
                              />
                            ))}
                          </div>
                        )}
                        <StatusBadge status={comp.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(data.activeIncidents?.length ?? 0) === 0 && (data.infrastructure?.length ?? 0) === 0 && (
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
    </div>
  );
}

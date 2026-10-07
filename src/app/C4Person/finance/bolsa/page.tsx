"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, Plus, X, RefreshCw,
  AlertCircle, Search, BarChart3, Activity, Wallet, Info,
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Quote {
  symbol: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketChange?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  logourl?: string;
  regularMarketTime?: string;
}

interface TickerState {
  ticker: string;
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

// ── Default popular stocks (ações only — no FIIs/Tesouro on free plan) ───────
const DEFAULT_TICKERS = ["PETR4", "VALE3", "ITUB4", "BBDC4", "WEGE3"];

const fmt = (v: number, decimals = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtVol = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BolsaPage() {
  const [tickers, setTickers] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TICKERS;
    try {
      const saved = localStorage.getItem("c4p_bolsa_tickers");
      return saved ? JSON.parse(saved) : DEFAULT_TICKERS;
    } catch { return DEFAULT_TICKERS; }
  });

  const [states, setStates] = useState<Record<string, TickerState>>({});
  const [addInput, setAddInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const reqCountRef = useRef(0); // rough request counter this session

  // Persist tickers
  useEffect(() => {
    try { localStorage.setItem("c4p_bolsa_tickers", JSON.stringify(tickers)); } catch {}
  }, [tickers]);

  const fetchTicker = useCallback(async (ticker: string) => {
    setStates(prev => ({ ...prev, [ticker]: { ...prev[ticker], ticker, loading: true, error: null, quote: prev[ticker]?.quote ?? null, lastFetched: prev[ticker]?.lastFetched ?? null } }));
    reqCountRef.current += 1;
    try {
      const res = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const quote: Quote = json.results?.[0] ?? null;
      if (!quote) throw new Error("Ativo não encontrado");
      setStates(prev => ({ ...prev, [ticker]: { ticker, quote, loading: false, error: null, lastFetched: new Date() } }));
    } catch (err: any) {
      setStates(prev => ({
        ...prev,
        [ticker]: { ticker, quote: prev[ticker]?.quote ?? null, loading: false, error: err.message ?? "Erro", lastFetched: prev[ticker]?.lastFetched ?? null },
      }));
    }
  }, []);

  // Fetch all on mount (one at a time to respect free plan — 1 asset per request)
  useEffect(() => {
    tickers.forEach((t, i) => {
      setTimeout(() => fetchTicker(t), i * 300); // stagger 300ms each
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = useCallback(() => {
    tickers.forEach((t, i) => setTimeout(() => fetchTicker(t), i * 300));
  }, [tickers, fetchTicker]);

  const addTicker = useCallback(() => {
    const t = addInput.trim().toUpperCase();
    if (!t || tickers.includes(t)) { setAddInput(""); setShowAdd(false); return; }
    if (tickers.length >= 10) {
      alert("Limite de 10 ativos para evitar exceder as 15.000 requisições gratuitas do BRAPI.");
      return;
    }
    setTickers(prev => [...prev, t]);
    setAddInput("");
    setShowAdd(false);
    setTimeout(() => fetchTicker(t), 100);
  }, [addInput, tickers, fetchTicker]);

  const removeTicker = useCallback((t: string) => {
    setTickers(prev => prev.filter(x => x !== t));
    setStates(prev => { const next = { ...prev }; delete next[t]; return next; });
    if (expanded === t) setExpanded(null);
  }, [expanded]);

  const allLoading = tickers.some(t => states[t]?.loading);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <FinanceNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Bolsa de Valores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ações B3 via BRAPI · atualizado a cada 30 min</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={allLoading}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={allLoading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={() => { setShowAdd(true); setTimeout(() => addRef.current?.focus(), 50); }}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 transition-all"
          >
            <Plus size={13} />
            Adicionar
          </button>
        </div>
      </div>

      {/* Free plan notice */}
      <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-3">
        <Info size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed space-y-0.5">
          <p><span className="text-amber-400 font-medium">Plano gratuito BRAPI:</span> 1 requisição por ativo · dados a cada 30 min · histórico até 3 meses</p>
          <p>FIIs, Tesouro Direto, opções e futuros não disponíveis · limite de 15.000 req/mês</p>
        </div>
      </div>

      {/* Add ticker input */}
      {showAdd && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={addRef}
              value={addInput}
              onChange={e => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") addTicker(); if (e.key === "Escape") setShowAdd(false); }}
              placeholder="Ex: MGLU3, PETR3, BBAS3..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
          <button
            onClick={addTicker}
            className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all"
          >
            Adicionar
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground text-sm transition-all"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stock cards */}
      <div className="space-y-2">
        {tickers.map(ticker => {
          const state = states[ticker];
          const q = state?.quote;
          const isPos = (q?.regularMarketChangePercent ?? 0) >= 0;
          const chgColor = isPos ? "#10b981" : "#ef4444";
          const isExpanded = expanded === ticker;

          // Day range % position
          const dayRange = q ? (q.regularMarketDayHigh ?? 0) - (q.regularMarketDayLow ?? 0) : 0;
          const dayPos = dayRange > 0 && q
            ? Math.min(100, Math.max(0, ((q.regularMarketPrice ?? 0) - (q.regularMarketDayLow ?? 0)) / dayRange * 100))
            : 50;

          return (
            <div
              key={ticker}
              className="rounded-2xl overflow-hidden border border-white/8 bg-white/3"
            >
              {/* Main row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : ticker)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
              >
                {/* Logo or letter */}
                {q?.logourl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1.5 shrink-0 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.logourl} alt={ticker} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{ticker.slice(0, 2)}</span>
                  </div>
                )}

                {/* Name + ticker */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{ticker}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {state?.loading ? "Carregando…" : state?.error ? state.error : (q?.shortName ?? q?.longName ?? "—")}
                  </p>
                </div>

                {/* Price + change */}
                {state?.loading && !q ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="h-5 w-20 rounded bg-white/5 animate-pulse" />
                    <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
                  </div>
                ) : state?.error && !q ? (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <AlertCircle size={12} />
                    Erro
                  </div>
                ) : q ? (
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Day range bar (desktop) */}
                    <div className="hidden sm:flex flex-col items-end gap-1 min-w-[80px]">
                      <div className="w-full h-1.5 rounded-full bg-white/10 relative overflow-visible">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white/90 shadow"
                          style={{ left: `${dayPos}%`, background: chgColor, transform: `translateX(-50%) translateY(-50%)` }}
                        />
                      </div>
                      <div className="flex justify-between w-full">
                        <span className="text-[9px] text-muted-foreground">{fmt(q.regularMarketDayLow ?? 0)}</span>
                        <span className="text-[9px] text-muted-foreground">{fmt(q.regularMarketDayHigh ?? 0)}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="text-base font-bold text-white leading-none">
                        R$ {fmt(q.regularMarketPrice ?? 0)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {isPos
                          ? <TrendingUp size={11} style={{ color: chgColor }} />
                          : <TrendingDown size={11} style={{ color: chgColor }} />}
                        <span className="text-xs font-semibold" style={{ color: chgColor }}>
                          {isPos ? "+" : ""}{fmt(q.regularMarketChangePercent ?? 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Remove */}
                <button
                  onClick={e => { e.stopPropagation(); removeTicker(ticker); }}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all shrink-0 ml-1"
                  title="Remover"
                >
                  <X size={11} className="text-muted-foreground hover:text-red-400" />
                </button>
              </button>

              {/* Expanded detail */}
              {isExpanded && q && (
                <div className="px-5 pb-5 pt-1 border-t border-white/8">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: "Abertura",     value: `R$ ${fmt(q.regularMarketOpen ?? 0)}` },
                      { label: "Fechamento ant.", value: `R$ ${fmt(q.regularMarketPreviousClose ?? 0)}` },
                      { label: "Variação",     value: `${isPos ? "+" : ""}R$ ${fmt(Math.abs(q.regularMarketChange ?? 0))}`, color: chgColor },
                      { label: "Volume",       value: fmtVol(q.regularMarketVolume ?? 0) },
                      { label: "Mín. 52 sem.", value: `R$ ${fmt(q.fiftyTwoWeekLow ?? 0)}` },
                      { label: "Máx. 52 sem.", value: `R$ ${fmt(q.fiftyTwoWeekHigh ?? 0)}` },
                      { label: "Market Cap",   value: q.marketCap ? fmtVol(q.marketCap) : "—" },
                      { label: "Atualizado",   value: q.regularMarketTime ? format(new Date(q.regularMarketTime), "HH:mm", { locale: ptBR }) : "—" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl p-3 bg-white/4 border border-white/8">
                        <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                        <p className="text-sm font-semibold" style={{ color: color ?? "white" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* 52-week range bar */}
                  {q.fiftyTwoWeekLow && q.fiftyTwoWeekHigh && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span>52 semanas</span>
                        <span style={{ color: chgColor }}>
                          {fmt(((q.regularMarketPrice ?? 0) - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow) * 100, 0)}% da máxima
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8 relative overflow-visible">
                        {(() => {
                          const range52 = q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow;
                          const pos52 = range52 > 0
                            ? Math.min(100, Math.max(0, ((q.regularMarketPrice ?? 0) - q.fiftyTwoWeekLow) / range52 * 100))
                            : 50;
                          return (
                            <div
                              className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                              style={{ left: `${pos52}%`, background: chgColor, transform: "translateX(-50%) translateY(-50%)" }}
                            />
                          );
                        })()}
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>R$ {fmt(q.fiftyTwoWeekLow)}</span>
                        <span>R$ {fmt(q.fiftyTwoWeekHigh)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {tickers.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BarChart3 size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Nenhum ativo monitorado</p>
              <p className="text-sm text-muted-foreground mt-1">Adicione ações da B3 para acompanhar.</p>
            </div>
            <button
              onClick={() => { setShowAdd(true); setTimeout(() => addRef.current?.focus(), 50); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all"
            >
              <Plus size={14} />
              Adicionar ativo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

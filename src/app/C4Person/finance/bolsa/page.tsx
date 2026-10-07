"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp, TrendingDown, Plus, X, RefreshCw,
  AlertCircle, Search, BarChart3, Activity, Wallet, Info,
  ChevronRight, Building2, ArrowUpRight, ArrowDownRight,
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoricalPoint {
  date: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

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
  historicalDataPrice?: HistoricalPoint[];
}

interface TickerState {
  ticker: string;
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

interface BankInvestment {
  id: string;
  name: string;
  type: string;
  balance: number;
  institution_name: string | null;
  institution_logo_url: string | null;
  last_synced_at: string | null;
}

interface SearchResult {
  stock: string;
  name: string;
  close?: number;
  change?: number;
  volume?: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_TICKERS = ["PETR4", "VALE3", "ITUB4", "BBDC4", "WEGE3"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt2 = (v: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, positive, w = 100, h = 40 }: { data: number[]; positive: boolean; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + ((max - v) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color = positive ? "#10b981" : "#ef4444";
  const fillId = `sf-${positive ? "g" : "r"}`;
  const last = data[data.length - 1];
  const lx = w - pad;
  const ly = pad + ((max - last) / range) * (h - pad * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h, maxWidth: w }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polyline
        points={`${pad},${h} ${points} ${lx},${h}`}
        fill={`url(#${fillId})`}
        stroke="none"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last price dot */}
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

// ── Mini OHLC bar chart ────────────────────────────────────────────────────────
function MiniOHLC({ data, w = 300, h = 80 }: { data: HistoricalPoint[]; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const allPrices = data.flatMap(d => [d.open ?? d.close, d.high ?? d.close, d.low ?? d.close, d.close]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 0.01;
  const barW = (w / data.length) * 0.6;
  const gap   = w / data.length;
  const toY = (v: number) => 2 + ((max - v) / range) * (h - 4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      {data.map((d, i) => {
        const x   = i * gap + gap / 2;
        const isUp = d.close >= (d.open ?? d.close);
        const col  = isUp ? "#10b981" : "#ef4444";
        const top  = toY(Math.max(d.open ?? d.close, d.close));
        const bot  = toY(Math.min(d.open ?? d.close, d.close));
        const high = toY(d.high ?? Math.max(d.open ?? d.close, d.close));
        const low  = toY(d.low  ?? Math.min(d.open ?? d.close, d.close));
        return (
          <g key={i}>
            <line x1={x} y1={high} x2={x} y2={low} stroke={col} strokeWidth="1" opacity="0.5" />
            <rect
              x={x - barW / 2} y={top}
              width={barW} height={Math.max(1, bot - top)}
              fill={col} rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

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
  const [expanded, setExpanded] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bank investments
  const [bankInvestments, setBankInvestments] = useState<BankInvestment[]>([]);

  // Persist tickers
  useEffect(() => {
    try { localStorage.setItem("c4p_bolsa_tickers", JSON.stringify(tickers)); } catch {}
  }, [tickers]);

  // Fetch bank investment accounts
  useEffect(() => {
    supabase.from("bank_accounts")
      .select("id,name,type,balance,institution_name,institution_logo_url,last_synced_at")
      .in("type", ["INVESTMENT"])
      .order("institution_name")
      .then(({ data }) => { if (data) setBankInvestments(data as BankInvestment[]); });
  }, []);

  const fetchTicker = useCallback(async (ticker: string) => {
    setStates(prev => ({
      ...prev,
      [ticker]: { ...prev[ticker], ticker, loading: true, error: null, quote: prev[ticker]?.quote ?? null, lastFetched: prev[ticker]?.lastFetched ?? null },
    }));
    try {
      const res  = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}&range=5d&interval=1d`);
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

  useEffect(() => {
    tickers.forEach((t, i) => setTimeout(() => fetchTicker(t), i * 400));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = useCallback(() => {
    tickers.forEach((t, i) => setTimeout(() => fetchTicker(t), i * 400));
  }, [tickers, fetchTicker]);

  // Search debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim()) { setSearchResults([]); setShowSearchDrop(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res  = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const json = await res.json();
        setSearchResults(json.stocks ?? []);
        setShowSearchDrop(true);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  const addTicker = useCallback((ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    if (tickers.includes(t)) { setSearchQuery(""); setShowSearchDrop(false); return; }
    if (tickers.length >= 10) { alert("Limite de 10 ativos (plano gratuito BRAPI)."); return; }
    setTickers(prev => [...prev, t]);
    setSearchQuery("");
    setShowSearchDrop(false);
    setTimeout(() => fetchTicker(t), 100);
  }, [tickers, fetchTicker]);

  const removeTicker = useCallback((t: string) => {
    setTickers(prev => prev.filter(x => x !== t));
    setStates(prev => { const n = { ...prev }; delete n[t]; return n; });
    if (expanded === t) setExpanded(null);
  }, [expanded]);

  // Summary stats from loaded quotes
  const loadedQuotes = useMemo(() =>
    tickers.map(t => states[t]?.quote).filter(Boolean) as Quote[],
    [tickers, states]
  );
  const best  = useMemo(() => loadedQuotes.reduce<Quote | null>((b, q) => (!b || (q.regularMarketChangePercent ?? -Infinity) > (b.regularMarketChangePercent ?? -Infinity)) ? q : b, null), [loadedQuotes]);
  const worst = useMemo(() => loadedQuotes.reduce<Quote | null>((w, q) => (!w || (q.regularMarketChangePercent ?? Infinity) < (w.regularMarketChangePercent ?? Infinity)) ? q : w, null), [loadedQuotes]);

  const allLoading = tickers.some(t => states[t]?.loading);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl 2xl:max-w-6xl mx-auto">
      <FinanceNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Bolsa de Valores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ações B3 via BRAPI · dados a cada 30 min</p>
        </div>
        <button onClick={refreshAll} disabled={allLoading}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={allLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Free plan notice */}
      <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-3">
        <Info size={13} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-amber-400 font-medium">Plano gratuito BRAPI:</span>{" "}
          1 req/ativo · 30 min · histórico 3 meses · sem FIIs/Tesouro/opções · 15k req/mês
        </p>
      </div>

      {/* Summary dashboard */}
      {loadedQuotes.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
          <div className="rounded-2xl p-3 sm:p-4 bg-white/3 border border-white/8">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">Ativos</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{loadedQuotes.length}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">{tickers.length - loadedQuotes.length} carregando</p>
          </div>
          {best && (
            <div className="rounded-2xl p-3 sm:p-4 bg-emerald-500/8 border border-emerald-500/20">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">Maior alta</p>
              <p className="text-sm sm:text-lg font-bold text-emerald-400">+{fmt2(best.regularMarketChangePercent ?? 0)}%</p>
              <p className="text-[10px] sm:text-xs text-white font-medium mt-0.5 sm:mt-1">{best.symbol}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate hidden sm:block">{best.shortName}</p>
            </div>
          )}
          {worst && (
            <div className="rounded-2xl p-3 sm:p-4 bg-red-500/8 border border-red-500/20">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">Maior queda</p>
              <p className="text-sm sm:text-lg font-bold text-red-400">{fmt2(worst.regularMarketChangePercent ?? 0)}%</p>
              <p className="text-[10px] sm:text-xs text-white font-medium mt-0.5 sm:mt-1">{worst.symbol}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate hidden sm:block">{worst.shortName}</p>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === "Enter" && searchResults.length > 0) addTicker(searchResults[0].stock);
                else if (e.key === "Enter" && searchQuery.trim()) addTicker(searchQuery.trim());
                if (e.key === "Escape") { setSearchQuery(""); setShowSearchDrop(false); }
              }}
              onFocus={() => { if (searchResults.length > 0) setShowSearchDrop(true); }}
              placeholder="Buscar ação (ex: PETR4, Petrobras…)"
              className="w-full pl-8 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/20 transition-colors"
            />
            {searchLoading && (
              <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
            )}
            {searchQuery && !searchLoading && (
              <button onClick={() => { setSearchQuery(""); setShowSearchDrop(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <button onClick={() => addTicker(searchQuery.trim())}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all shrink-0">
              <Plus size={13} />
              Adicionar
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {showSearchDrop && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl z-50 overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={r.stock}
                onClick={() => addTicker(r.stock)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white">{r.stock.slice(0, 2)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.stock}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.name}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {r.close != null && <p className="text-xs text-white font-medium">R$ {fmt2(r.close)}</p>}
                  {r.change != null && (
                    <p className={`text-[10px] font-semibold ${r.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r.change >= 0 ? "+" : ""}{fmt2(r.change)}%
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist label */}
      {tickers.length > 0 && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
          <BarChart3 size={11} />
          Minha lista ({tickers.length}/10)
        </p>
      )}

      {/* Stock cards */}
      <div className="space-y-2 mb-8">
        {tickers.map(ticker => {
          const state   = states[ticker];
          const q       = state?.quote;
          const isPos   = (q?.regularMarketChangePercent ?? 0) >= 0;
          const chgColor = isPos ? "#10b981" : "#ef4444";
          const isOpen  = expanded === ticker;
          const sparkData = q?.historicalDataPrice?.map(p => p.close).filter(Boolean) as number[] ?? [];

          // Day range position
          const dayRange = q ? (q.regularMarketDayHigh ?? 0) - (q.regularMarketDayLow ?? 0) : 0;
          const dayPos   = dayRange > 0 && q
            ? Math.min(100, Math.max(0, ((q.regularMarketPrice ?? 0) - (q.regularMarketDayLow ?? 0)) / dayRange * 100))
            : 50;

          return (
            <div key={ticker} className="rounded-2xl overflow-hidden border border-white/8 bg-white/3">
              {/* Main row */}
              <button
                onClick={() => setExpanded(isOpen ? null : ticker)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
              >
                {/* Logo */}
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

                {/* Ticker + name */}
                <div className="min-w-[72px] shrink-0">
                  <p className="text-sm font-bold text-white">{ticker}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {state?.loading && !q ? "…" : state?.error && !q ? "Erro" : (q?.shortName ?? "—")}
                  </p>
                </div>

                {/* Sparkline chart */}
                <div className="hidden sm:block flex-1">
                  {sparkData.length >= 2
                    ? <Sparkline data={sparkData} positive={isPos} w={120} h={40} />
                    : state?.loading
                      ? <div className="h-8 w-24 rounded bg-white/5 animate-pulse" />
                      : null}
                </div>

                {/* Day range bar */}
                {q && (
                  <div className="hidden md:flex flex-col gap-1 min-w-[90px]">
                    <div className="w-full h-1.5 rounded-full bg-white/10 relative">
                      <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white/90 shadow-sm -translate-y-1/2"
                        style={{ left: `${dayPos}%`, background: chgColor, transform: `translateX(-50%) translateY(-50%)` }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-muted-foreground">{fmt2(q.regularMarketDayLow ?? 0)}</span>
                      <span className="text-[9px] text-muted-foreground">{fmt2(q.regularMarketDayHigh ?? 0)}</span>
                    </div>
                  </div>
                )}

                {/* Price + change */}
                {state?.loading && !q ? (
                  <div className="flex flex-col items-end gap-1 ml-auto">
                    <div className="h-5 w-20 rounded bg-white/5 animate-pulse" />
                    <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
                  </div>
                ) : state?.error && !q ? (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs ml-auto">
                    <AlertCircle size={12} />
                    Não encontrado
                  </div>
                ) : q ? (
                  <div className="text-right ml-auto shrink-0">
                    <p className="text-base font-bold text-white leading-none">R$ {fmt2(q.regularMarketPrice ?? 0)}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {isPos
                        ? <ArrowUpRight size={11} style={{ color: chgColor }} />
                        : <ArrowDownRight size={11} style={{ color: chgColor }} />}
                      <span className="text-xs font-bold" style={{ color: chgColor }}>
                        {isPos ? "+" : ""}{fmt2(q.regularMarketChangePercent ?? 0)}%
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Remove + chevron */}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={e => { e.stopPropagation(); removeTicker(ticker); }}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/8 hover:border-red-500/30 flex items-center justify-center transition-all">
                    <X size={11} className="text-muted-foreground" />
                  </button>
                  <div className={`w-5 h-5 rounded-full bg-white/5 border border-white/8 flex items-center justify-center transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                    <ChevronRight size={11} className="text-muted-foreground" />
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && q && (
                <div className="px-5 pb-5 pt-2 border-t border-white/8">
                  {/* OHLC chart */}
                  {(q.historicalDataPrice?.length ?? 0) >= 3 && (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Histórico 5 dias</p>
                        <span className="text-[10px] text-muted-foreground">{q.historicalDataPrice?.length} pregões</span>
                      </div>
                      <div className="rounded-xl bg-white/4 border border-white/8 p-4 overflow-hidden">
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <p className="text-lg font-bold text-white leading-none">R$ {fmt2(q.regularMarketPrice ?? 0)}</p>
                            <p className="text-xs mt-0.5" style={{ color: chgColor }}>
                              {isPos ? "+" : ""}{fmt2(q.regularMarketChange ?? 0)} ({isPos ? "+" : ""}{fmt2(q.regularMarketChangePercent ?? 0)}%) hoje
                            </p>
                          </div>
                          {q.regularMarketTime && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(q.regularMarketTime), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <MiniOHLC data={q.historicalDataPrice!} h={80} />
                        {/* X axis dates */}
                        <div className="flex justify-between mt-1">
                          {q.historicalDataPrice!.map((p, i) => (
                            <span key={i} className="text-[9px] text-muted-foreground">
                              {format(new Date(p.date * 1000), "dd/MM", { locale: ptBR })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: "Abertura",        value: `R$ ${fmt2(q.regularMarketOpen ?? 0)}` },
                      { label: "Fechamento ant.",  value: `R$ ${fmt2(q.regularMarketPreviousClose ?? 0)}` },
                      { label: "Variação dia",     value: `${isPos ? "+" : ""}R$ ${fmt2(Math.abs(q.regularMarketChange ?? 0))}`, color: chgColor },
                      { label: "Volume",           value: fmtVol(q.regularMarketVolume ?? 0) },
                      { label: "Mínima dia",       value: `R$ ${fmt2(q.regularMarketDayLow ?? 0)}` },
                      { label: "Máxima dia",       value: `R$ ${fmt2(q.regularMarketDayHigh ?? 0)}` },
                      { label: "Mín. 52 semanas",  value: `R$ ${fmt2(q.fiftyTwoWeekLow ?? 0)}` },
                      { label: "Máx. 52 semanas",  value: `R$ ${fmt2(q.fiftyTwoWeekHigh ?? 0)}` },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl p-3 bg-white/4 border border-white/8">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-sm font-bold" style={{ color: color ?? "white" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* 52-week range */}
                  {q.fiftyTwoWeekLow && q.fiftyTwoWeekHigh && (
                    <div className="mt-4 rounded-xl p-4 bg-white/4 border border-white/8">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
                        <span className="font-semibold uppercase tracking-wide">Range 52 semanas</span>
                        <span style={{ color: chgColor }}>
                          {fmt2(((q.regularMarketPrice ?? 0) - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow) * 100, )}% da máxima
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 relative">
                        {(() => {
                          const r = q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow;
                          const p = r > 0 ? Math.min(100, Math.max(0, ((q.regularMarketPrice ?? 0) - q.fiftyTwoWeekLow) / r * 100)) : 50;
                          return (
                            <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
                              style={{ left: `${p}%`, background: chgColor, transform: "translateX(-50%) translateY(-50%)" }}
                            />
                          );
                        })()}
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                        <span>R$ {fmt2(q.fiftyTwoWeekLow)}</span>
                        <span>R$ {fmt2(q.fiftyTwoWeekHigh)}</span>
                      </div>
                    </div>
                  )}

                  {q.marketCap && (
                    <p className="mt-3 text-[10px] text-muted-foreground text-right">
                      Market Cap: R$ {fmtVol(q.marketCap)}
                    </p>
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
              <p className="text-sm text-muted-foreground mt-1">Use a busca acima para adicionar ações da B3.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bank investments section */}
      {bankInvestments.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={13} className="text-blue-400" />
              <p className="text-xs font-semibold text-white uppercase tracking-wider">Carteira Open Finance</p>
            </div>
            <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full font-semibold">
              {bankInvestments.length} conta{bankInvestments.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {bankInvestments.map(inv => (
              <div key={inv.id} className="rounded-2xl p-4 bg-white/3 border border-white/8 flex items-center gap-4">
                {inv.institution_logo_url ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1.5 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inv.institution_logo_url} alt={inv.institution_name ?? ""} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{inv.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inv.institution_name ?? "Investimento"} · sincronizado {inv.last_synced_at ? format(new Date(inv.last_synced_at), "dd/MM HH:mm") : "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-white">{fmtBRL(Number(inv.balance))}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">valor total</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Posições individuais e ativos da carteira dependem de suporte do seu banco ao Open Finance
          </p>
        </div>
      )}
    </div>
  );
}

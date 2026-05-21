"use client";

import { useState, useEffect, useMemo } from "react";

import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, X, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Search, Trash2, PiggyBank,
} from "lucide-react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategoryColor } from "@/lib/categories";

interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: "in" | "out";
  category: string | null;
  transaction_date: string;
  created_at: string;
}

export default function FinancePage() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"in" | "out">("out");
  const [newCategory, setNewCategory] = useState("Outros");

  useEffect(() => {
    setMounted(true);
    fetch("/api/transactions")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setTransactions(data as Transaction[]); });
  }, []);

  /* ── derived totals ── */
  const totalIn  = useMemo(() => transactions.filter(t => t.type === "in").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalOut = useMemo(() => transactions.filter(t => t.type === "out").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const balance  = totalIn - totalOut;
  const savingsRate = totalIn > 0 ? Math.max(0, Math.round(((totalIn - totalOut) / totalIn) * 100)) : 0;

  /* ── monthly data (last 6 months) ── */
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, "yyyy-MM");
      const month = transactions.filter(t =>
        t.transaction_date && format(new Date(t.transaction_date), "yyyy-MM") === key
      );
      return {
        label: format(d, "MMM", { locale: ptBR }),
        income:   month.filter(t => t.type === "in").reduce((s, t) => s + Number(t.amount), 0),
        expenses: month.filter(t => t.type === "out").reduce((s, t) => s + Number(t.amount), 0),
      };
    });
  }, [transactions]);

  const maxMonthly = useMemo(
    () => Math.max(...monthlyData.flatMap(m => [m.income, m.expenses]), 1),
    [monthlyData]
  );

  /* ── category breakdown (expenses only) ── */
  const categoryData = useMemo(() => {
    const exp = transactions.filter(t => t.type === "out");
    const bycat = exp.reduce<Record<string, number>>((acc, t) => {
      const cat = t.category || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {});
    return Object.entries(bycat)
      .map(([label, value]) => ({ label, value, color: getCategoryColor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const conicGradient = useMemo(() => {
    if (categoryData.length === 0) return "conic-gradient(#27272a 0% 100%)";
    const total = categoryData.reduce((s, d) => s + d.value, 0);
    let cur = 0;
    const segs = categoryData.map(d => {
      const pct = (d.value / total) * 100;
      const seg = `${d.color} ${cur.toFixed(2)}% ${(cur + pct).toFixed(2)}%`;
      cur += pct;
      return seg;
    });
    return `conic-gradient(${segs.join(", ")})`;
  }, [categoryData]);

  /* ── filtered list ── */
  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "all" || t.type === filterType;
      return matchSearch && matchType;
    });
  }, [transactions, search, filterType]);

  /* ── handlers ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!newName.trim() || isNaN(amount)) return;
    const payload = {
      name: newName,
      amount,
      type: newType,
      category: newCategory,
      transaction_date: new Date().toISOString(),
    };
    setShowModal(false);
    setNewName(""); setNewAmount(""); setNewType("out"); setNewCategory("Outros");
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.id) setTransactions(prev => [data as Transaction, ...prev]);
  };

  const deleteTx = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (!mounted) return null;

  const categories = newType === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-10 flex justify-between items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">Nectar</h2>
          <h1 className="text-4xl font-bold tracking-tight">Visão Financeira</h1>
        </div>
        <motion.button
          onClick={() => setShowModal(true)}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-500/90 text-white px-5 py-2.5 rounded-full font-medium shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all"
        >
          <Plus size={18} /> Nova Transação
        </motion.button>
      </motion.header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Saldo Total", value: fmt(balance), icon: Wallet,
            color: balance >= 0 ? "text-white" : "text-red-400",
            bg: "bg-white/5", iconColor: "text-emerald-400",
            sub: balance >= 0 ? "Positivo" : "Negativo",
            subColor: balance >= 0 ? "text-emerald-400" : "text-red-400",
            TrendIcon: balance >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label: "Receitas", value: fmt(totalIn), icon: ArrowUpRight,
            color: "text-emerald-400", bg: "bg-emerald-500/10", iconColor: "text-emerald-400",
            sub: `${transactions.filter(t => t.type === "in").length} entradas`,
            subColor: "text-muted-foreground", TrendIcon: ArrowUpRight,
          },
          {
            label: "Despesas", value: fmt(totalOut), icon: ArrowDownRight,
            color: "text-red-400", bg: "bg-red-500/10", iconColor: "text-red-400",
            sub: `${transactions.filter(t => t.type === "out").length} saídas`,
            subColor: "text-muted-foreground", TrendIcon: ArrowDownRight,
          },
          {
            label: "Taxa de Economia", value: `${savingsRate}%`, icon: PiggyBank,
            color: savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-yellow-400" : "text-red-400",
            bg: "bg-white/5", iconColor: "text-emerald-400",
            sub: savingsRate >= 20 ? "Ótimo!" : savingsRate >= 10 ? "Razoável" : "Atenção",
            subColor: savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-yellow-400" : "text-red-400",
            TrendIcon: PiggyBank,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card p-5"
          >
            <div className="flex justify-between items-start mb-3">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={16} className={card.iconColor} />
              </div>
            </div>
            <p className={`text-2xl font-bold mb-2 ${card.color}`}>{card.value}</p>
            <p className={`text-xs font-medium ${card.subColor}`}>{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

        {/* Gastos por Categoria — donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-6 lg:col-span-2"
        >
          <h3 className="text-base font-semibold mb-5 flex items-center gap-2">
            <ArrowDownRight size={18} className="text-red-400" />
            Gastos por Categoria
          </h3>
          {categoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
              Nenhuma despesa registrada.
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-28 h-28 rounded-full"
                  style={{ background: conicGradient }}
                />
                <div className="absolute inset-3 rounded-full bg-card flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{fmt(totalOut)}</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 min-w-0">
                {categoryData.slice(0, 5).map(d => (
                  <div key={d.label} className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-muted-foreground truncate">{d.label}</span>
                    <span className="text-xs font-semibold text-white ml-auto flex-shrink-0">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Histórico mensal — bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card p-6 lg:col-span-3"
        >
          <h3 className="text-base font-semibold mb-5 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" />
            Histórico dos Últimos 6 Meses
          </h3>
          <div className="flex items-end gap-3 h-36">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="flex items-end gap-1 w-full" style={{ height: "112px" }}>
                  <motion.div
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: `${(m.income / maxMonthly) * 100}%`,
                      transformOrigin: "bottom",
                    }}
                    className="flex-1 bg-emerald-500/60 rounded-t-sm min-h-[2px]"
                  />
                  <motion.div
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ delay: 0.45 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: `${(m.expenses / maxMonthly) * 100}%`,
                      transformOrigin: "bottom",
                    }}
                    className="flex-1 bg-red-400/60 rounded-t-sm min-h-[2px]"
                  />
                </div>
                <span className="text-xs text-muted-foreground capitalize">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              <span className="text-xs text-muted-foreground">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-400/60" />
              <span className="text-xs text-muted-foreground">Despesas</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Transaction list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex items-center gap-2 flex-1 bg-background border border-white/10 rounded-xl px-3 py-2">
            <Search size={15} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar transações…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "in", "out"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  filterType === f
                    ? f === "in"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : f === "out"
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : "bg-white/10 text-white border-white/20"
                    : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                }`}
              >
                {f === "all" ? "Todas" : f === "in" ? "Receitas" : "Despesas"}
              </button>
            ))}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            {search ? "Nenhuma transação encontrada." : "Nenhuma transação registrada."}
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredTx.map(t => (
              <div key={t.id} className="group flex items-center gap-4 py-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    t.type === "in" ? "bg-emerald-500/10" : "bg-red-500/10"
                  }`}
                >
                  {t.type === "in"
                    ? <ArrowUpRight size={18} className="text-emerald-400" />
                    : <ArrowDownRight size={18} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t.transaction_date
                        ? format(new Date(t.transaction_date), "d 'de' MMM", { locale: ptBR })
                        : "—"}
                    </span>
                    {t.category && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md border"
                        style={{
                          color: getCategoryColor(t.category),
                          backgroundColor: `${getCategoryColor(t.category)}18`,
                          borderColor: `${getCategoryColor(t.category)}30`,
                        }}
                      >
                        {t.category}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                  {t.type === "in" ? "+" : "−"}{fmt(Number(t.amount))}
                </span>
                <button
                  onClick={() => deleteTx(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <Wallet size={22} className="text-emerald-400" />
                Nova Transação
              </h2>

              <form onSubmit={handleAdd} className="flex flex-col gap-5">
                {/* Tipo */}
                <div className="flex gap-3">
                  {(["out", "in"] as const).map(t => (
                    <button
                      key={t} type="button" onClick={() => { setNewType(t); setNewCategory("Outros"); }}
                      className={`flex-1 py-2 rounded-xl font-medium border text-sm transition-colors ${
                        newType === t
                          ? t === "in"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                            : "bg-red-500/20 text-red-400 border-red-500/50"
                          : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {t === "in" ? "Receita" : "Despesa"}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nome</label>
                  <input
                    type="text" autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Ex: Almoço no restaurante"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Valor (R$)</label>
                  <input
                    type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Categoria</label>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map(c => (
                      <button
                        key={c.label} type="button" onClick={() => setNewCategory(c.label)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-colors ${
                          newCategory === c.label
                            ? "border-opacity-50 text-white"
                            : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                        }`}
                        style={newCategory === c.label ? {
                          backgroundColor: `${c.color}20`,
                          borderColor: `${c.color}50`,
                          color: c.color,
                        } : {}}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newName.trim() || !newAmount}
                  className={`mt-2 w-full py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                    newType === "in" ? "bg-emerald-500 hover:bg-emerald-500/90" : "bg-red-500 hover:bg-red-500/90"
                  }`}
                >
                  Adicionar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SkeletonPage } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, X, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Search, Trash2, PiggyBank, Target, Download,
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
  recurrence?: "none" | "daily" | "weekly" | "monthly";
}

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
}

export default function FinancePage() {
  const [mounted, setMounted] = useState(false);
  const { undoToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");

  const [userId, setUserId] = useState("");

  const [budgets, setBudgets]                     = useState<Budget[]>([]);
  const [showBudgetModal, setShowBudgetModal]     = useState(false);
  const [budgetCategory, setBudgetCategory]       = useState("Alimentação");
  const [budgetLimit, setBudgetLimit]             = useState("");

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"in" | "out">("out");
  const [newCategory, setNewCategory] = useState("Outros");
  const [newRecurrence, setNewRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  const [savingsGoal, setSavingsGoal] = useState(0);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsInput, setSavingsInput] = useState("");

  const fetchData = useCallback(async () => {
    const [txRes, budRes] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }),
      supabase.from("budgets").select("*").order("created_at", { ascending: true }),
    ]);
    if (txRes.data)  setTransactions(txRes.data as Transaction[]);
    if (budRes.data) setBudgets(budRes.data as Budget[]);
  }, []);

  const exportPDF = () => {
    // Reuse the component-level fmt and the already-memoised totalIn/totalOut
    const currentMonth = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
    const rows = transactions.map(t => `
      <tr>
        <td>${t.transaction_date ? format(new Date(t.transaction_date), "dd/MM/yyyy") : "—"}</td>
        <td>${t.name}</td>
        <td style="color:${t.type === "in" ? "#10b981" : "#ef4444"}">${t.type === "in" ? "Receita" : "Despesa"}</td>
        <td>${t.category || "Outros"}</td>
        <td style="text-align:right;color:${t.type === "in" ? "#10b981" : "#ef4444"}">${t.type === "in" ? "+" : "−"}${fmt(Number(t.amount))}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>C4Person — Relatório Financeiro</title>
      <style>
        body{font-family:sans-serif;color:#111;margin:2cm;font-size:12px}
        h1{font-size:20px;margin-bottom:4px}
        p.sub{color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th{background:#f4f4f4;text-align:left;padding:8px;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase}
        td{padding:7px 8px;border-bottom:1px solid #eee;font-size:12px}
        .totals{margin-top:16px;display:flex;gap:32px}
        .total-box{padding:12px 16px;border:1px solid #eee;border-radius:6px;min-width:140px}
        .total-box .label{font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px}
        .total-box .value{font-size:18px;font-weight:700}
        @media print{body{margin:1cm}}
      </style></head><body>
      <h1>Relatório Financeiro · C4Person</h1>
      <p class="sub">Exportado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · ${currentMonth}</p>
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="total-box"><div class="label">Total Receitas</div><div class="value" style="color:#10b981">${fmt(totalIn)}</div></div>
        <div class="total-box"><div class="label">Total Despesas</div><div class="value" style="color:#ef4444">${fmt(totalOut)}</div></div>
        <div class="total-box"><div class="label">Saldo</div><div class="value" style="color:${balance>=0?"#10b981":"#ef4444"}">${fmt(balance)}</div></div>
      </div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const exportCSV = () => {
    const header = "Data,Descrição,Tipo,Categoria,Valor";
    const rows = transactions.map(t =>
      `${t.transaction_date ? format(new Date(t.transaction_date), "dd/MM/yyyy") : ""},` +
      `"${t.name.replace(/"/g, '""')}",` +
      `${t.type === "in" ? "Receita" : "Despesa"},` +
      `${t.category || "Outros"},` +
      `${Number(t.amount).toFixed(2)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financas_${format(new Date(), "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    fetchData().finally(() => setLoading(false));
    try {
      const stored = localStorage.getItem("c4person_savings_goal");
      if (stored) setSavingsGoal(parseFloat(stored));
    } catch { /* noop */ }

    const channel = supabase.channel("finance-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, fetchData)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "transactions" }, (p) => setTransactions(prev => prev.filter(t => t.id !== p.old.id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "budgets" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "budgets" }, fetchData)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "budgets" }, (p) => setBudgets(prev => prev.filter(b => b.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

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
      recurrence: newRecurrence,
      transaction_date: new Date().toISOString(),
      user_id: userId,
    };

    setShowModal(false);
    setNewName(""); setNewAmount(""); setNewType("out"); setNewCategory("Outros"); setNewRecurrence("none");

    const { data, error } = await supabase.from("transactions").insert([payload]).select();
    if (data) {
      setTransactions(prev => [data[0] as Transaction, ...prev]);
    } else if (error?.message?.includes("category")) {
      // Fallback: retry without category (keeps recurrence and other fields)
      const { data: d2 } = await supabase
        .from("transactions")
        .insert([{ name: payload.name, amount, type: payload.type, recurrence: payload.recurrence, transaction_date: payload.transaction_date, user_id: userId }])
        .select();
      if (d2) setTransactions(prev => [d2[0] as Transaction, ...prev]);
    }
  };

  const deleteTx = async (id: string) => {
    const item = transactions.find(t => t.id === id);
    if (!item) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      console.error('deleteTx failed:', error.message);
      setTransactions(prev => [item, ...prev]);
      return;
    }
    undoToast(`"${item.name}" removido`, () => {
      setTransactions(prev => [item, ...prev]);
      supabase.from("transactions").insert([item]);
    });
  };

  /* ── budget spend this month ── */
  const spentByCategory = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now).toISOString();
    const end   = endOfMonth(now).toISOString();
    return transactions
      .filter(t => t.type === "out" && t.transaction_date >= start && t.transaction_date <= end)
      .reduce<Record<string, number>>((acc, t) => {
        const cat = t.category || "Outros";
        acc[cat] = (acc[cat] || 0) + Number(t.amount);
        return acc;
      }, {});
  }, [transactions]);

  const addBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(budgetLimit.replace(",", "."));
    if (!budgetCategory || isNaN(limit) || limit <= 0) return;
    setShowBudgetModal(false);

    const existing = budgets.find(b => b.category === budgetCategory);
    if (existing) {
      const { data } = await supabase
        .from("budgets")
        .update({ monthly_limit: limit })
        .eq("id", existing.id)
        .select()
        .single();
      if (data) setBudgets(prev => prev.map(b => b.id === existing.id ? data as Budget : b));
    } else {
      const { data } = await supabase
        .from("budgets")
        .insert([{ category: budgetCategory, monthly_limit: limit, user_id: userId }])
        .select()
        .single();
      if (data) setBudgets(prev => [...prev, data as Budget]);
    }
    setBudgetLimit("");
  };

  const deleteBudget = async (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    await supabase.from("budgets").delete().eq("id", id);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (!mounted) return null;
  if (loading) return <SkeletonPage />;

  const categories = newType === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Nectar</h2>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Visão Financeira</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 px-3 py-2.5 rounded-full text-sm font-medium transition-all"
            title="Exportar PDF"
          >
            <Download size={16} /> PDF
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 px-3 py-2.5 rounded-full text-sm font-medium transition-all"
            title="Exportar CSV"
          >
            <Download size={16} /> CSV
          </button>
          <motion.button
            onClick={() => setShowModal(true)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-500/90 text-white px-4 py-2.5 rounded-full font-medium shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all text-sm"
          >
            <Plus size={17} /> Nova Transação
          </motion.button>
        </div>
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

      {/* Budget section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        className="glass-card p-6 mb-8"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Target size={18} className="text-primary" />
            Orçamento Mensal
          </h3>
          <button
            onClick={() => { setBudgetCategory("Alimentação"); setBudgetLimit(""); setShowBudgetModal(true); }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>

        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Target size={22} className="text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum orçamento definido.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Defina limites mensais por categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {budgets.map(b => {
              const spent = spentByCategory[b.category] || 0;
              const pct   = Math.min(100, b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0);
              const over  = spent > b.monthly_limit;
              const color = over ? "#ef4444" : pct >= 80 ? "#f59e0b" : getCategoryColor(b.category);
              return (
                <div key={b.id} className="group relative p-4 rounded-2xl bg-white/3 border border-white/8 hover:border-white/15 transition-all">
                  <button
                    onClick={() => deleteBudget(b.id)}
                    className="absolute top-3 right-3 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5"
                  >
                    <X size={13} />
                  </button>
                  <div className="flex items-center gap-2 mb-2 pr-5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(b.category) }} />
                    <span className="text-sm font-medium text-white truncate">{b.category}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-xl font-bold" style={{ color }}>{fmt(spent)}</span>
                    <span className="text-xs text-muted-foreground">/ {fmt(b.monthly_limit)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {over ? `⚠ Estourou ${fmt(spent - b.monthly_limit)}` : `${fmt(b.monthly_limit - spent)} restante`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Savings Goal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}
        className="glass-card p-6 mb-8"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <PiggyBank size={18} className="text-pink-400" />
            Meta de Poupança
          </h3>
          <button
            onClick={() => { setSavingsInput(savingsGoal > 0 ? savingsGoal.toString() : ""); setShowSavingsModal(true); }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={14} /> {savingsGoal > 0 ? "Editar meta" : "Definir meta"}
          </button>
        </div>

        {savingsGoal <= 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-3">
              <PiggyBank size={22} className="text-pink-400/50" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma meta definida.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Defina um valor alvo de poupança.</p>
          </div>
        ) : (() => {
          const current = Math.max(0, balance);
          const pct = Math.min(100, savingsGoal > 0 ? (current / savingsGoal) * 100 : 0);
          const done = current >= savingsGoal;
          return (
            <div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="text-3xl font-bold text-white">{fmt(current)}</span>
                  <span className="text-muted-foreground text-sm ml-2">de {fmt(savingsGoal)}</span>
                </div>
                <span className={`text-sm font-semibold ${done ? "text-emerald-400" : "text-pink-400"}`}>
                  {done ? "Meta atingida!" : `${Math.round(pct)}%`}
                </span>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-pink-400"}`}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {done ? `Parabéns! Você atingiu sua meta.` : `Faltam ${fmt(savingsGoal - current)} para atingir a meta.`}
              </p>
            </div>
          );
        })()}
      </motion.div>

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
                    {t.recurrence && t.recurrence !== "none" && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md border border-blue-500/30 text-blue-400 bg-blue-500/10">
                        {{ daily: "Diária", weekly: "Semanal", monthly: "Mensal" }[t.recurrence]}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                  {t.type === "in" ? "+" : "−"}{fmt(Number(t.amount))}
                </span>
                <button
                  onClick={() => deleteTx(t.id)}
                  className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Budget modal */}
      <AnimatePresence>
        {showBudgetModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl relative"
            >
              <button onClick={() => setShowBudgetModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
                <X size={22} />
              </button>
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Orçamento Mensal
              </h2>
              <form onSubmit={addBudget} className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Categoria</label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {EXPENSE_CATEGORIES.map(c => (
                      <button
                        key={c.label} type="button" onClick={() => setBudgetCategory(c.label)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-colors ${
                          budgetCategory === c.label ? "" : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                        }`}
                        style={budgetCategory === c.label ? { backgroundColor: `${c.color}20`, borderColor: `${c.color}50`, color: c.color } : {}}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Limite Mensal (R$)</label>
                  <input
                    type="number" step="0.01" autoFocus value={budgetLimit}
                    onChange={e => setBudgetLimit(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!budgetCategory || !budgetLimit}
                  className="mt-1 w-full py-3 rounded-xl font-medium bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction modal */}
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

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Repetição</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["none", "daily", "weekly", "monthly"] as const).map(r => {
                      const labels = { none: "Não repete", daily: "Diária", weekly: "Semanal", monthly: "Mensal" };
                      return (
                        <button key={r} type="button" onClick={() => setNewRecurrence(r)}
                          className={`py-2 rounded-xl text-xs font-medium border transition-colors ${newRecurrence === r ? 'bg-primary/20 text-primary border-primary/50' : 'bg-background border-white/5 text-muted-foreground hover:bg-white/5'}`}>
                          {labels[r]}
                        </button>
                      );
                    })}
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
        {/* Savings goal modal */}
        {showSavingsModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button onClick={() => setShowSavingsModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-2xl font-bold mb-2 text-white flex items-center gap-2">
                <PiggyBank size={22} className="text-pink-400" /> Meta de Poupança
              </h2>
              <p className="text-sm text-muted-foreground mb-6">Defina quanto você quer ter economizado (baseado no saldo total).</p>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const v = parseFloat(savingsInput.replace(",", "."));
                  if (isNaN(v) || v <= 0) return;
                  setSavingsGoal(v);
                  try { localStorage.setItem("c4person_savings_goal", v.toString()); } catch { /* noop */ }
                  setShowSavingsModal(false);
                }}
                className="flex flex-col gap-5"
              >
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Valor alvo (R$)</label>
                  <input
                    type="number" step="0.01" autoFocus value={savingsInput} onChange={e => setSavingsInput(e.target.value)}
                    placeholder="Ex: 10000"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                  />
                </div>
                <button
                  type="submit" disabled={!savingsInput}
                  className="mt-2 w-full bg-pink-500 hover:bg-pink-500/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar Meta
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

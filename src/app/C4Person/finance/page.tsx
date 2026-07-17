"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SkeletonPage } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { format, subMonths, startOfMonth, endOfMonth, addMonths, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, X, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Search, Trash2, PiggyBank, Target, Download,
  ChevronLeft, ChevronRight, Settings, Users, Copy, Check, CalendarDays, Pencil,
} from "lucide-react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategoryColor } from "@/lib/categories";

const CUSTOM_CAT_COLORS = ["#f43f5e","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#818cf8","#e879f9","#f472b6","#38bdf8"];

interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: "in" | "out";
  category: string | null;
  transaction_date: string;
  created_at: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  payment_source?: string[] | null;
}

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
}

interface Profile {
  salary_mode: "full" | "split";
  salary_amount: number;
  salary_amount_2: number;
  invite_code: string | null;
  partner_id: string | null;
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
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"in" | "out">("out");
  const [newCategory, setNewCategory] = useState("Outros");
  const [newRecurrence, setNewRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [newPaymentSources, setNewPaymentSources] = useState<string[]>(["Bolso (Salário)"]);

  const [savingsGoal, setSavingsGoal] = useState(0);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsInput, setSavingsInput] = useState("");

  /* ── custom categories ── */
  const [customExpCats, setCustomExpCats] = useState<{label:string;color:string}[]>([]);
  const [customIncCats, setCustomIncCats] = useState<{label:string;color:string}[]>([]);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const newCatInputRef = useRef<HTMLInputElement>(null);

  /* ── month navigation ── */
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  /* ── profile / salary / partner ── */
  const [profile, setProfile] = useState<Profile>({ salary_mode: "full", salary_amount: 0, salary_amount_2: 0, invite_code: null, partner_id: null });
  const [showSettings, setShowSettings] = useState(false);
  const [settingSalaryMode, setSettingSalaryMode] = useState<"full" | "split">("full");
  const [settingSalaryAmount, setSettingSalaryAmount] = useState("");
  const [settingSalaryAmount2, setSettingSalaryAmount2] = useState("");
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [partnerLoading, setPartnerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [txRes, budRes] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }),
      supabase.from("budgets").select("*").order("created_at", { ascending: true }),
    ]);
    if (txRes.data)  setTransactions(txRes.data as Transaction[]);
    if (budRes.data) setBudgets(budRes.data as Budget[]);
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("salary_mode,salary_amount,salary_amount_2,invite_code,partner_id").eq("id", uid).single();
    if (data) setProfile(data as Profile);
  }, []);

  /* ── derived: transactions filtered to viewMonth ── */
  const monthlyTx = useMemo(() =>
    transactions.filter(t => {
      if (!t.transaction_date) return false;
      try { return isSameMonth(parseISO(t.transaction_date), viewMonth); } catch { return false; }
    }),
    [transactions, viewMonth]
  );

  const totalIn  = useMemo(() => monthlyTx.filter(t => t.type === "in").reduce((s, t) => s + Number(t.amount), 0), [monthlyTx]);
  const totalOut = useMemo(() => monthlyTx.filter(t => t.type === "out").reduce((s, t) => s + Number(t.amount), 0), [monthlyTx]);
  const balance  = totalIn - totalOut;
  const savingsRate = totalIn > 0 ? Math.max(0, Math.round(((totalIn - totalOut) / totalIn) * 100)) : 0;

  /* ── monthly data (last 6 months) — always all-time for the bar chart ── */
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, "yyyy-MM");
      const month = transactions.filter(t =>
        t.transaction_date && format(parseISO(t.transaction_date), "yyyy-MM") === key
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

  /* ── category breakdown — filtered to viewMonth ── */
  const categoryData = useMemo(() => {
    const exp = monthlyTx.filter(t => t.type === "out");
    const bycat = exp.reduce<Record<string, number>>((acc, t) => {
      const cat = t.category || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {});
    const customAll = [...customExpCats, ...customIncCats];
    return Object.entries(bycat)
      .map(([label, value]) => ({
        label, value,
        color: customAll.find(c => c.label === label)?.color ?? getCategoryColor(label),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyTx, customExpCats, customIncCats]);

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

  /* ── wallet balances per payment source ── */
  const walletBalances = useMemo(() => {
    const voucherNames = new Set(customIncCats.map(c => c.label));

    // Each custom income category is a "voucher wallet"
    const vouchers = customIncCats.map(c => {
      const received = monthlyTx
        .filter(t => t.type === "in" && t.category === c.label)
        .reduce((s, t) => s + Number(t.amount), 0);
      const spent = monthlyTx
        .filter(t => t.type === "out" && Array.isArray(t.payment_source) && t.payment_source.includes(c.label))
        .reduce((s, t) => s + Number(t.amount), 0);
      return { label: c.label, color: c.color, received, spent, balance: received - spent };
    });

    // Bolso = all income NOT from a voucher category
    const bolsoReceived = monthlyTx
      .filter(t => t.type === "in" && !voucherNames.has(t.category || ""))
      .reduce((s, t) => s + Number(t.amount), 0);
    const bolsoSpent = monthlyTx
      .filter(t => t.type === "out" && Array.isArray(t.payment_source) && t.payment_source.includes("Bolso (Salário)"))
      .reduce((s, t) => s + Number(t.amount), 0);

    const bolso = { label: "Bolso (Salário)", color: "#10b981", received: bolsoReceived, spent: bolsoSpent, balance: bolsoReceived - bolsoSpent };

    return [bolso, ...vouchers].filter(w => w.received > 0 || w.spent > 0);
  }, [monthlyTx, customIncCats]);

  /* ── filtered list — also filtered to viewMonth ── */
  const filteredTx = useMemo(() => {
    return monthlyTx.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "all" || t.type === filterType;
      return matchSearch && matchType;
    });
  }, [monthlyTx, search, filterType]);

  /* ── budget spend for viewMonth ── */
  const spentByCategory = useMemo(() => {
    const start = startOfMonth(viewMonth).toISOString();
    const end   = endOfMonth(viewMonth).toISOString();
    return transactions
      .filter(t => t.type === "out" && t.transaction_date >= start && t.transaction_date <= end)
      .reduce<Record<string, number>>((acc, t) => {
        const cat = t.category || "Outros";
        acc[cat] = (acc[cat] || 0) + Number(t.amount);
        return acc;
      }, {});
  }, [transactions, viewMonth]);

  /* ── salary schedule banner ── */
  const isCurrentMonth = isSameMonth(viewMonth, new Date());
  const today = new Date().getDate();
  const salaryBannerVisible = isCurrentMonth && (profile.salary_amount > 0 || profile.salary_amount_2 > 0);
  const salaryDay5 = profile.salary_amount;
  const salaryDay15 = profile.salary_amount_2;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const exportPDF = () => {
    const monthLabel = format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR });
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const savingsRate = totalIn > 0 ? ((balance / totalIn) * 100).toFixed(1) : "0.0";

    const catRows = categoryData.map(c => {
      const pct = totalOut > 0 ? ((c.value / totalOut) * 100).toFixed(1) : "0";
      return `<tr>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:7px;vertical-align:middle"></span>${c.label}</td>
        <td style="text-align:right;font-weight:600;color:#ef4444">${fmt(c.value)}</td>
        <td style="text-align:right;color:#888">${pct}%</td>
        <td style="width:120px;padding-left:8px">
          <div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden">
            <div style="background:${c.color};height:100%;width:${pct}%;border-radius:4px"></div>
          </div>
        </td>
      </tr>`;
    }).join("");

    const walletRows = walletBalances.map(w => `
      <tr>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${w.color};margin-right:7px;vertical-align:middle"></span>${w.label}</td>
        <td style="text-align:right;color:#10b981">${fmt(w.received)}</td>
        <td style="text-align:right;color:#ef4444">${fmt(w.spent)}</td>
        <td style="text-align:right;font-weight:700;color:${w.balance >= 0 ? "#10b981" : "#ef4444"}">${fmt(w.balance)}</td>
      </tr>`).join("");

    const txRows = filteredTx.map((t, i) => {
      const isIn = t.type === "in";
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg}">
        <td style="color:#64748b">${t.transaction_date ? format(parseISO(t.transaction_date), "dd/MM") : "—"}</td>
        <td style="font-weight:500">${t.name}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:${isIn ? "#dcfce7" : "#fee2e2"};color:${isIn ? "#16a34a" : "#dc2626"}">${isIn ? "Receita" : "Despesa"}</span></td>
        <td style="color:#64748b">${t.category || "Outros"}</td>
        <td style="text-align:right;font-weight:700;color:${isIn ? "#10b981" : "#ef4444"}">${isIn ? "+" : "−"}${fmt(Number(t.amount))}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>C4Person — Relatório ${monthLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#1e293b;font-size:12px}
  .page{max-width:900px;margin:0 auto;padding:32px 24px}

  /* Header */
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:16px;padding:28px 32px;color:#fff;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
  .header-left h1{font-size:22px;font-weight:700;letter-spacing:-0.5px}
  .header-left p{color:#94a3b8;margin-top:4px;font-size:12px}
  .header-right{text-align:right}
  .header-right .month{font-size:28px;font-weight:800;letter-spacing:-1px;text-transform:capitalize}
  .header-right .exported{color:#94a3b8;font-size:11px;margin-top:4px}

  /* KPI cards */
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
  .kpi{background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .kpi .kpi-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:8px}
  .kpi .kpi-value{font-size:20px;font-weight:800;letter-spacing:-0.5px}
  .kpi .kpi-sub{font-size:10px;color:#94a3b8;margin-top:4px}
  .green{color:#10b981}
  .red{color:#ef4444}
  .blue{color:#3b82f6}

  /* Section */
  .section{background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;overflow:hidden}
  .section-header{padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px}
  .section-header h2{font-size:13px;font-weight:700;color:#1e293b}
  .section-header .badge{font-size:10px;font-weight:600;background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:20px}
  .section-body{padding:4px 0}

  table{width:100%;border-collapse:collapse}
  th{padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #f1f5f9}
  td{padding:9px 16px;font-size:12px;border-bottom:1px solid #f8fafc}
  tr:last-child td{border-bottom:none}

  /* Footer */
  .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0}

  @media print{
    body{background:#fff}
    .page{padding:16px}
    .kpi-grid{grid-template-columns:repeat(4,1fr)}
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Relatório Financeiro</h1>
      <p>C4Person · Resumo do período</p>
    </div>
    <div class="header-right">
      <div class="month">${monthLabel}</div>
      <div class="exported">Gerado em ${now}</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Total Receitas</div>
      <div class="kpi-value green">${fmt(totalIn)}</div>
      <div class="kpi-sub">${filteredTx.filter(t=>t.type==="in").length} lançamento(s)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Despesas</div>
      <div class="kpi-value red">${fmt(totalOut)}</div>
      <div class="kpi-sub">${filteredTx.filter(t=>t.type==="out").length} lançamento(s)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Saldo do Mês</div>
      <div class="kpi-value ${balance >= 0 ? "green" : "red"}">${fmt(balance)}</div>
      <div class="kpi-sub">${balance >= 0 ? "Saldo positivo" : "Saldo negativo"}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Taxa de Poupança</div>
      <div class="kpi-value blue">${savingsRate}%</div>
      <div class="kpi-sub">da receita poupada</div>
    </div>
  </div>

  ${categoryData.length > 0 ? `
  <!-- Despesas por Categoria -->
  <div class="section">
    <div class="section-header">
      <h2>Despesas por Categoria</h2>
      <span class="badge">${categoryData.length} categorias</span>
    </div>
    <div class="section-body">
      <table>
        <thead><tr><th>Categoria</th><th style="text-align:right">Valor</th><th style="text-align:right">% do total</th><th>Distribuição</th></tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>
  </div>` : ""}

  ${walletBalances.length > 0 ? `
  <!-- Saldo por Carteira -->
  <div class="section">
    <div class="section-header">
      <h2>Saldo por Carteira</h2>
      <span class="badge">${walletBalances.length} carteira(s)</span>
    </div>
    <div class="section-body">
      <table>
        <thead><tr><th>Carteira</th><th style="text-align:right">Recebido</th><th style="text-align:right">Gasto</th><th style="text-align:right">Saldo</th></tr></thead>
        <tbody>${walletRows}</tbody>
      </table>
    </div>
  </div>` : ""}

  <!-- Lançamentos -->
  <div class="section">
    <div class="section-header">
      <h2>Lançamentos</h2>
      <span class="badge">${filteredTx.length} itens</span>
    </div>
    <div class="section-body">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>${txRows}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">C4Person · Relatório gerado automaticamente · ${now}</div>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const exportSheet = () => {
    const monthLabel = format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR });
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const savingsRate = totalIn > 0 ? ((balance / totalIn) * 100).toFixed(1) : "0.0";
    const filename = `financas_${format(viewMonth, "yyyy-MM")}`;

    const catRows = categoryData.map((c, i) => {
      const pct = totalOut > 0 ? ((c.value / totalOut) * 100).toFixed(1) : "0";
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg}">
        <td style="padding:10px 16px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:8px;vertical-align:middle"></span>
          <span style="font-weight:500">${c.label}</span>
        </td>
        <td style="padding:10px 16px;text-align:right;font-weight:700;color:#ef4444">${fmt(c.value)}</td>
        <td style="padding:10px 16px;text-align:right;color:#64748b">${pct}%</td>
        <td style="padding:10px 24px 10px 8px">
          <div style="background:#e2e8f0;border-radius:99px;height:7px;width:120px;overflow:hidden">
            <div style="background:${c.color};height:100%;width:${pct}%;border-radius:99px"></div>
          </div>
        </td>
      </tr>`;
    }).join("");

    const walletRows = walletBalances.map((w, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg}">
        <td style="padding:10px 16px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${w.color};margin-right:8px;vertical-align:middle"></span>
          <span style="font-weight:500">${w.label}</span>
        </td>
        <td style="padding:10px 16px;text-align:right;color:#10b981;font-weight:600">${fmt(w.received)}</td>
        <td style="padding:10px 16px;text-align:right;color:#ef4444;font-weight:600">${fmt(w.spent)}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:800;font-size:14px;color:${w.balance >= 0 ? "#10b981" : "#ef4444"}">${fmt(w.balance)}</td>
      </tr>`;
    }).join("");

    const txRows = filteredTx.map((t, i) => {
      const isIn = t.type === "in";
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const sources = Array.isArray(t.payment_source) && t.payment_source.length > 0
        ? t.payment_source.join(" + ")
        : "—";
      return `<tr style="background:${bg}">
        <td style="padding:9px 16px;color:#64748b;white-space:nowrap">${t.transaction_date ? format(parseISO(t.transaction_date), "dd/MM/yyyy") : "—"}</td>
        <td style="padding:9px 16px;font-weight:500">${t.name}</td>
        <td style="padding:9px 16px">
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.3px;background:${isIn ? "#dcfce7" : "#fee2e2"};color:${isIn ? "#16a34a" : "#dc2626"}">
            ${isIn ? "RECEITA" : "DESPESA"}
          </span>
        </td>
        <td style="padding:9px 16px;color:#64748b">${t.category || "Outros"}</td>
        <td style="padding:9px 16px;color:#94a3b8;font-size:11px">${sources}</td>
        <td style="padding:9px 16px;text-align:right;font-weight:700;font-size:13px;color:${isIn ? "#10b981" : "#ef4444"}">${isIn ? "+" : "−"}${fmt(Number(t.amount))}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>C4Person · ${monthLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f1f5f9;color:#1e293b;min-height:100vh;padding:32px 16px}
  .wrap{max-width:960px;margin:0 auto}

  .hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e293b 100%);border-radius:20px;padding:36px 40px;color:#fff;margin-bottom:28px;position:relative;overflow:hidden}
  .hero::before{content:"";position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(59,130,246,.15)}
  .hero::after{content:"";position:absolute;bottom:-40px;left:30%;width:140px;height:140px;border-radius:50%;background:rgba(16,185,129,.1)}
  .hero-inner{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end}
  .hero h1{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:6px}
  .hero .app{font-size:26px;font-weight:800;letter-spacing:-1px}
  .hero .app span{color:#3b82f6}
  .hero-right{text-align:right}
  .hero-right .month{font-size:32px;font-weight:900;letter-spacing:-1.5px;text-transform:capitalize;line-height:1}
  .hero-right .meta{color:#94a3b8;font-size:11px;margin-top:6px}

  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
  .kpi{background:#fff;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.05);position:relative;overflow:hidden}
  .kpi::after{content:"";position:absolute;top:0;left:0;right:0;height:3px;border-radius:14px 14px 0 0;background:var(--accent,#e2e8f0)}
  .kpi.g{--accent:#10b981} .kpi.r{--accent:#ef4444} .kpi.b{--accent:#3b82f6} .kpi.v{--accent:#8b5cf6}
  .kpi-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:10px}
  .kpi-val{font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:1}
  .kpi.g .kpi-val{color:#10b981} .kpi.r .kpi-val{color:#ef4444} .kpi.b .kpi-val{color:#3b82f6} .kpi.v .kpi-val{color:#8b5cf6}
  .kpi-sub{font-size:11px;color:#94a3b8;margin-top:6px}

  .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}

  .card{background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.05);overflow:hidden;margin-bottom:16px}
  .card-head{padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between}
  .card-head h2{font-size:13px;font-weight:700;color:#0f172a}
  .card-head .chip{font-size:10px;font-weight:700;background:#f1f5f9;color:#64748b;padding:3px 10px;border-radius:20px;letter-spacing:.3px}

  table{width:100%;border-collapse:collapse}
  th{padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #f1f5f9}
  th:last-child{text-align:right;padding-right:20px}

  .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0}
  .footer strong{color:#64748b}
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <div class="hero-inner">
      <div>
        <h1>Relatório Financeiro</h1>
        <div class="app">C4<span>Person</span></div>
      </div>
      <div class="hero-right">
        <div class="month">${monthLabel}</div>
        <div class="meta">Exportado em ${now}</div>
      </div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi g">
      <div class="kpi-lbl">Receitas</div>
      <div class="kpi-val">${fmt(totalIn)}</div>
      <div class="kpi-sub">${filteredTx.filter(t => t.type === "in").length} lançamento(s)</div>
    </div>
    <div class="kpi r">
      <div class="kpi-lbl">Despesas</div>
      <div class="kpi-val">${fmt(totalOut)}</div>
      <div class="kpi-sub">${filteredTx.filter(t => t.type === "out").length} lançamento(s)</div>
    </div>
    <div class="kpi ${balance >= 0 ? "g" : "r"}">
      <div class="kpi-lbl">Saldo do Mês</div>
      <div class="kpi-val">${fmt(balance)}</div>
      <div class="kpi-sub">${balance >= 0 ? "✓ Positivo" : "✕ Negativo"}</div>
    </div>
    <div class="kpi v">
      <div class="kpi-lbl">Taxa de Poupança</div>
      <div class="kpi-val">${savingsRate}%</div>
      <div class="kpi-sub">da receita guardada</div>
    </div>
  </div>

  <div class="cols">
    ${categoryData.length > 0 ? `
    <div class="card">
      <div class="card-head">
        <h2>Despesas por Categoria</h2>
        <span class="chip">${categoryData.length} categorias</span>
      </div>
      <table>
        <thead><tr>
          <th>Categoria</th>
          <th style="text-align:right">Valor</th>
          <th style="text-align:right;padding-right:20px">%</th>
          <th></th>
        </tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>` : ""}

    ${walletBalances.length > 0 ? `
    <div class="card">
      <div class="card-head">
        <h2>Saldo por Carteira</h2>
        <span class="chip">${walletBalances.length} carteira(s)</span>
      </div>
      <table>
        <thead><tr>
          <th>Carteira</th>
          <th style="text-align:right">Recebido</th>
          <th style="text-align:right">Gasto</th>
          <th style="text-align:right;padding-right:16px">Saldo</th>
        </tr></thead>
        <tbody>${walletRows}</tbody>
      </table>
    </div>` : ""}
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Todos os Lançamentos</h2>
      <span class="chip">${filteredTx.length} itens</span>
    </div>
    <table>
      <thead><tr>
        <th>Data</th>
        <th>Descrição</th>
        <th>Tipo</th>
        <th>Categoria</th>
        <th>Origem</th>
        <th style="text-align:right;padding-right:20px">Valor</th>
      </tr></thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>

  <div class="footer">
    Relatório gerado pelo <strong>C4Person</strong> · ${now}
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchProfile(user.id);
      }
    });
    fetchData().finally(() => setLoading(false));
    try {
      const stored = localStorage.getItem("c4person_savings_goal");
      if (stored) setSavingsGoal(parseFloat(stored));
      const ec = localStorage.getItem("c4_custom_expense_cats");
      const ic = localStorage.getItem("c4_custom_income_cats");
      if (ec) setCustomExpCats(JSON.parse(ec));
      if (ic) setCustomIncCats(JSON.parse(ic));
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
  }, [fetchData, fetchProfile]);

  /* ── handlers ── */
  const resetModal = () => {
    setShowModal(false);
    setEditingTx(null);
    setNewName(""); setNewAmount(""); setNewType("out"); setNewCategory("Outros");
    setNewRecurrence("none"); setNewPaymentSources(["Bolso (Salário)"]);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setNewName(tx.name);
    setNewAmount(String(tx.amount));
    setNewType(tx.type);
    setNewCategory(tx.category || "Outros");
    setNewRecurrence(tx.recurrence || "none");
    setNewPaymentSources(tx.payment_source && tx.payment_source.length > 0 ? tx.payment_source : ["Bolso (Salário)"]);
    setShowModal(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!newName.trim() || isNaN(amount)) return;

    const fields = {
      name: newName,
      amount,
      type: newType,
      category: newCategory,
      recurrence: newRecurrence,
      payment_source: newType === "out" && newPaymentSources.length > 0 ? newPaymentSources : null,
    };

    if (editingTx) {
      // UPDATE
      const original = editingTx;
      resetModal();
      setTransactions(prev => prev.map(t => t.id === original.id ? { ...t, ...fields } : t));
      const { error } = await supabase.from("transactions").update(fields).eq("id", original.id);
      if (error) {
        console.error("updateTx failed:", error.message);
        setTransactions(prev => prev.map(t => t.id === original.id ? original : t));
      }
      return;
    }

    // INSERT
    const payload = { ...fields, transaction_date: new Date().toISOString(), user_id: userId };
    resetModal();

    const { data, error } = await supabase.from("transactions").insert([payload]).select();
    if (data) {
      setTransactions(prev => [data[0] as Transaction, ...prev]);
    } else if (error?.message?.includes("category")) {
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

  /* ── quick-add salary installment ── */
  const addSalaryTx = async (amount: number, label: string) => {
    const payload = {
      name: label,
      amount,
      type: "in" as const,
      category: "Salário",
      recurrence: "none" as const,
      transaction_date: new Date().toISOString(),
      user_id: userId,
    };
    const { data } = await supabase.from("transactions").insert([payload]).select();
    if (data) setTransactions(prev => [data[0] as Transaction, ...prev]);
  };

  /* ── settings save ── */
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount  = parseFloat(settingSalaryAmount.replace(",", "."));
    const amount2 = parseFloat(settingSalaryAmount2.replace(",", "."));
    const updates: Partial<Profile> = {
      salary_mode:     settingSalaryMode,
      salary_amount:   isNaN(amount)  ? 0 : amount,
      salary_amount_2: isNaN(amount2) ? 0 : amount2,
    };
    await supabase.from("profiles").update(updates).eq("id", userId);
    setProfile(prev => ({ ...prev, ...updates }));
    setShowSettings(false);
  };

  /* ── partner connection ── */
  const connectPartner = async () => {
    if (!partnerCodeInput.trim()) return;
    setPartnerLoading(true);
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("invite_code", partnerCodeInput.trim().toUpperCase())
      .single();

    if (!partnerProfile) {
      setPartnerLoading(false);
      alert("Código não encontrado. Verifique e tente novamente.");
      return;
    }

    await Promise.all([
      supabase.from("profiles").update({ partner_id: partnerProfile.id }).eq("id", userId),
      supabase.from("profiles").update({ partner_id: userId }).eq("id", partnerProfile.id),
    ]);

    setProfile(prev => ({ ...prev, partner_id: partnerProfile.id }));
    setPartnerLoading(false);
    setShowSettings(false);
  };

  const disconnectPartner = async () => {
    if (profile.partner_id) {
      await supabase.from("profiles").update({ partner_id: null }).eq("id", profile.partner_id);
    }
    await supabase.from("profiles").update({ partner_id: null }).eq("id", userId);
    setProfile(prev => ({ ...prev, partner_id: null }));
  };

  const copyInviteCode = () => {
    if (!profile.invite_code) return;
    navigator.clipboard.writeText(profile.invite_code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  /* ── payment sources ── */
  const paymentSources = useMemo(() => [
    "Bolso (Salário)",
    ...customIncCats.map(c => c.label),
  ], [customIncCats]);

  const togglePaymentSource = (src: string) => {
    setNewPaymentSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    );
  };

  /* ── add custom category ── */
  const addCustomCategory = () => {
    const name = newCatName.trim();
    if (!name) { setAddingCat(false); return; }
    const isIncome = newType === "in";
    const base = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = isIncome ? customIncCats : customExpCats;
    const all = [...base, ...custom];
    const existing = all.find(c => c.label.toLowerCase() === name.toLowerCase());
    if (existing) { setNewCategory(existing.label); setAddingCat(false); setNewCatName(""); return; }
    const color = CUSTOM_CAT_COLORS[custom.length % CUSTOM_CAT_COLORS.length];
    const cat = { label: name, color };
    if (isIncome) {
      const updated = [...customIncCats, cat];
      setCustomIncCats(updated);
      try { localStorage.setItem("c4_custom_income_cats", JSON.stringify(updated)); } catch { /* noop */ }
    } else {
      const updated = [...customExpCats, cat];
      setCustomExpCats(updated);
      try { localStorage.setItem("c4_custom_expense_cats", JSON.stringify(updated)); } catch { /* noop */ }
    }
    setNewCategory(name);
    setAddingCat(false);
    setNewCatName("");
  };

  /* ── local color resolver (base + custom) ── */
  const allCustomCats = [...customExpCats, ...customIncCats];
  const getCatColor = (label: string) =>
    allCustomCats.find(c => c.label === label)?.color ?? getCategoryColor(label);

  if (!mounted) return null;
  if (loading) return <SkeletonPage />;

  const categories = newType === "in"
    ? [...INCOME_CATEGORIES, ...customIncCats]
    : [...EXPENSE_CATEGORIES, ...customExpCats];
  const isThisMonth = isSameMonth(viewMonth, new Date());

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground text-xs md:text-sm font-medium uppercase tracking-wider">
              Visão Financeira
            </span>
            {profile.partner_id && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <Users size={10} /> Conta Conjunta
              </span>
            )}
          </div>
          {/* Month navigation */}
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => setViewMonth(m => startOfMonth(addMonths(m, -1)))}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight capitalize">
              {format(viewMonth, "MMMM yyyy", { locale: ptBR })}
            </h1>
            <button
              onClick={() => setViewMonth(m => startOfMonth(addMonths(m, 1)))}
              disabled={isThisMonth}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
            {!isThisMonth && (
              <button
                onClick={() => setViewMonth(startOfMonth(new Date()))}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Hoje
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setSettingSalaryMode(profile.salary_mode); setSettingSalaryAmount(profile.salary_amount > 0 ? profile.salary_amount.toString() : ""); setSettingSalaryAmount2(profile.salary_amount_2 > 0 ? profile.salary_amount_2.toString() : ""); setShowSettings(true); }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 px-3 py-2.5 rounded-full text-sm font-medium transition-all"
            title="Configurações Financeiras"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 px-3 py-2.5 rounded-full text-sm font-medium transition-all"
            title="Exportar PDF"
          >
            <Download size={16} /> PDF
          </button>
          <button
            onClick={exportSheet}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 px-3 py-2.5 rounded-full text-sm font-medium transition-all"
            title="Exportar Planilha HTML"
          >
            <Download size={16} /> Planilha
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

      {/* Salary banner */}
      <AnimatePresence>
        {salaryBannerVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                💰 Salário de {format(viewMonth, "MMMM", { locale: ptBR })}
              </p>
              {profile.salary_mode === "full" ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmt(salaryDay5)} · pagamento único até dia 5
                  {today <= 5 ? " (ainda não registrado?)" : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  1ª parcela dia 5: {fmt(salaryDay5)} · 2ª parcela dia 15: {fmt(salaryDay15)}
                  {salaryDay5 + salaryDay15 > 0 && ` · Total: ${fmt(salaryDay5 + salaryDay15)}`}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {profile.salary_mode === "full" ? (
                <button
                  onClick={() => addSalaryTx(profile.salary_amount, "Salário")}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                >
                  + Registrar {fmt(profile.salary_amount)}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => addSalaryTx(salaryDay5, "Salário (1ª parcela)")}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                  >
                    + 1ª {fmt(salaryDay5)}
                  </button>
                  <button
                    onClick={() => addSalaryTx(salaryDay15, "Salário (2ª parcela)")}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                  >
                    + 2ª {fmt(salaryDay15)}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Saldo do Mês", value: fmt(balance), icon: Wallet,
            color: balance >= 0 ? "text-white" : "text-red-400",
            bg: "bg-white/5", iconColor: "text-emerald-400",
            sub: balance >= 0 ? "Positivo" : "Negativo",
            subColor: balance >= 0 ? "text-emerald-400" : "text-red-400",
            TrendIcon: balance >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label: "Receitas", value: fmt(totalIn), icon: ArrowUpRight,
            color: "text-emerald-400", bg: "bg-emerald-500/10", iconColor: "text-emerald-400",
            sub: `${monthlyTx.filter(t => t.type === "in").length} entrada${monthlyTx.filter(t => t.type === "in").length !== 1 ? "s" : ""}`,
            subColor: "text-muted-foreground", TrendIcon: ArrowUpRight,
          },
          {
            label: "Despesas", value: fmt(totalOut), icon: ArrowDownRight,
            color: "text-red-400", bg: "bg-red-500/10", iconColor: "text-red-400",
            sub: `${monthlyTx.filter(t => t.type === "out").length} saída${monthlyTx.filter(t => t.type === "out").length !== 1 ? "s" : ""}`,
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

      {/* Wallet balances */}
      {walletBalances.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="mb-8"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Saldo por Carteira — {format(viewMonth, "MMMM", { locale: ptBR })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {walletBalances.map(w => {
              const isNeg = w.balance < 0;
              const pct = w.received > 0 ? Math.min(100, (w.spent / w.received) * 100) : 0;
              return (
                <div
                  key={w.label}
                  className="glass-card p-4 relative overflow-hidden"
                  style={{ borderColor: `${w.color}20` }}
                >
                  {/* subtle tint bar */}
                  <div
                    className="absolute top-0 left-0 h-0.5 transition-all"
                    style={{ width: `${pct}%`, backgroundColor: isNeg ? "#ef4444" : w.color }}
                  />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: w.color }} />
                    <span className="text-xs font-semibold text-white truncate">{w.label}</span>
                  </div>
                  <p className={`text-xl font-bold mb-2 ${isNeg ? "text-red-400" : "text-white"}`}>
                    {fmt(w.balance)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">restante</span>
                  </p>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="text-emerald-400">+{fmt(w.received)}</span>
                    <span className="text-red-400">−{fmt(w.spent)}</span>
                  </div>
                  {/* progress bar */}
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: isNeg ? "#ef4444" : w.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

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
              Nenhuma despesa em {format(viewMonth, "MMMM", { locale: ptBR })}.
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <div
                  className="w-28 h-28 rounded-full"
                  style={{ background: conicGradient }}
                />
                <div className="absolute inset-3 rounded-full bg-card flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{fmt(totalOut)}</span>
                </div>
              </div>
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
              placeholder={`Buscar em ${format(viewMonth, "MMMM", { locale: ptBR })}…`}
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhuma transação encontrada." : `Nenhuma transação em ${format(viewMonth, "MMMM yyyy", { locale: ptBR })}.`}
            </p>
          </div>
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
                        ? format(parseISO(t.transaction_date), "d 'de' MMM", { locale: ptBR })
                        : "—"}
                    </span>
                    {t.category && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md border"
                        style={{
                          color: getCatColor(t.category),
                          backgroundColor: `${getCatColor(t.category)}18`,
                          borderColor: `${getCatColor(t.category)}30`,
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
                    {t.type === "out" && t.payment_source && t.payment_source.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md border border-white/10 text-muted-foreground bg-white/5">
                        {t.payment_source.length === 1
                          ? t.payment_source[0]
                          : `Misto (${t.payment_source.length})`}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                  {t.type === "in" ? "+" : "−"}{fmt(Number(t.amount))}
                </span>
                <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                    title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteTx(t.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Modals ── */}

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
                <X size={22} />
              </button>
              <h2 className="text-xl font-bold mb-1 text-white flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                Configurações Financeiras
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Salário e conta conjunta com parceiro(a)</p>

              {/* Salary settings */}
              <form onSubmit={saveSettings} className="flex flex-col gap-5 mb-6">
                <div>
                  <label className="text-sm font-medium text-white mb-3 block">Modo de recebimento do salário</label>
                  <div className="flex gap-3">
                    {(["full", "split"] as const).map(m => (
                      <button
                        key={m} type="button" onClick={() => setSettingSalaryMode(m)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                          settingSalaryMode === m
                            ? "bg-primary/20 text-primary border-primary/50"
                            : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                        }`}
                      >
                        <div className="font-semibold">{m === "full" ? "Integral" : "Dividido"}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">
                          {m === "full" ? "100% até dia 5" : "50% dia 5 + 50% dia 15"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {settingSalaryMode === "full" ? (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Valor do salário (R$)</label>
                    <input
                      type="number" step="0.01" value={settingSalaryAmount}
                      onChange={e => setSettingSalaryAmount(e.target.value)}
                      placeholder="Ex: 5000"
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground/60 mt-1.5">Pagamento integral até o dia 5</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        1ª parcela — até dia 5 (R$)
                      </label>
                      <input
                        type="number" step="0.01" value={settingSalaryAmount}
                        onChange={e => setSettingSalaryAmount(e.target.value)}
                        placeholder="Ex: 2500"
                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      <p className="text-xs text-muted-foreground/60 mt-1">Inclui adiantamento, horas extras, etc.</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        2ª parcela — dia 15 (R$)
                      </label>
                      <input
                        type="number" step="0.01" value={settingSalaryAmount2}
                        onChange={e => setSettingSalaryAmount2(e.target.value)}
                        placeholder="Ex: 3200"
                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      <p className="text-xs text-muted-foreground/60 mt-1">Inclui sobreaviso, bônus, etc.</p>
                    </div>
                    {(settingSalaryAmount || settingSalaryAmount2) && (
                      <p className="text-xs text-emerald-400 font-medium">
                        Total estimado: {fmt((parseFloat(settingSalaryAmount || "0") || 0) + (parseFloat(settingSalaryAmount2 || "0") || 0))}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-medium bg-primary hover:bg-primary/90 text-white transition-colors"
                >
                  Salvar configurações
                </button>
              </form>

              {/* Partner / shared finance */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Users size={16} className="text-emerald-400" />
                  Conta Conjunta
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Compartilhe as finanças com seu(sua) parceiro(a). Ambos verão as mesmas transações.
                </p>

                {profile.partner_id ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-medium">Conta conjunta ativa</span>
                    </div>
                    <button
                      onClick={disconnectPartner}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Your invite code */}
                    {profile.invite_code && (
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-xs text-muted-foreground mb-2">Seu código de convite:</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-lg font-mono font-bold text-white tracking-widest">{profile.invite_code}</span>
                          <button
                            onClick={copyInviteCode}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                              copiedCode
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10"
                            }`}
                          >
                            {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                            {copiedCode ? "Copiado!" : "Copiar"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-1.5">Compartilhe este código com seu(sua) parceiro(a)</p>
                      </div>
                    )}

                    {/* Enter partner code */}
                    <div className="flex gap-2">
                      <input
                        type="text" value={partnerCodeInput}
                        onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())}
                        placeholder="Código do(a) parceiro(a)"
                        maxLength={8}
                        className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-3 text-white font-mono tracking-widest text-sm focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:tracking-normal placeholder:font-sans"
                      />
                      <button
                        onClick={connectPartner}
                        disabled={partnerLoading || !partnerCodeInput.trim()}
                        className="px-4 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {partnerLoading ? "…" : "Conectar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                onClick={resetModal}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <Wallet size={22} className="text-emerald-400" />
                {editingTx ? "Editar Transação" : "Nova Transação"}
              </h2>

              <form onSubmit={handleAdd} className="flex flex-col gap-5">
                {/* Tipo */}
                <div className="flex gap-3">
                  {(["out", "in"] as const).map(t => (
                    <button
                      key={t} type="button" onClick={() => { setNewType(t); setNewCategory("Outros"); setNewPaymentSources(["Bolso (Salário)"]); }}
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
                    {/* Add custom category */}
                    {addingCat ? (
                      <input
                        ref={newCatInputRef}
                        autoFocus
                        type="text"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        onBlur={addCustomCategory}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); }
                          if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); }
                        }}
                        placeholder="Nova…"
                        maxLength={20}
                        className="py-2 px-2 rounded-xl text-xs font-medium border border-primary/50 bg-primary/10 text-white focus:outline-none col-span-1 text-center"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAddingCat(true); setNewCatName(""); }}
                        className="py-2 px-1 rounded-xl text-xs font-medium border border-dashed border-white/20 text-muted-foreground hover:text-white hover:border-white/40 text-center transition-all"
                      >
                        + Nova
                      </button>
                    )}
                  </div>
                </div>

                {/* Payment source — expense only */}
                {newType === "out" && paymentSources.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      De onde sai o dinheiro?
                      {newPaymentSources.length > 1 && (
                        <span className="ml-2 text-xs text-primary font-normal">Misto selecionado</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {paymentSources.map(src => {
                        const selected = newPaymentSources.includes(src);
                        const isBolso  = src === "Bolso (Salário)";
                        const color    = isBolso ? "#10b981" : (customIncCats.find(c => c.label === src)?.color ?? "#8b5cf6");
                        return (
                          <button
                            key={src} type="button"
                            onClick={() => togglePaymentSource(src)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                            style={selected ? {
                              backgroundColor: `${color}20`,
                              borderColor: `${color}50`,
                              color,
                            } : {}}
                            {...(!selected && { className: "px-3 py-1.5 rounded-xl text-xs font-medium border bg-background border-white/5 text-muted-foreground hover:bg-white/5 transition-all" })}
                          >
                            {isBolso ? "💵 " : "💳 "}{src}
                            {selected && " ✓"}
                          </button>
                        );
                      })}
                    </div>
                    {newPaymentSources.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">Selecione ao menos uma fonte</p>
                    )}
                  </div>
                )}

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
                  {editingTx ? "Salvar alterações" : "Adicionar"}
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
              <p className="text-sm text-muted-foreground mb-6">Defina quanto você quer ter economizado (baseado no saldo do mês).</p>
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

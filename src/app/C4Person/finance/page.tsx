"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false }
);
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
  CreditCard, Sparkles, Loader2,
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
  source?: string | null;
}

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
}

interface Debt {
  id: string;
  user_id: string;
  name: string;
  creditor: string | null;
  total_amount: number;
  paid_amount: number;
  status: "active" | "quitada";
  created_at: string;
}

interface BankAccount {
  id: string;
  pluggy_account_id: string;
  name: string;
  type: string;
  balance: number;
  institution_name: string | null;
  institution_logo_url: string | null;
  last_synced_at: string | null;
  credit_limit?: number | null;
  available_credit?: number | null;
}

interface Profile {
  salary_mode: "full" | "split";
  salary_amount: number;
  salary_amount_2: number;
  invite_code: string | null;
  partner_id: string | null;
  pluggy_item_id: string | null;
  pluggy_client_id: string | null;
  pluggy_client_secret: string | null;
  last_pluggy_sync_at: string | null;
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
  const [profile, setProfile] = useState<Profile>({ salary_mode: "full", salary_amount: 0, salary_amount_2: 0, invite_code: null, partner_id: null, pluggy_item_id: null, pluggy_client_id: null, pluggy_client_secret: null, last_pluggy_sync_at: null });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [pluggyConnecting, setPluggyConnecting] = useState(false);
  const [pluggySyncing, setPluggySyncing] = useState(false);
  const [pluggyToken, setPluggyToken] = useState<string | null>(null);
  const [pluggyClientId, setPluggyClientId] = useState("");
  const [pluggyClientSecret, setPluggyClientSecret] = useState("");
  const [pluggyCredSaving, setPluggyCredSaving] = useState(false);
  const [pluggyDisconnecting, setPluggyDisconnecting] = useState(false);
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [showPluggySecret, setShowPluggySecret] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"salary" | "debts" | "partner">("salary");
  const [settingSalaryMode, setSettingSalaryMode] = useState<"full" | "split">("full");
  const [settingSalaryAmount, setSettingSalaryAmount] = useState("");
  const [settingSalaryAmount2, setSettingSalaryAmount2] = useState("");
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [partnerLoading, setPartnerLoading] = useState(false);

  /* ── debts ── */
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtCreditor, setNewDebtCreditor] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [payDebtId, setPayDebtId] = useState<string | null>(null);
  const [payDebtAmount, setPayDebtAmount] = useState("");
  const [payDebtNotes, setPayDebtNotes] = useState("");
  const [debtAiAnalysis, setDebtAiAnalysis] = useState("");
  const [debtAiLoading, setDebtAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [txRes, budRes, debtRes, baRes] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }),
      supabase.from("budgets").select("*").order("created_at", { ascending: true }),
      supabase.from("debts").select("*").order("created_at", { ascending: true }),
      supabase.from("bank_accounts").select("*").order("institution_name", { ascending: true }),
    ]);
    if (txRes.data)   setTransactions(txRes.data as Transaction[]);
    if (budRes.data)  setBudgets(budRes.data as Budget[]);
    if (debtRes.data) setDebts(debtRes.data as Debt[]);
    if (baRes.data)   setBankAccounts(baRes.data as BankAccount[]);
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("salary_mode,salary_amount,salary_amount_2,invite_code,partner_id,pluggy_item_id,pluggy_client_id,pluggy_client_secret,last_pluggy_sync_at").eq("id", uid).single();
    if (data) {
      setProfile(data as Profile);
      setPluggyClientId(data.pluggy_client_id ?? "");
      setPluggyClientSecret(data.pluggy_client_secret ?? "");
    }
    const { data: baData } = await supabase.from("bank_accounts").select("*").eq("user_id", uid).order("name");
    if (baData) setBankAccounts(baData as BankAccount[]);
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

  /* ── financial health ── */
  const activeDebts = useMemo(() => debts.filter(d => d.status === "active"), [debts]);

  const totalDebtRemaining = useMemo(() =>
    activeDebts.reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0),
    [activeDebts]
  );

  const totalBankBalance = useMemo(() =>
    bankAccounts
      .filter(ba => !["CREDIT_CARD","CREDIT","LOAN","FINANCING"].includes(ba.type))
      .reduce((s, ba) => s + Number(ba.balance), 0),
    [bankAccounts]
  );

  const institutionKey = useCallback((rawName: string): string => {
    const n = rawName.toLowerCase()
      .replace(/\bpic\s+pay\b/g, "picpay")
      .replace(/[^a-z0-9\s]/g, "").trim();
    const words = n.split(/\s+/);
    const skip = new Set(["banco", "bank", "bco", "sa", "s/a"]);
    const first = words[0] ?? n;
    return skip.has(first) ? (words[1] ?? first) : first;
  }, []);

  const banksByInstitution = useMemo(() => {
    const groups: Record<string, { displayName: string; accounts: BankAccount[] }> = {};
    bankAccounts.forEach(ba => {
      const raw = ba.institution_name ?? ba.name;
      const key = institutionKey(raw);
      if (!groups[key]) groups[key] = { displayName: raw, accounts: [] };
      groups[key].accounts.push(ba);
    });
    return Object.entries(groups).map(([, { displayName, accounts }]) => {
      const assetBalance = accounts
        .filter(a => !["CREDIT_CARD","CREDIT","LOAN","FINANCING"].includes(a.type))
        .reduce((s, a) => s + Number(a.balance), 0);
      const lastSync = accounts.reduce((latest, a) => {
        if (!a.last_synced_at) return latest;
        return !latest || a.last_synced_at > latest ? a.last_synced_at : latest;
      }, null as string | null);
      const logoUrl = accounts.find(a => a.institution_logo_url)?.institution_logo_url ?? null;
      const accountIds = accounts.map(a => a.pluggy_account_id);
      return { name: displayName, accounts, assetBalance, lastSync, logoUrl, accountIds };
    });
  }, [bankAccounts, institutionKey]);

  const financialHealthScore = useMemo(() => {
    const savComp    = Math.min(40, (savingsRate / 25) * 40);
    const annualInc  = totalIn * 12 || 1;
    const debtComp   = Math.max(0, 40 * (1 - Math.min(1, totalDebtRemaining / annualInc)));
    const withLimit  = budgets.filter(b => b.monthly_limit > 0);
    const budgetComp = withLimit.length > 0
      ? (withLimit.filter(b => (spentByCategory[b.category] || 0) <= b.monthly_limit).length / withLimit.length) * 20
      : 20;
    return Math.round(savComp + debtComp + budgetComp);
  }, [savingsRate, totalDebtRemaining, totalIn, budgets, spentByCategory]);

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

  const exportSheet = async () => {
    const XLSXStyle = (await import("xlsx-js-style")).default;
    const monthLabel = format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR });
    const now = format(new Date(), "dd/MM/yyyy HH:mm");
    const savingsRate = totalIn > 0 ? ((balance / totalIn) * 100).toFixed(1) : "0.0";
    const filename = `financas_${format(viewMonth, "yyyy-MM")}`;

    // ── Style helpers ────────────────────────────────────────────────
    const fill = (rgb: string) => ({ patternType: "solid" as const, fgColor: { rgb } });
    const font = (rgb: string, bold = false, sz = 10) => ({ color: { rgb }, bold, sz });

    const hdr = (align: "left"|"center"|"right" = "left") => ({
      font: font("FFFFFF", true, 10),
      fill: fill("1E293B"),
      alignment: { horizontal: align, vertical: "center" as const, wrapText: false },
      border: { bottom: { style: "thin" as const, color: { rgb: "334155" } } },
    });

    const cell = (rgb = "1E293B", bg = "FFFFFF", bold = false, sz = 10, align: "left"|"center"|"right" = "left") => ({
      font: font(rgb, bold, sz),
      fill: fill(bg),
      alignment: { horizontal: align, vertical: "center" as const },
    });

    const num = (v: number, colorRgb: string, bg = "FFFFFF", sz = 10) => ({
      v, t: "n" as const,
      z: '#,##0.00',
      s: cell(colorRgb, bg, true, sz, "right"),
    });

    const alt = (i: number) => i % 2 === 0 ? "FFFFFF" : "F8FAFC";

    // ── Sheet 1: Resumo ──────────────────────────────────────────────
    const resumoRows = [
      [{ v: `Relatório Financeiro · C4Person · ${monthLabel}`, s: { font: font("0F172A", true, 14) } }, { v: "" }, { v: "" }, { v: "" }],
      [{ v: `Exportado em: ${now}`, s: { font: font("94A3B8", false, 9) } }, { v: "" }, { v: "" }, { v: "" }],
      [{ v: "" }, { v: "" }, { v: "" }, { v: "" }],
      [
        { v: "RECEITAS",      s: { font: font("16A34A", true, 9), fill: fill("DCFCE7"), alignment: { horizontal: "center" as const } } },
        { v: "DESPESAS",      s: { font: font("DC2626", true, 9), fill: fill("FEE2E2"), alignment: { horizontal: "center" as const } } },
        { v: "SALDO DO MÊS",  s: { font: font(balance >= 0 ? "16A34A" : "DC2626", true, 9), fill: fill(balance >= 0 ? "DCFCE7" : "FEE2E2"), alignment: { horizontal: "center" as const } } },
        { v: "POUPANÇA %",    s: { font: font("7C3AED", true, 9), fill: fill("EDE9FE"), alignment: { horizontal: "center" as const } } },
      ],
      [
        { ...num(totalIn, "10B981", "DCFCE7", 16), s: { ...cell("10B981", "DCFCE7", true, 16, "center") } },
        { ...num(totalOut, "EF4444", "FEE2E2", 16), s: { ...cell("EF4444", "FEE2E2", true, 16, "center") } },
        { ...num(balance, balance >= 0 ? "10B981" : "EF4444", balance >= 0 ? "DCFCE7" : "FEE2E2", 16), s: { ...cell(balance >= 0 ? "10B981" : "EF4444", balance >= 0 ? "DCFCE7" : "FEE2E2", true, 16, "center") } },
        { v: `${savingsRate}%`, s: { font: font("7C3AED", true, 16), fill: fill("EDE9FE"), alignment: { horizontal: "center" as const } } },
      ],
      [
        { v: `${filteredTx.filter(t => t.type === "in").length} lançamento(s)`, s: { font: font("94A3B8", false, 9), fill: fill("DCFCE7"), alignment: { horizontal: "center" as const } } },
        { v: `${filteredTx.filter(t => t.type === "out").length} lançamento(s)`, s: { font: font("94A3B8", false, 9), fill: fill("FEE2E2"), alignment: { horizontal: "center" as const } } },
        { v: balance >= 0 ? "✓ Positivo" : "✕ Negativo", s: { font: font(balance >= 0 ? "10B981" : "EF4444", false, 9), fill: fill(balance >= 0 ? "DCFCE7" : "FEE2E2"), alignment: { horizontal: "center" as const } } },
        { v: "da receita guardada", s: { font: font("94A3B8", false, 9), fill: fill("EDE9FE"), alignment: { horizontal: "center" as const } } },
      ],
    ];
    const wsResumo = XLSXStyle.utils.aoa_to_sheet(resumoRows);
    wsResumo["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
    wsResumo["!rows"] = [{ hpt: 22 }, { hpt: 14 }, { hpt: 6 }, { hpt: 18 }, { hpt: 32 }, { hpt: 16 }];
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // ── Sheet 2: Categorias ──────────────────────────────────────────
    if (categoryData.length > 0) {
      const catData = [
        [{ v: "Categoria", s: hdr() }, { v: "Valor (R$)", s: hdr("right") }, { v: "% do Total", s: hdr("right") }],
        ...categoryData.map((c, i) => {
          const pct = totalOut > 0 ? ((c.value / totalOut) * 100).toFixed(1) : "0";
          const bg = alt(i);
          return [
            { v: c.label, s: cell("1E293B", bg, true) },
            { v: c.value, t: "n" as const, z: '#,##0.00', s: cell("EF4444", bg, true, 10, "right") },
            { v: `${pct}%`, s: cell("64748B", bg, false, 10, "right") },
          ];
        }),
      ];
      const wsCat = XLSXStyle.utils.aoa_to_sheet(catData);
      wsCat["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }];
      XLSXStyle.utils.book_append_sheet(wb, wsCat, "Categorias");
    }

    // ── Sheet 3: Carteiras ───────────────────────────────────────────
    if (walletBalances.length > 0) {
      const walletData = [
        [{ v: "Carteira", s: hdr() }, { v: "Recebido (R$)", s: hdr("right") }, { v: "Gasto (R$)", s: hdr("right") }, { v: "Saldo (R$)", s: hdr("right") }],
        ...walletBalances.map((w, i) => {
          const bg = alt(i);
          return [
            { v: w.label, s: cell("1E293B", bg, true) },
            { v: w.received, t: "n" as const, z: '#,##0.00', s: cell("10B981", bg, true, 10, "right") },
            { v: w.spent,    t: "n" as const, z: '#,##0.00', s: cell("EF4444", bg, true, 10, "right") },
            { v: w.balance,  t: "n" as const, z: '#,##0.00', s: cell(w.balance >= 0 ? "10B981" : "EF4444", bg, true, 12, "right") },
          ];
        }),
      ];
      const wsWallet = XLSXStyle.utils.aoa_to_sheet(walletData);
      wsWallet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSXStyle.utils.book_append_sheet(wb, wsWallet, "Carteiras");
    }

    // ── Sheet 4: Lançamentos ─────────────────────────────────────────
    const txData = [
      [
        { v: "Data",       s: hdr() },
        { v: "Descrição",  s: hdr() },
        { v: "Tipo",       s: hdr("center") },
        { v: "Categoria",  s: hdr() },
        { v: "Origem",     s: hdr() },
        { v: "Valor (R$)", s: hdr("right") },
      ],
      ...filteredTx.map((t, i) => {
        const isIn = t.type === "in";
        const bg = alt(i);
        const typeBg = isIn ? "DCFCE7" : "FEE2E2";
        const typeColor = isIn ? "16A34A" : "DC2626";
        const sources = Array.isArray(t.payment_source) && t.payment_source.length > 0
          ? t.payment_source.join(" + ")
          : "—";
        return [
          { v: t.transaction_date ? format(parseISO(t.transaction_date), "dd/MM/yyyy") : "—", s: cell("64748B", bg, false) },
          { v: t.name,                   s: cell("1E293B", bg, true) },
          { v: isIn ? "Receita" : "Despesa", s: cell(typeColor, typeBg, true, 10, "center") },
          { v: t.category || "Outros",   s: cell("64748B", bg) },
          { v: sources,                  s: cell("94A3B8", bg, false, 9) },
          { v: Number(t.amount), t: "n" as const, z: '#,##0.00', s: cell(isIn ? "10B981" : "EF4444", bg, true, 11, "right") },
        ];
      }),
    ];
    const wsTx = XLSXStyle.utils.aoa_to_sheet(txData);
    wsTx["!cols"] = [{ wch: 13 }, { wch: 32 }, { wch: 12 }, { wch: 18 }, { wch: 26 }, { wch: 16 }];
    XLSXStyle.utils.book_append_sheet(wb, wsTx, "Lançamentos");

    XLSXStyle.writeFile(wb, `${filename}.xlsx`);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (p) => {
        fetchData();
        if (p.new?.source === "pluggy") {
          const sign = p.new.type === "in" ? "+" : "-";
          const val  = Number(p.new.amount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          undoToast(`🏦 Nova transação do banco: ${p.new.name} (${sign}${val})`, () => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, fetchData)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "transactions" }, (p) => setTransactions(prev => prev.filter(t => t.id !== p.old.id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "budgets" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "budgets" }, fetchData)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "budgets" }, (p) => setBudgets(prev => prev.filter(b => b.id !== p.old.id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "debts" }, (p) => {
        fetchData();
        if (p.new?.source === "pluggy") {
          undoToast(`⚠️ Nova dívida detectada: ${p.new.name}`, () => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "debts" }, fetchData)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "debts" }, (p) => setDebts(prev => prev.filter(d => d.id !== p.old.id)))
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, () => {
        supabase.from("bank_accounts").select("*").then(({ data }) => {
          if (data) setBankAccounts(data as BankAccount[]);
        });
      })
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

  /* ── pluggy open finance ── */
  const savePluggyCredentials = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pluggyClientId.trim() || !pluggyClientSecret.trim()) return;
    setPluggyCredSaving(true);
    try {
      await supabase.from("profiles").update({
        pluggy_client_id: pluggyClientId.trim(),
        pluggy_client_secret: pluggyClientSecret.trim(),
      }).eq("id", userId);
      setProfile(p => ({ ...p, pluggy_client_id: pluggyClientId.trim(), pluggy_client_secret: pluggyClientSecret.trim() }));
      undoToast("Credenciais Pluggy salvas!", () => {});
    } finally {
      setPluggyCredSaving(false);
    }
  }, [pluggyClientId, pluggyClientSecret, userId, undoToast]);

  const disconnectPluggy = useCallback(async () => {
    setPluggyDisconnecting(true);
    try {
      await supabase.from("profiles").update({
        pluggy_client_id: null,
        pluggy_client_secret: null,
        pluggy_item_id: null,
      }).eq("id", userId);
      setProfile(p => ({ ...p, pluggy_client_id: null, pluggy_client_secret: null, pluggy_item_id: null }));
      setPluggyClientId("");
      setPluggyClientSecret("");
      undoToast("Credenciais Pluggy removidas.", () => {});
    } finally {
      setPluggyDisconnecting(false);
    }
  }, [userId, undoToast]);

  const connectPluggy = useCallback(async () => {
    setPluggyConnecting(true);
    try {
      const res = await fetch("/api/pluggy/connect-token", { method: "POST" });
      const { accessToken, error } = await res.json();
      if (error || !accessToken) throw new Error(error ?? "Erro ao gerar token");
      setPluggyToken(accessToken);
    } catch (err) {
      undoToast("Erro ao conectar Open Finance. Verifique as credenciais Pluggy.", () => {});
    } finally {
      setPluggyConnecting(false);
    }
  }, [undoToast]);

  const resyncPluggy = useCallback(async () => {
    setPluggySyncing(true);
    try {
      // Collect all item IDs from pluggy_items table
      const { data: items } = await supabase.from("pluggy_items").select("item_id");
      let itemIds: string[] = (items ?? []).map((r: any) => r.item_id);

      // Fall back to profiles.pluggy_item_id for backward compat
      if (itemIds.length === 0 && profile.pluggy_item_id) {
        itemIds = [profile.pluggy_item_id];
      }

      if (itemIds.length === 0) {
        undoToast("Nenhum banco conectado. Conecte primeiro.", () => {});
        return;
      }

      let totalAccounts = 0, totalTx = 0, totalDebts = 0;
      for (const itemId of itemIds) {
        const r = await fetch("/api/pluggy/sync-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        const d = await r.json();
        if (!d.error) {
          totalAccounts += d.importedAccounts ?? 0;
          totalTx       += d.importedTx       ?? 0;
          totalDebts    += d.importedDebts     ?? 0;
        }
      }

      await fetchData();
      const parts = [
        totalAccounts && `${totalAccounts} conta${totalAccounts > 1 ? "s" : ""}`,
        totalTx       && `${totalTx} transaç${totalTx === 1 ? "ão" : "ões"}`,
        totalDebts    && `${totalDebts} dívida${totalDebts > 1 ? "s" : ""}`,
      ].filter(Boolean);
      undoToast(
        parts.length
          ? `Sincronizado: ${parts.join(", ")} de ${itemIds.length} banco${itemIds.length > 1 ? "s" : ""}.`
          : `${itemIds.length} banco${itemIds.length > 1 ? "s" : ""} sincronizado${itemIds.length > 1 ? "s" : ""}!`,
        () => {}
      );
    } catch {
      undoToast("Erro ao sincronizar. Tente novamente.", () => {});
    } finally {
      setPluggySyncing(false);
    }
  }, [profile.pluggy_item_id, fetchData, undoToast]);

  const [removingBank, setRemovingBank] = useState<string | null>(null);

  const removeBankGroup = useCallback(async (accountIds: string[], bankDisplayName: string) => {
    if (!confirm(`Remover "${bankDisplayName}" e todos os seus dados importados?`)) return;
    setRemovingBank(accountIds[0] ?? null);
    try {
      for (const id of accountIds) {
        await supabase.from("bank_accounts").delete().eq("pluggy_account_id", id);
      }
      setExpandedBank(prev => (prev === bankDisplayName ? null : prev));
      await fetchData();
      undoToast("Banco removido.", () => {});
    } catch {
      undoToast("Erro ao remover banco.", () => {});
    } finally {
      setRemovingBank(null);
    }
  }, [fetchData, undoToast]);

  const handlePluggySuccess = useCallback(async (itemData: any) => {
    setPluggyToken(null);
    // Support both { item: { id } } and direct item object
    const itemId: string | undefined = itemData?.item?.id ?? itemData?.id;
    if (!itemId) {
      undoToast("Conexão concluída, mas não foi possível obter o ID da conta.", () => {});
      return;
    }
    setPluggySyncing(true);
    try {
      const r = await fetch("/api/pluggy/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const d = await r.json();
      if (d.error) {
        undoToast(`Erro ao importar: ${d.error}`, () => {});
      } else {
        setProfile(p => ({ ...p, pluggy_item_id: itemId }));
        const parts = [];
        if (d.importedAccounts) parts.push(`${d.importedAccounts} conta${d.importedAccounts === 1 ? "" : "s"}`);
        if (d.importedTx)       parts.push(`${d.importedTx} transaç${d.importedTx === 1 ? "ão" : "ões"}`);
        if (d.importedDebts)    parts.push(`${d.importedDebts} dívida${d.importedDebts === 1 ? "" : "s"}`);
        undoToast(parts.length ? `Banco conectado! ${parts.join(", ")} importadas.` : "Banco conectado! Nenhum dado novo.", () => {});
        fetchData();
      }
    } catch {
      undoToast("Erro de rede ao importar dívidas.", () => {});
    } finally {
      setPluggySyncing(false);
    }
  }, [fetchData, undoToast]);

  /* ── debt handlers ── */
  const addDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newDebtAmount.replace(",", "."));
    if (!newDebtName.trim() || isNaN(amount) || amount <= 0) return;
    const { data } = await supabase.from("debts").insert([{
      name: newDebtName.trim(),
      creditor: newDebtCreditor.trim() || null,
      total_amount: amount,
      paid_amount: 0,
      status: "active",
      user_id: userId,
    }]).select().single();
    if (data) setDebts(prev => [...prev, data as Debt]);
    setNewDebtName(""); setNewDebtCreditor(""); setNewDebtAmount("");
    setShowAddDebt(false);
  };

  const recordDebtPayment = async (debtId: string) => {
    const amount = parseFloat(payDebtAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    const newPaid = Math.min(debt.paid_amount + amount, debt.total_amount);
    const newStatus: "active" | "quitada" = newPaid >= debt.total_amount ? "quitada" : "active";
    await Promise.all([
      supabase.from("debt_payments").insert([{
        debt_id: debtId, user_id: userId, amount,
        payment_date: new Date().toISOString().split("T")[0],
        notes: payDebtNotes.trim() || null,
      }]),
      supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", debtId),
    ]);
    setDebts(prev => prev.map(d => d.id === debtId ? { ...d, paid_amount: newPaid, status: newStatus } : d));
    setPayDebtId(null); setPayDebtAmount(""); setPayDebtNotes("");
  };

  const markDebtQuitada = async (debtId: string) => {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    await supabase.from("debts").update({ paid_amount: debt.total_amount, status: "quitada" }).eq("id", debtId);
    setDebts(prev => prev.map(d => d.id === debtId ? { ...d, paid_amount: d.total_amount, status: "quitada" } : d));
  };

  const deleteDebt = async (debtId: string) => {
    await supabase.from("debts").delete().eq("id", debtId);
    setDebts(prev => prev.filter(d => d.id !== debtId));
  };

  const analyzeDebtsWithAI = async () => {
    setDebtAiLoading(true);
    setDebtAiAnalysis("");
    const activeDebts = debts.filter(d => d.status === "active");
    const debtSummary = activeDebts.map(d =>
      `- ${d.name}${d.creditor ? ` (${d.creditor})` : ""}: Total R$ ${Number(d.total_amount).toFixed(2)}, Pago R$ ${Number(d.paid_amount).toFixed(2)}, Restante R$ ${(Number(d.total_amount) - Number(d.paid_amount)).toFixed(2)}`
    ).join("\n");
    const message = `Tenho as seguintes dívidas ativas:\n${debtSummary}\n\nCom base no meu saldo mensal de R$ ${balance.toFixed(2)} (receitas R$ ${totalIn.toFixed(2)}, despesas R$ ${totalOut.toFixed(2)}), como devo priorizar o pagamento? Qual estratégia é melhor?`;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [], context: { totalTasks: 0, doneTasks: 0, totalHabits: 0, completedHabits: 0, totalBalance: balance, totalIn, totalOut, recentTransactions: [] } }),
      });
      const json = await res.json();
      setDebtAiAnalysis(json.reply || "Não foi possível gerar análise.");
    } catch {
      setDebtAiAnalysis("Erro ao conectar com o assistente.");
    }
    setDebtAiLoading(false);
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
      // Abre automaticamente o modal de orçamento para definir o limite da nova categoria
      setBudgetCategory(name);
      setBudgetLimit("");
      setShowBudgetModal(true);
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
            onClick={() => { setSettingSalaryMode(profile.salary_mode); setSettingSalaryAmount(profile.salary_amount > 0 ? profile.salary_amount.toString() : ""); setSettingSalaryAmount2(profile.salary_amount_2 > 0 ? profile.salary_amount_2.toString() : ""); setSettingsTab("salary"); setDebtAiAnalysis(""); setShowSettings(true); }}
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

      {/* ── Financial Health Dashboard ── */}
      {(() => {
        const hs = financialHealthScore;
        const hColor  = hs >= 80 ? "#10b981" : hs >= 60 ? "#eab308" : hs >= 40 ? "#f97316" : "#ef4444";
        const hText   = hs >= 80 ? "text-emerald-400" : hs >= 60 ? "text-yellow-400" : hs >= 40 ? "text-orange-400" : "text-red-400";
        const hLabel  = hs >= 80 ? "Excelente" : hs >= 60 ? "Bom" : hs >= 40 ? "Atenção" : "Crítico";
        const gaugeDash = (hs / 100) * 125.66;

        const withLimit  = budgets.filter(b => b.monthly_limit > 0);
        const savPts     = Math.round(Math.min(40, (savingsRate / 25) * 40));
        const debtPts    = Math.round(Math.max(0, 40 * (1 - Math.min(1, totalDebtRemaining / ((totalIn * 12) || 1)))));
        const budgetPts  = Math.round(withLimit.length > 0
          ? (withLimit.filter(b => (spentByCategory[b.category] || 0) <= b.monthly_limit).length / withLimit.length) * 20
          : 20);
        const totalPaid  = debts.reduce((s, d) => s + Number(d.paid_amount), 0);
        const totalOrig  = debts.reduce((s, d) => s + Number(d.total_amount), 0);
        const overallPct = totalOrig > 0 ? Math.round((totalPaid / totalOrig) * 100) : 0;
        const netPos     = balance - totalDebtRemaining;
        const monthsTo   = balance > 0 && totalDebtRemaining > 0 ? Math.ceil(totalDebtRemaining / balance) : null;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

            {/* ── Score de Saúde ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
              className="glass-card p-6"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Saúde Financeira</p>
              <div className="flex items-center gap-5 mb-5">
                <div className="relative shrink-0">
                  <svg viewBox="0 0 52 52" className="w-16 h-16 -rotate-90">
                    <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle cx="26" cy="26" r="20" fill="none" stroke={hColor} strokeWidth="4"
                      strokeDasharray={`${gaugeDash} 125.66`} strokeLinecap="round"
                      className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center rotate-90">
                    <span className="text-sm font-bold text-white">{hs}</span>
                  </div>
                </div>
                <div>
                  <p className={`text-xl font-bold ${hText}`}>{hLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Score de 100 pts</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Poupança", pts: savPts, max: 40, color: "bg-emerald-500" },
                  { label: "Dívidas",  pts: debtPts, max: 40, color: "bg-blue-500" },
                  { label: "Orçamento", pts: budgetPts, max: 20, color: "bg-violet-500" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{item.label}</span>
                      <span>{item.pts}/{item.max}</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${(item.pts / item.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Posição Financeira ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="glass-card p-6"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Posição Financeira</p>
              <div className="space-y-3">
                {[
                  { label: "Receitas do mês", value: totalIn,  color: "bg-emerald-500", valueClass: "text-emerald-400", sign: "+" },
                  { label: "Despesas do mês", value: totalOut, color: "bg-red-400",     valueClass: "text-red-400",     sign: "−" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${r.color}`} />
                      {r.label}
                    </span>
                    <span className={`text-sm font-bold ${r.valueClass}`}>{r.sign}{fmt(r.value)}</span>
                  </div>
                ))}
                <div className="border-t border-white/5 pt-2 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Sobra mensal</span>
                  <span className={`text-sm font-bold ${balance >= 0 ? "text-white" : "text-red-400"}`}>{fmt(balance)}</span>
                </div>
                {totalDebtRemaining > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Total em dívidas
                    </span>
                    <span className="text-sm font-bold text-orange-400">−{fmt(totalDebtRemaining)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Posição líquida</span>
                  <span className={`text-lg font-bold ${netPos >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(netPos)}</span>
                </div>
              </div>
              {monthsTo && monthsTo < 120 && (
                <div className="mt-4 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-[10px] text-blue-300 leading-snug">
                    Com a sobra atual, as dívidas seriam quitadas em <strong>~{monthsTo} {monthsTo === 1 ? "mês" : "meses"}</strong>
                  </p>
                </div>
              )}
            </motion.div>

            {/* ── Resumo de Dívidas ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resumo de Dívidas</p>
                <button
                  onClick={() => { setSettingSalaryMode(profile.salary_mode); setSettingSalaryAmount(profile.salary_amount > 0 ? profile.salary_amount.toString() : ""); setSettingSalaryAmount2(profile.salary_amount_2 > 0 ? profile.salary_amount_2.toString() : ""); setSettingsTab("debts"); setDebtAiAnalysis(""); setShowSettings(true); }}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Gerenciar →
                </button>
              </div>
              {debts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-center">
                  <CreditCard size={24} className="text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma dívida cadastrada</p>
                  <button
                    onClick={() => { setSettingsTab("debts"); setShowSettings(true); }}
                    className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
                  >+ Adicionar dívida</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-xs text-red-400 font-bold">{fmt(totalDebtRemaining)}</p>
                      <p className="text-[10px] text-muted-foreground">a pagar</p>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <p className="text-xs text-emerald-400 font-bold">{fmt(totalPaid)}</p>
                      <p className="text-[10px] text-muted-foreground">já pago</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{activeDebts.length} ativa(s) · {debts.filter(d => d.status === "quitada").length} quitada(s)</span>
                      <span>{overallPct}% quitado</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                        style={{ width: `${overallPct}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {activeDebts.slice(0, 4).map(d => {
                      const rem = Number(d.total_amount) - Number(d.paid_amount);
                      const p   = Math.min(100, (Number(d.paid_amount) / Number(d.total_amount)) * 100);
                      return (
                        <div key={d.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground truncate">{d.name}</p>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] text-red-400 font-medium shrink-0">{fmt(rem)}</span>
                        </div>
                      );
                    })}
                    {activeDebts.length > 4 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{activeDebts.length - 4} mais</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        );
      })()}

      {/* ── Open Finance — bancos conectados ── */}
      {banksByInstitution.length > 0 && (() => {
        const TYPE_LABEL: Record<string, string> = {
          CHECKING: "Conta Corrente", SAVINGS: "Poupança",
          CREDIT_CARD: "Cartão de Crédito", CREDIT: "Crédito",
          LOAN: "Empréstimo", FINANCING: "Financiamento",
        };
        const BANK_PALETTE = [
          ["#10b981","#064e3b"], ["#3b82f6","#1e3a5f"], ["#8b5cf6","#3b1f6e"],
          ["#f59e0b","#78350f"], ["#06b6d4","#164e63"], ["#ec4899","#831843"],
          ["#ef4444","#7f1d1d"], ["#84cc16","#365314"],
        ];
        const bankGradient = (name: string) => {
          let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
          return BANK_PALETTE[Math.abs(h) % BANK_PALETTE.length];
        };
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
        const todayStr   = new Date().toISOString().slice(0, 10);

        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="mb-8"
          >
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Open Finance</span>
                </div>
                <span className="text-xs text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {banksByInstitution.length} banco{banksByInstitution.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Saldo em contas</span>
                <span className={`text-sm font-bold ${totalBankBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(totalBankBalance)}</span>
              </div>
            </div>

            {/* Bank cards */}
            <div className="flex flex-col gap-3">
              {banksByInstitution.map(bank => {
                const [accentColor, darkColor] = bankGradient(bank.name);
                const isOpen = expandedBank === bank.name;
                const initial = bank.name.trim()[0]?.toUpperCase() ?? "B";
                const creditAccounts = bank.accounts.filter(a => ["CREDIT_CARD","CREDIT","LOAN","FINANCING"].includes(a.type));
                const assetAccounts  = bank.accounts.filter(a => !["CREDIT_CARD","CREDIT","LOAN","FINANCING"].includes(a.type));
                const accountNames   = new Set(bank.accounts.map(a => a.name));
                const moreThanOneBank = banksByInstitution.length > 1;
                const bankTx = transactions.filter(t => {
                  if (t.source !== "pluggy") return false;
                  if (t.transaction_date < monthStart || t.transaction_date > todayStr) return false;
                  if (!moreThanOneBank) return true;
                  // Multiple banks: filter by account name stored in payment_source
                  const ps = (t as any).payment_source;
                  if (!Array.isArray(ps) || ps.length === 0) return true;
                  return ps.some((s: string) => accountNames.has(s));
                }).slice(0, 8);

                return (
                  <div
                    key={bank.name}
                    className="group rounded-2xl overflow-hidden border border-white/8"
                    style={{ background: `linear-gradient(135deg, ${darkColor}40 0%, rgba(0,0,0,0.3) 100%)` }}
                  >
                    {/* Header row */}
                    <div className="relative">
                    <button
                      onClick={() => setExpandedBank(isOpen ? null : bank.name)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left pr-14"
                    >
                      {/* Logo / avatar */}
                      {bank.logoUrl ? (
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-white p-1.5 shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={bank.logoUrl} alt={bank.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-base shadow-lg select-none"
                          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darkColor} 100%)` }}
                        >
                          {initial}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white truncate capitalize">{bank.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</p>
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 shrink-0">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span className="text-[9px] text-emerald-400 font-semibold">Sincronizado</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            assetAccounts.length > 0 && `${assetAccounts.length} conta${assetAccounts.length > 1 ? "s" : ""}`,
                            creditAccounts.length > 0 && `${creditAccounts.length} cartão${creditAccounts.length > 1 ? "ões" : ""}`,
                            bank.lastSync && `atualizado ${format(parseISO(bank.lastSync), "dd/MM HH:mm")}`,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>

                      {/* Balances */}
                      <div className="text-right shrink-0 mr-2">
                        <p className={`text-lg font-bold leading-none ${bank.assetBalance >= 0 ? "text-white" : "text-red-400"}`}>
                          {fmt(bank.assetBalance)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">em conta</p>
                      </div>

                      {/* Chevron */}
                      <div className={`w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                        <ChevronRight size={13} className="text-muted-foreground" />
                      </div>
                    </button>

                    {/* Remove button — overlaid top-right, shows on hover */}
                    <button
                      onClick={() => removeBankGroup(bank.accountIds, bank.name)}
                      disabled={removingBank === bank.accountIds[0]}
                      className="absolute right-12 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white/0 hover:bg-red-500/20 border border-transparent hover:border-red-500/40 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 z-10"
                      title="Remover banco"
                    >
                      <Trash2 size={12} className="text-muted-foreground group-hover:text-red-400 transition-colors" />
                    </button>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-1 border-t border-white/8 space-y-5">

                            {/* Asset accounts */}
                            {assetAccounts.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">Contas</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {assetAccounts.map(acc => (
                                    <div key={acc.id} className="rounded-xl p-4 bg-white/4 border border-white/8 flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{acc.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{TYPE_LABEL[acc.type] ?? acc.type}</p>
                                      </div>
                                      <p className={`text-base font-bold shrink-0 ${Number(acc.balance) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {fmt(Number(acc.balance))}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Credit / card accounts */}
                            {creditAccounts.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">Crédito</p>
                                <div className="space-y-3">
                                  {creditAccounts.map(acc => {
                                    const used      = acc.credit_limit != null && acc.available_credit != null
                                      ? Number(acc.credit_limit) - Number(acc.available_credit)
                                      : Math.abs(Number(acc.balance));
                                    const limit     = acc.credit_limit ? Number(acc.credit_limit) : null;
                                    const available = acc.available_credit ? Number(acc.available_credit) : (limit != null ? limit - used : null);
                                    const usedPct   = limit != null && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
                                    const barColor  = usedPct != null
                                      ? (usedPct >= 80 ? "#ef4444" : usedPct >= 50 ? "#f59e0b" : "#10b981")
                                      : "#6b7280";
                                    return (
                                      <div key={acc.id} className="rounded-xl p-4 bg-white/4 border border-white/8">
                                        {/* Card name + usage */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">{acc.name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{TYPE_LABEL[acc.type] ?? acc.type}</p>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-white">{fmt(used)}</p>
                                            <p className="text-[10px] text-muted-foreground">utilizado</p>
                                          </div>
                                        </div>
                                        {/* Usage bar */}
                                        {limit != null ? (
                                          <>
                                            <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-2">
                                              <motion.div
                                                className="h-full rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${usedPct}%` }}
                                                transition={{ duration: 0.6, ease: "easeOut" }}
                                                style={{ backgroundColor: barColor }}
                                              />
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                              <span className="text-muted-foreground">Limite: {fmt(limit)}</span>
                                              <span style={{ color: barColor }} className="font-medium">
                                                {available != null ? `${fmt(available)} livre` : `${usedPct?.toFixed(0)}% usado`}
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-[10px] text-muted-foreground/60">Limite não disponível — reconecte o banco</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Current-month transactions for this bank */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Transações deste mês</p>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(), "MMMM", { locale: ptBR })}</span>
                              </div>
                              {bankTx.length === 0 ? (
                                <p className="text-xs text-muted-foreground/60 italic">Nenhuma transação encontrada neste mês.</p>
                              ) : (
                                <div className="space-y-1">
                                  {bankTx.map(t => (
                                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.type === "in" ? "bg-emerald-500/12 border border-emerald-500/20" : "bg-red-500/12 border border-red-500/20"}`}>
                                        {t.type === "in"
                                          ? <ArrowUpRight size={13} className="text-emerald-400" />
                                          : <ArrowDownRight size={13} className="text-red-400" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{t.name}</p>
                                        {t.category && <p className="text-[10px] text-muted-foreground truncate">{t.category}</p>}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className={`text-xs font-bold ${t.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                                          {t.type === "in" ? "+" : "−"}{fmt(Number(t.amount))}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {t.transaction_date ? format(parseISO(t.transaction_date), "dd/MM") : ""}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* ── Dívidas: Open Finance + Active Debt Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        className="mb-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2">
            <CreditCard size={13} className="text-red-400" />
            Dívidas
            {activeDebts.length > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{activeDebts.length}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {activeDebts.length > 0 && (
              <button
                onClick={analyzeDebtsWithAI}
                disabled={debtAiLoading}
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                {debtAiLoading ? "Analisando…" : "Análise IA"}
              </button>
            )}
            {bankAccounts.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={resyncPluggy}
                  disabled={pluggySyncing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-50 font-medium"
                >
                  {pluggySyncing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {pluggySyncing ? "Sincronizando…" : "Sincronizar bancos"}
                </button>
                <button
                  onClick={connectPluggy}
                  disabled={pluggyConnecting || pluggySyncing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors disabled:opacity-50 font-medium"
                >
                  <Plus size={11} />
                  {pluggyConnecting ? "Abrindo…" : "Adicionar banco"}
                </button>
              </div>
            ) : (
              <button
                onClick={connectPluggy}
                disabled={pluggyConnecting || pluggySyncing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors disabled:opacity-50 font-medium"
              >
                <Sparkles size={11} />
                {pluggyConnecting ? "Conectando…" : "Conectar banco (Open Finance)"}
              </button>
            )}
          </div>
        </div>

        {/* Empty state with Pluggy CTA */}
        {activeDebts.length === 0 && (
          <div className="glass-card p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <CreditCard size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Nenhuma dívida cadastrada</p>
              <p className="text-sm text-muted-foreground">
                {profile.pluggy_client_id
                  ? "Conecte seu banco via Open Finance para importar dívidas automaticamente."
                  : "Configure suas credenciais Pluggy em Configurações → Dívidas para conectar seu banco."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              {profile.pluggy_client_id ? (
                <button
                  onClick={connectPluggy}
                  disabled={pluggyConnecting || pluggySyncing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {pluggyConnecting ? "Conectando…" : pluggySyncing ? "Importando…" : "Conectar banco"}
                </button>
              ) : (
                <button
                  onClick={() => { setShowSettings(true); setSettingsTab("debts"); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  <Sparkles size={14} />
                  Configurar Open Finance
                </button>
              )}
              <button
                onClick={() => { setShowSettings(true); setSettingsTab("debts"); }}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground text-sm transition-colors border border-white/10"
              >
                Adicionar manualmente
              </button>
            </div>
            {/* 3-step guide */}
            <div className="w-full grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
              {[
                { n: "1", label: "Clique em Conectar banco" },
                { n: "2", label: "Selecione seu banco e autentique" },
                { n: "3", label: "Dívidas aparecem aqui automaticamente" },
              ].map(s => (
                <div key={s.n} className="flex flex-col items-center text-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">{s.n}</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active debt cards grid */}
        {activeDebts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeDebts.map(debt => {
                const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
                const pct = Math.min(100, (Number(debt.paid_amount) / Number(debt.total_amount)) * 100);
                const monthsToPayoff = balance > 0 ? Math.ceil(remaining / balance) : null;
                const pColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#eab308" : "#ef4444";
                return (
                  <div key={debt.id} className="glass-card p-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-0.5 w-full bg-white/5" />
                    <div className="absolute top-0 left-0 h-0.5 rounded-r-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: pColor }} />
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-white text-sm truncate">{debt.name}</p>
                        {debt.creditor && <p className="text-xs text-muted-foreground">{debt.creditor}</p>}
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: pColor }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: pColor }} />
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-lg font-bold text-red-400">{fmt(remaining)}</p>
                        <p className="text-[10px] text-muted-foreground">de {fmt(Number(debt.total_amount))}</p>
                      </div>
                      {monthsToPayoff && monthsToPayoff < 240 && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-muted-foreground">~{monthsToPayoff}m</p>
                          <p className="text-[10px] text-muted-foreground/60">ao ritmo atual</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {debtAiAnalysis && (
              <div className="mt-4 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={11} /> C4 Assistant — Estratégia de quitação
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{debtAiAnalysis}</p>
              </div>
            )}
          </>
        )}
      </motion.div>

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
                    {t.source === "pluggy" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-blue-500/30 text-blue-400 bg-blue-500/10 font-medium">
                        🏦 Banco
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
              <p className="text-xs text-muted-foreground mb-4">Salário, dívidas e conta conjunta</p>

              {/* Tabs */}
              <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
                {(["salary", "debts", "partner"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      settingsTab === tab ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {tab === "salary" && <><Settings size={11} /> Salário</>}
                    {tab === "debts" && <><CreditCard size={11} /> Dívidas{debts.filter(d => d.status === "active").length > 0 && <span className="bg-red-500/80 text-white text-[9px] font-bold px-1 rounded-full">{debts.filter(d => d.status === "active").length}</span>}</>}
                    {tab === "partner" && <><Users size={11} /> Parceiro</>}
                  </button>
                ))}
              </div>

              {/* ── Salary tab ── */}
              {settingsTab === "salary" && (
                <form onSubmit={saveSettings} className="flex flex-col gap-5">
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
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">1ª parcela — até dia 5 (R$)</label>
                        <input
                          type="number" step="0.01" value={settingSalaryAmount}
                          onChange={e => setSettingSalaryAmount(e.target.value)}
                          placeholder="Ex: 2500"
                          className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        <p className="text-xs text-muted-foreground/60 mt-1">Inclui adiantamento, horas extras, etc.</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">2ª parcela — dia 15 (R$)</label>
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
              )}

              {/* ── Debts tab ── */}
              {settingsTab === "debts" && (
                <div className="flex flex-col gap-4">

                  {/* ── Open Finance credentials ── */}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-blue-500/10">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Sparkles size={12} className="text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white">Configurar Open Finance (Pluggy)</p>
                        <p className="text-[10px] text-muted-foreground">Conecte seu banco para importar dívidas automaticamente</p>
                      </div>
                      {profile.pluggy_client_id && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Configurado</span>
                      )}
                    </div>

                    {/* Step-by-step guide */}
                    <div className="px-4 py-3 border-b border-blue-500/10">
                      <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-2">Como obter suas credenciais</p>
                      <div className="flex flex-col gap-2">
                        {[
                          { n: "1", text: "Acesse", link: "pluggy.ai", href: "https://pluggy.ai", after: " e crie uma conta gratuita" },
                          { n: "2", text: 'No painel, clique em "Suas Credenciais"' },
                          { n: "3", text: "Copie o Client ID e o Client Secret" },
                          { n: "4", text: "Cole abaixo e clique em Salvar" },
                        ].map(s => (
                          <div key={s.n} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              {s.text}
                              {s.link && <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline mx-0.5">{s.link}</a>}
                              {s.after}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Credentials form */}
                    <form onSubmit={savePluggyCredentials} className="px-4 py-3 flex flex-col gap-2.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Client ID</label>
                        <input
                          type="text"
                          value={pluggyClientId}
                          onChange={e => setPluggyClientId(e.target.value)}
                          placeholder="c9b55c8d-2f49-4f26-8a08-..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Client Secret</label>
                        <div className="relative">
                          <input
                            type={showPluggySecret ? "text" : "password"}
                            value={pluggyClientSecret}
                            onChange={e => setPluggyClientSecret(e.target.value)}
                            placeholder="••••••••••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-9 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPluggySecret(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                          >
                            {showPluggySecret ? <CreditCard size={12} /> : <Sparkles size={12} />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={pluggyCredSaving || !pluggyClientId.trim() || !pluggyClientSecret.trim()}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {pluggyCredSaving ? "Salvando…" : "Salvar credenciais"}
                      </button>
                      {profile.pluggy_client_id && (
                        <button
                          type="button"
                          onClick={disconnectPluggy}
                          disabled={pluggyDisconnecting}
                          className="w-full py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold transition-colors border border-red-500/20 disabled:opacity-50"
                        >
                          {pluggyDisconnecting ? "Removendo…" : "Desconectar e limpar credenciais"}
                        </button>
                      )}
                      <p className="text-[9px] text-muted-foreground text-center">
                        🔒 Salvo de forma segura no servidor. Nunca exposto no browser.
                      </p>
                    </form>
                  </div>

                  {/* Summary KPIs */}
                  {debts.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ainda devendo</p>
                        <p className="text-base font-bold text-red-400">
                          {fmt(debts.filter(d => d.status === "active").reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0))}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{debts.filter(d => d.status === "active").length} dívida(s) ativa(s)</p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total pago</p>
                        <p className="text-base font-bold text-emerald-400">
                          {fmt(debts.reduce((s, d) => s + Number(d.paid_amount), 0))}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{debts.filter(d => d.status === "quitada").length} quitada(s)</p>
                      </div>
                    </div>
                  )}

                  {/* Debt list */}
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
                    {debts.length === 0 && !showAddDebt && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                        Nenhuma dívida cadastrada.
                      </div>
                    )}
                    {debts.map(debt => {
                      const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
                      const pct = Math.min(100, (Number(debt.paid_amount) / Number(debt.total_amount)) * 100);
                      const isQuitada = debt.status === "quitada";
                      const isPaying = payDebtId === debt.id;
                      return (
                        <div
                          key={debt.id}
                          className={`p-3 rounded-xl border transition-all ${isQuitada ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/5"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate">{debt.name}</span>
                                {isQuitada && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">✓ Quitada</span>
                                )}
                              </div>
                              {debt.creditor && <p className="text-xs text-muted-foreground mt-0.5">{debt.creditor}</p>}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${isQuitada ? "bg-emerald-500" : "bg-primary"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {fmt(Number(debt.paid_amount))} de {fmt(Number(debt.total_amount))}
                                {!isQuitada && <span className="text-red-400 ml-1">· Resta {fmt(remaining)}</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteDebt(debt.id)}
                              className="text-muted-foreground hover:text-red-400 transition-colors shrink-0 mt-0.5 p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {!isQuitada && (
                            <div className="flex gap-2 mt-2.5">
                              <button
                                onClick={() => { setPayDebtId(isPaying ? null : debt.id); setPayDebtAmount(""); setPayDebtNotes(""); }}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all"
                              >
                                💳 Registrar pagamento
                              </button>
                              <button
                                onClick={() => markDebtQuitada(debt.id)}
                                className="text-xs py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all"
                              >
                                ✓ Quitada
                              </button>
                            </div>
                          )}

                          {isPaying && (
                            <div className="mt-2 flex flex-col gap-2 p-2.5 rounded-xl bg-background border border-white/10">
                              <input
                                type="number" step="0.01" value={payDebtAmount}
                                onChange={e => setPayDebtAmount(e.target.value)}
                                placeholder="Valor pago agora (R$)"
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                              />
                              <input
                                type="text" value={payDebtNotes}
                                onChange={e => setPayDebtNotes(e.target.value)}
                                placeholder="Observações (opcional)"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                              />
                              <button
                                onClick={() => recordDebtPayment(debt.id)}
                                disabled={!payDebtAmount}
                                className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add debt form */}
                  {showAddDebt ? (
                    <form onSubmit={addDebt} className="flex flex-col gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                      <p className="text-xs font-semibold text-white">Nova Dívida</p>
                      <input
                        type="text" value={newDebtName} onChange={e => setNewDebtName(e.target.value)}
                        placeholder="Descrição (ex: Empréstimo banco)"
                        autoFocus
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                      <input
                        type="text" value={newDebtCreditor} onChange={e => setNewDebtCreditor(e.target.value)}
                        placeholder="Credor (ex: Caixa Econômica) — opcional"
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                      <input
                        type="number" step="0.01" value={newDebtAmount} onChange={e => setNewDebtAmount(e.target.value)}
                        placeholder="Valor total da dívida (R$)"
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowAddDebt(false); setNewDebtName(""); setNewDebtCreditor(""); setNewDebtAmount(""); }}
                          className="flex-1 py-2 rounded-lg border border-white/10 text-muted-foreground hover:text-white text-sm transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!newDebtName.trim() || !newDebtAmount}
                          className="flex-1 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddDebt(true)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-muted-foreground hover:text-white hover:border-white/40 text-sm transition-all"
                    >
                      + Adicionar dívida
                    </button>
                  )}

                  {/* AI Analysis */}
                  {debts.filter(d => d.status === "active").length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <button
                        onClick={analyzeDebtsWithAI}
                        disabled={debtAiLoading}
                        className="w-full py-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        {debtAiLoading ? "Analisando…" : "Como quitar minhas dívidas? (IA)"}
                      </button>

                      {debtAiAnalysis && (
                        <div className="mt-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                          <p className="text-[10px] font-semibold text-violet-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <Sparkles size={10} /> C4 Assistant
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{debtAiAnalysis}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Partner tab ── */}
              {settingsTab === "partner" && (
                <div>
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
              )}
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
                  <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                    {[...EXPENSE_CATEGORIES, ...customExpCats].map(c => {
                      const sel = budgetCategory === c.label;
                      return (
                        <button
                          key={c.label} type="button" onClick={() => setBudgetCategory(c.label)}
                          className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-all ${
                            sel ? "border-2 font-semibold" : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                          }`}
                          style={sel ? {
                            backgroundColor: `${c.color}18`,
                            borderColor: c.color,
                            color: c.color,
                            boxShadow: `0 0 0 1px ${c.color}40`,
                          } : {}}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                  {budgetCategory && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selecionado: <span className="text-white font-medium">{budgetCategory}</span>
                      {budgets.find(b => b.category === budgetCategory) && (
                        <span className="ml-1 text-yellow-400">(já tem orçamento — irá atualizar)</span>
                      )}
                    </p>
                  )}
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
                    {categories.map(c => {
                      const selected = newCategory === c.label;
                      return (
                        <button
                          key={c.label} type="button" onClick={() => setNewCategory(c.label)}
                          className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-all ${
                            selected
                              ? "border-2 font-semibold"
                              : "bg-background border-white/5 text-muted-foreground hover:bg-white/5"
                          }`}
                          style={selected ? {
                            backgroundColor: `${c.color}18`,
                            borderColor: c.color,
                            color: c.color,
                            boxShadow: `0 0 0 1px ${c.color}40`,
                          } : {}}
                        >
                          {c.label}
                        </button>
                      );
                    })}
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

      {/* Pluggy Connect widget — renders as full-screen overlay when token is set */}
      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          onSuccess={handlePluggySuccess}
          onError={(err: any) => {
            console.error("Pluggy error:", err);
            setPluggyToken(null);
            undoToast(`Erro Pluggy: ${err?.message ?? "falha na conexão"}`, () => {});
          }}
          onClose={() => setPluggyToken(null)}
        />
      )}
    </div>
  );
}

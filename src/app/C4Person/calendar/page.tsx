"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  format, startOfWeek, addDays, isSameDay, isToday,
  addWeeks, subWeeks, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X,
  Link2, Link2Off, AlertCircle, Bell, BellOff, Clock,
  FileText, Trash2, Edit2, Video, CheckSquare,
  AlarmClock, Grid3x3, List,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

interface CalEvent {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  type: "task" | "meeting" | "reminder";
  event_date: string;
  start_time?: string;
  end_time?: string;
  all_day: boolean;
  remind_min?: number;
  color: string;
  google_event_id?: string;
  source?: "local" | "google" | "microsoft";
  provider?: "google" | "microsoft";
}

interface Integration {
  provider: string;
  email: string;
  updated_at: string;
}

const TYPE_OPTS = [
  { value: "task",     label: "Tarefa",   icon: CheckSquare, color: "#8B5CF6" },
  { value: "meeting",  label: "Reunião",  icon: Video,       color: "#0EA5E9" },
  { value: "reminder", label: "Lembrete", icon: AlarmClock,  color: "#F59E0B" },
] as const;

const REMIND_OPTS = [
  { value: 0,    label: "Na hora" },
  { value: 5,    label: "5 min antes" },
  { value: 10,   label: "10 min antes" },
  { value: 15,   label: "15 min antes" },
  { value: 30,   label: "30 min antes" },
  { value: 60,   label: "1 hora antes" },
  { value: 120,  label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

const PROVIDER_LABEL: Record<string, string> = { google: "Google", microsoft: "Outlook" };
const PROVIDER_COLOR: Record<string, string> = { google: "#4285F4", microsoft: "#0078D4" };

// Grid starts at 06:00, 32 slots × 30 min = ends at 22:00
const GRID_START_MIN = 6 * 60;   // 360
const GRID_END_MIN   = 22 * 60;  // 1320
const SLOT_HEIGHT_PX = 48;       // px per 30-min slot
const TOTAL_SLOTS    = 32;

const TIME_SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const totalMins = GRID_START_MIN + i * 30;
  const h = Math.floor(totalMins / 60).toString().padStart(2, "0");
  const m = (totalMins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getCurrentTimePercent(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < GRID_START_MIN || mins > GRID_END_MIN) return -1;
  return ((mins - GRID_START_MIN) / (GRID_END_MIN - GRID_START_MIN)) * 100;
}

function scheduleNotifications(events: CalEvent[]) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  const now = Date.now();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  for (const ev of events) {
    if (ev.event_date !== todayStr || ev.all_day || !ev.start_time || ev.remind_min == null) continue;
    const eventMinutes = timeToMinutes(ev.start_time);
    const remindAt = new Date();
    remindAt.setHours(0, eventMinutes - ev.remind_min, 0, 0);
    const delay = remindAt.getTime() - now;
    if (delay > 0 && delay < 24 * 3600 * 1000) {
      setTimeout(() => {
        new Notification(`📅 ${ev.title}`, {
          body: ev.remind_min === 0 ? "Agora!" : `Começa em ${ev.remind_min} min (${ev.start_time})`,
          icon: "/favicon.ico",
          tag: ev.id,
        });
      }, delay);
    }
  }
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const gridRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted]           = useState(false);
  const [view, setView]                 = useState<"week" | "month">("week");
  const [weekStart, setWeekStart]       = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthDate, setMonthDate]       = useState(() => new Date());
  const [selectedDay, setSelectedDay]   = useState<Date>(() => new Date());
  const [localEvents, setLocalEvents]   = useState<CalEvent[]>([]);
  const [externalEvents, setExternal]   = useState<CalEvent[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [banner, setBanner]             = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notifPerm, setNotifPerm]       = useState<NotificationPermission>("default");
  const [userId, setUserId]             = useState("");
  const [nowPct, setNowPct]             = useState(getCurrentTimePercent);

  // Modal state
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", type: "task" as "task" | "meeting" | "reminder",
    event_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "", end_time: "", all_day: false,
    remind_min: -1, color: "#8B5CF6", sync_google: false,
  });
  const [saving, setSaving]             = useState(false);
  const [detailEvent, setDetailEvent]   = useState<CalEvent | null>(null);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const monthDays = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end   = endOfMonth(monthDate);
    const pre   = getDay(start) === 0 ? 6 : getDay(start) - 1;
    return eachDayOfInterval({ start: addDays(start, -pre), end: addDays(end, (7 - ((pre + (end.getDate())) % 7)) % 7) });
  }, [monthDate]);

  const fetchLocal = useCallback(async (start: string, end: string) => {
    const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
    if (res.ok) {
      const data = await res.json() as { events: CalEvent[] };
      setLocalEvents((data.events ?? []).map(e => ({ ...e, source: "local" as const })));
    }
  }, []);

  const fetchExternal = useCallback(async (start: string, end: string) => {
    try {
      const res = await fetch(`/api/integrations/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      if (res.ok) {
        const data = await res.json() as { events: (CalEvent & { allDay?: boolean })[] };
        setExternal((data.events ?? []).map(e => ({ ...e, source: e.provider as "google" | "microsoft", all_day: e.allDay ?? false })));
      }
    } catch {}
  }, []);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/calendar/status");
      if (res.ok) {
        const data = await res.json() as { integrations: Integration[] };
        setIntegrations(data.integrations ?? []);
      }
    } catch {}
  }, []);

  const refreshRange = useCallback(() => {
    const start = view === "week" ? weekStart.toISOString().slice(0, 10) : format(startOfMonth(monthDate), "yyyy-MM-dd");
    const end   = view === "week" ? addDays(weekStart, 6).toISOString().slice(0, 10) : format(endOfMonth(monthDate), "yyyy-MM-dd");
    fetchLocal(start, end);
    fetchExternal(new Date(start + "T00:00:00").toISOString(), new Date(end + "T23:59:59").toISOString());
  }, [view, weekStart, monthDate, fetchLocal, fetchExternal]);

  // Init
  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    fetchIntegrations();
    if (typeof window !== "undefined" && "Notification" in window) setNotifPerm(Notification.permission);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to current time on week view mount
  useEffect(() => {
    if (view !== "week" || !gridRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const offset = Math.max(0, ((mins - GRID_START_MIN) / 30) * SLOT_HEIGHT_PX - 120);
    setTimeout(() => gridRef.current?.scrollTo({ top: offset, behavior: "smooth" }), 100);
  }, [view, mounted]);

  // Update current time line every minute
  useEffect(() => {
    const id = setInterval(() => setNowPct(getCurrentTimePercent()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { refreshRange(); }, [refreshRange]);
  useEffect(() => { if (localEvents.length > 0) scheduleNotifications(localEvents); }, [localEvents]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected) { setBanner(`✅ ${PROVIDER_LABEL[connected] ?? connected} conectado com sucesso!`); fetchIntegrations(); }
    else if (error) {
      const msgs: Record<string, string> = {
        google_denied: "Conexão com Google Agenda cancelada.",
        microsoft_denied: "Conexão com Outlook cancelada.",
        invalid_state: "Erro de segurança. Tente novamente.",
        google_token: "Erro ao obter tokens do Google.",
        microsoft_token: "Erro ao obter tokens da Microsoft.",
      };
      setBanner(`❌ ${msgs[error] ?? "Erro na conexão."}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestNotifPerm = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") scheduleNotifications(localEvents);
  };

  const eventsForDay = useCallback((day: Date): CalEvent[] => {
    const dateStr = format(day, "yyyy-MM-dd");
    const local = localEvents.filter(e => e.event_date === dateStr);
    const ext = (externalEvents as (CalEvent & { start?: string; end?: string; allDay?: boolean })[]).filter(e => {
      try { return isSameDay(parseISO((e.start ?? e.event_date) || dateStr), day); } catch { return false; }
    }).map(e => ({
      ...e,
      event_date: dateStr,
      all_day: e.all_day || e.allDay || false,
      start_time: (e.all_day || e.allDay) ? undefined : (e.start ? format(parseISO(e.start), "HH:mm") : undefined),
      end_time:   (e.all_day || e.allDay) ? undefined : (e.end   ? format(parseISO(e.end),   "HH:mm") : undefined),
    } as CalEvent));
    return [...local, ...ext].sort((a, b) => {
      if (a.all_day && !b.all_day) return -1;
      if (!a.all_day && b.all_day) return 1;
      return (a.start_time ?? "00:00").localeCompare(b.start_time ?? "00:00");
    });
  }, [localEvents, externalEvents]);

  const openCreate = (day: Date, slot?: string) => {
    setEditingEvent(null);
    setForm({
      title: "", description: "",
      type: "task", event_date: format(day, "yyyy-MM-dd"),
      start_time: slot ?? "", end_time: slot ? minutesToTime(timeToMinutes(slot) + 60) : "",
      all_day: false, remind_min: -1, color: "#8B5CF6", sync_google: false,
    });
    setModalOpen(true);
  };

  const openEdit = (ev: CalEvent) => {
    if (ev.source !== "local") return;
    setDetailEvent(null);
    setEditingEvent(ev);
    setForm({
      title: ev.title, description: ev.description ?? "",
      type: ev.type, event_date: ev.event_date,
      start_time: ev.start_time ?? "", end_time: ev.end_time ?? "",
      all_day: ev.all_day, remind_min: ev.remind_min ?? -1,
      color: ev.color, sync_google: false,
    });
    setModalOpen(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description || undefined,
        type: form.type, event_date: form.event_date,
        start_time: form.all_day ? undefined : (form.start_time || undefined),
        end_time:   form.all_day ? undefined : (form.end_time   || undefined),
        all_day: form.all_day,
        remind_min: form.remind_min >= 0 ? form.remind_min : undefined,
        color: form.color, sync_google: form.sync_google,
      };
      if (editingEvent) {
        const res = await fetch("/api/calendar/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingEvent.id, ...payload }) });
        if (res.ok) {
          const data = await res.json() as { event: CalEvent };
          setLocalEvents(prev => prev.map(ev => ev.id === editingEvent.id ? { ...data.event, source: "local" } : ev));
        }
      } else {
        const res = await fetch("/api/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) {
          const data = await res.json() as { event: CalEvent };
          setLocalEvents(prev => [...prev, { ...data.event, source: "local" }]);
        }
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  };

  const deleteEvent = async (id: string) => {
    await fetch("/api/calendar/events", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLocalEvents(prev => prev.filter(e => e.id !== id));
    setDetailEvent(null);
  };

  const disconnect = async (provider: string) => {
    await fetch("/api/integrations/calendar/disconnect", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    setIntegrations(prev => prev.filter(i => i.provider !== provider));
    setExternal(prev => prev.filter(e => e.provider !== provider));
  };

  if (!mounted) return null;

  const connectedProviders = new Set(integrations.map(i => i.provider));
  const hasGoogle = connectedProviders.has("google");
  const typeConfig = (type: string) => TYPE_OPTS.find(t => t.value === type) ?? TYPE_OPTS[0];
  const weekHasEvents = days.some(d => eventsForDay(d).length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 relative">
      {/* Ambient glows */}
      <div className="fixed top-0 right-[5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[20%] left-[2%] w-[300px] h-[300px] bg-violet-900/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-card/80 backdrop-blur border border-white/10 text-sm text-white shadow-lg">
            <span>{banner}</span>
            <button onClick={() => setBanner(null)} className="text-muted-foreground hover:text-white transition-colors"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">

        {/* Title */}
        <div className="flex items-end gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-0.5">Planejar</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-none">Agenda</h1>
          </div>
          <p className="text-muted-foreground text-sm capitalize pb-1">
            {view === "week"
              ? format(weekStart, "MMMM yyyy", { locale: ptBR })
              : format(monthDate, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-xl p-1 gap-0.5 mr-1">
            <button onClick={() => setView("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "week" ? "bg-primary text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)]" : "text-muted-foreground hover:text-white"}`}>
              <List size={13} /> Semana
            </button>
            <button onClick={() => setView("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "month" ? "bg-primary text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)]" : "text-muted-foreground hover:text-white"}`}>
              <Grid3x3 size={13} /> Mês
            </button>
          </div>

          <button onClick={() => view === "week" ? setWeekStart(w => subWeeks(w, 1)) : setMonthDate(d => subMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground hover:text-white transition-all border border-transparent hover:border-white/10">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => { const now = new Date(); setWeekStart(startOfWeek(now, { weekStartsOn: 1 })); setMonthDate(now); setSelectedDay(now); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/8 border border-transparent hover:border-white/10 transition-all">
            Hoje
          </button>
          <button onClick={() => view === "week" ? setWeekStart(w => addWeeks(w, 1)) : setMonthDate(d => addMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground hover:text-white transition-all border border-transparent hover:border-white/10">
            <ChevronRight size={18} />
          </button>

          <div className="w-px h-5 bg-white/10 mx-0.5" />

          <button onClick={requestNotifPerm} title={notifPerm === "granted" ? "Notificações ativas" : "Ativar notificações"}
            className={`p-2 rounded-xl transition-all border ${notifPerm === "granted" ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground hover:text-white border-transparent hover:border-white/10 hover:bg-white/8"}`}>
            {notifPerm === "granted" ? <Bell size={16} /> : <BellOff size={16} />}
          </button>

          <button onClick={() => setShowSettings(s => !s)} title="Conectar agendas externas"
            className={`p-2 rounded-xl transition-all border ${showSettings ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground hover:text-white border-transparent hover:border-white/10 hover:bg-white/8"}`}>
            <Link2 size={16} />
          </button>

          <button onClick={() => openCreate(selectedDay)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/85 text-white text-xs font-bold tracking-wide transition-all shadow-[0_4px_20px_rgba(139,92,246,0.35)] hover:shadow-[0_4px_24px_rgba(139,92,246,0.5)] border border-primary/30">
            <Plus size={15} /> Novo evento
          </button>
        </div>
      </motion.header>

      {/* Integration settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="bg-card/80 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Agendas externas</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Sincronize com Google Agenda ou Outlook</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-white transition-colors p-1"><X size={16} /></button>
              </div>
              <div className="space-y-2.5">
                {[
                  { key: "google",    label: "Google Agenda",          href: "/api/integrations/google/auth",    bg: "#4285F4", letter: "G" },
                  { key: "microsoft", label: "Outlook / Microsoft 365", href: "/api/integrations/microsoft/auth", bg: "#0078D4", letter: "M" },
                ].map(p => (
                  <div key={p.key} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-white/15 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md" style={{ background: p.bg }}>
                        {p.letter}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {connectedProviders.has(p.key) ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                              {integrations.find(i => i.provider === p.key)?.email}
                            </span>
                          ) : "Não conectado"}
                        </p>
                      </div>
                    </div>
                    {connectedProviders.has(p.key) ? (
                      <button onClick={() => disconnect(p.key)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-all">
                        <Link2Off size={11} /> Desconectar
                      </button>
                    ) : (
                      <a href={p.href} className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-all hover:opacity-90 shadow-md font-medium" style={{ background: p.bg }}>
                        <Link2 size={11} /> Conectar
                      </a>
                    )}
                  </div>
                ))}
                {notifPerm !== "granted" && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>Ative as notificações para receber lembretes. Clique no sino no cabeçalho.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected provider badges */}
      {integrations.length > 0 && !showSettings && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {integrations.map(i => (
            <div key={i.provider} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border backdrop-blur-sm"
              style={{ borderColor: `${PROVIDER_COLOR[i.provider]}35`, color: PROVIDER_COLOR[i.provider], background: `${PROVIDER_COLOR[i.provider]}10` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLOR[i.provider] }} />
              {PROVIDER_LABEL[i.provider]}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ MONTH VIEW ══════════════════════ */}
      {view === "month" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* DOW headers */}
          <div className="grid grid-cols-7 gap-1">
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d, i) => (
              <div key={d} className={`text-center text-[11px] font-bold uppercase tracking-widest py-2 ${i >= 5 ? "text-primary/60" : "text-muted-foreground/70"}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, i) => {
              const events  = eventsForDay(day);
              const inMonth = day.getMonth() === monthDate.getMonth();
              const active  = isSameDay(day, selectedDay);
              const today   = isToday(day);
              const weekend = getDay(day) === 0 || getDay(day) === 6;
              return (
                <button key={i} onClick={() => setSelectedDay(day)}
                  className={`min-h-[88px] p-2 rounded-2xl text-left transition-all border group relative overflow-hidden ${
                    active
                      ? "border-primary/40 bg-primary/[0.08] shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                      : today
                      ? "border-white/15 bg-white/[0.04]"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                  } ${!inMonth ? "opacity-25" : ""}`}>
                  {/* Day number */}
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1.5 transition-all ${
                    today
                      ? "bg-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                      : active
                      ? "text-primary"
                      : weekend && inMonth
                      ? "text-white/50"
                      : "text-white/70"
                  }`}>
                    {format(day, "d")}
                  </span>

                  {/* Event pills */}
                  <div className="space-y-0.5">
                    {events.slice(0, 3).map(ev => (
                      <div key={ev.id} className="text-[10px] truncate px-1.5 py-[2px] rounded-md font-semibold tracking-tight"
                        style={{ background: `${ev.color}22`, color: ev.color }}>
                        {!ev.all_day && ev.start_time ? <span className="opacity-75 mr-0.5">{ev.start_time}</span> : null}
                        {ev.title}
                      </div>
                    ))}
                    {events.length > 3 && (
                      <div className="text-[10px] text-muted-foreground/70 px-1 font-medium">
                        +{events.length - 3} mais
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day detail */}
          <motion.div key={selectedDay.toISOString()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card/70 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white capitalize">
                  {isToday(selectedDay) ? "Hoje" : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{eventsForDay(selectedDay).length} evento{eventsForDay(selectedDay).length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => openCreate(selectedDay)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-white hover:bg-primary font-semibold px-3 py-1.5 rounded-lg border border-primary/30 hover:border-primary transition-all">
                <Plus size={13} /> Novo
              </button>
            </div>
            <DayEventList events={eventsForDay(selectedDay)} onDetail={setDetailEvent} />
          </motion.div>
        </motion.div>
      )}

      {/* ══════════════════════ WEEK VIEW ══════════════════════ */}
      {view === "week" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.08] overflow-hidden bg-card/30 backdrop-blur shadow-2xl">

          {/* Day header row */}
          <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/[0.08] bg-card/60 backdrop-blur sticky top-0 z-20">
            <div className="border-r border-white/[0.06]" />
            {days.map((day, i) => {
              const active  = isSameDay(day, selectedDay);
              const today   = isToday(day);
              const weekend = getDay(day) === 0 || getDay(day) === 6;
              return (
                <button key={i} onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center gap-1 py-3.5 transition-all border-l border-white/[0.05] group relative overflow-hidden ${
                    active ? "bg-primary/[0.08]" : "hover:bg-white/[0.04]"
                  }`}>
                  {active && <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary rounded-full" />}
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${weekend ? "text-primary/60" : "text-muted-foreground/60"}`}>
                    {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                  </span>
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                    today ? "bg-primary text-white shadow-[0_0_16px_rgba(139,92,246,0.5)]"
                          : active ? "text-primary"
                          : "text-white/80 group-hover:text-white"
                  }`}>
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* All-day events strip */}
          {days.some(d => eventsForDay(d).some(e => e.all_day)) && (
            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/[0.06] bg-white/[0.015]">
              <div className="flex items-center justify-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-r border-white/[0.06] px-1 py-2">
                dia
              </div>
              {days.map((day, i) => {
                const all = eventsForDay(day).filter(e => e.all_day);
                return (
                  <div key={i} className="border-l border-white/[0.05] py-1 px-1 min-h-[32px]">
                    {all.map(ev => (
                      <div key={ev.id} onClick={() => setDetailEvent(ev)}
                        className="text-[10px] truncate px-2 py-1 rounded-lg mb-0.5 cursor-pointer font-semibold transition-all hover:brightness-125"
                        style={{ background: `${ev.color}25`, color: ev.color, borderLeft: `2px solid ${ev.color}` }}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time grid */}
          <div ref={gridRef}
            className="overflow-y-auto relative"
            style={{ maxHeight: "calc(100vh - 280px)", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>

            {/* Current time line */}
            {nowPct >= 0 && (
              <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                style={{ top: `${nowPct}%` }}>
                <div className="w-[52px] flex justify-end pr-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                </div>
                <div className="flex-1 h-[2px] bg-primary/70 shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
              </div>
            )}

            {/* Slot rows */}
            {TIME_SLOTS.map((slot, si) => {
              const isHour = slot.endsWith(":00");
              return (
                <div key={slot}
                  className={`grid grid-cols-[52px_repeat(7,1fr)] ${isHour ? "border-t border-white/[0.06]" : ""}`}
                  style={{ height: SLOT_HEIGHT_PX }}>
                  {/* Time label */}
                  <div className={`flex items-start justify-end pr-2.5 pt-1 border-r border-white/[0.05] select-none ${isHour ? "" : "border-t-0"}`}>
                    {isHour && (
                      <span className="text-[11px] font-semibold text-white/20 tabular-nums">{slot}</span>
                    )}
                  </div>

                  {/* Day columns */}
                  {days.map((day, di) => {
                    const startMin = timeToMinutes(slot);
                    const slotEvs  = eventsForDay(day).filter(ev => {
                      if (ev.all_day || !ev.start_time) return false;
                      const st = timeToMinutes(ev.start_time);
                      return st >= startMin && st < startMin + 30;
                    });
                    const isSelected = isSameDay(day, selectedDay);
                    return (
                      <div key={di}
                        onClick={() => openCreate(day, slot)}
                        className={`border-l border-white/[0.04] relative cursor-pointer group/cell transition-colors ${
                          isSelected ? "bg-primary/[0.025]" : ""
                        } hover:bg-white/[0.025] ${isHour ? "" : "border-t border-white/[0.025]"}`}>
                        {/* Hover indicator */}
                        <div className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                          <Plus size={12} className="text-white/20" />
                        </div>

                        {/* Events */}
                        {slotEvs.map(ev => {
                          const durationMins = ev.end_time
                            ? Math.max(30, timeToMinutes(ev.end_time) - timeToMinutes(ev.start_time!))
                            : 60;
                          const heightPx = (durationMins / 30) * SLOT_HEIGHT_PX - 4;
                          return (
                            <div key={ev.id}
                              onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                              className="absolute inset-x-1 top-1 z-10 rounded-lg cursor-pointer overflow-hidden transition-all hover:brightness-110 hover:shadow-lg"
                              style={{
                                height: heightPx,
                                background: `${ev.color}20`,
                                borderLeft: `3px solid ${ev.color}`,
                                backdropFilter: "blur(4px)",
                                boxShadow: `0 2px 8px ${ev.color}25`,
                              }}>
                              <div className="px-1.5 py-1">
                                <p className="text-[11px] font-bold leading-tight truncate" style={{ color: ev.color }}>
                                  {ev.title}
                                </p>
                                {ev.start_time && durationMins >= 60 && (
                                  <p className="text-[10px] opacity-70 mt-0.5" style={{ color: ev.color }}>
                                    {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Empty week state */}
          {!weekHasEvents && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <CalendarDays size={24} className="text-primary/40" />
              </div>
              <div className="text-center">
                <p className="text-white/60 font-medium text-sm">Nenhum evento esta semana</p>
                <p className="text-white/30 text-xs mt-1">Clique em qualquer horário para criar um</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ══════════════════════ CREATE / EDIT MODAL ══════════════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setModalOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f0f17] border border-white/[0.1] rounded-3xl p-6 w-full max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>

              {/* Modal header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">{editingEvent ? "Editar evento" : "Novo evento"}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(form.event_date + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/8 transition-all"><X size={18} /></button>
              </div>

              <form onSubmit={saveEvent} className="space-y-4">
                {/* Title */}
                <input autoFocus type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Título do evento…"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all text-sm font-medium" />

                {/* Type selector */}
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTS.map(t => {
                    const Icon = t.icon;
                    const sel  = form.type === t.value;
                    return (
                      <button key={t.value} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.value, color: t.color }))}
                        className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all ${
                          sel ? "text-white" : "border-white/[0.08] text-muted-foreground hover:border-white/15 hover:text-white"
                        }`}
                        style={sel ? { background: `${t.color}18`, borderColor: `${t.color}50`, boxShadow: `0 0 20px ${t.color}15` } : {}}>
                        <Icon size={16} style={{ color: sel ? t.color : undefined }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Date & time */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest block mb-1.5">Data</label>
                      <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 transition-all text-sm" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-5">
                      <div className={`relative w-9 h-5 rounded-full transition-all ${form.all_day ? "bg-primary" : "bg-white/15"}`}
                        onClick={() => setForm(f => ({ ...f, all_day: !f.all_day }))}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.all_day ? "left-4" : "left-0.5"}`} />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Dia inteiro</span>
                    </label>
                  </div>

                  {!form.all_day && (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest block mb-1.5">Início</label>
                        <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 text-sm transition-all" />
                      </div>
                      <div className="text-muted-foreground/40 mt-5">→</div>
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest block mb-1.5">Fim</label>
                        <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 text-sm transition-all" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest block mb-1.5">Notas (opcional)</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="Descrição, link, local…"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-all resize-none text-sm" />
                </div>

                {/* Reminder */}
                <div>
                  <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Bell size={10} /> Lembrete
                  </label>
                  <select value={form.remind_min} onChange={e => setForm(f => ({ ...f, remind_min: Number(e.target.value) }))}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all">
                    <option value={-1}>Sem lembrete</option>
                    {REMIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {notifPerm !== "granted" && form.remind_min >= 0 && (
                    <p className="text-[11px] text-amber-400/80 mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> Ative as notificações do navegador para receber este lembrete.</p>
                  )}
                </div>

                {/* Color */}
                <div>
                  <label className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest block mb-2">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {["#8B5CF6","#0EA5E9","#10B981","#F59E0B","#EF4444","#EC4899","#6366F1","#F97316"].map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-offset-[#0f0f17] ring-white/60 scale-110" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>

                {/* Google sync */}
                {hasGoogle && !form.all_day && form.start_time && !editingEvent && (
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-[#4285F4]/[0.06] hover:border-[#4285F4]/30 cursor-pointer transition-all group">
                    <input type="checkbox" checked={form.sync_google} onChange={e => setForm(f => ({ ...f, sync_google: e.target.checked }))} className="accent-primary w-4 h-4" />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#4285F4] text-white text-[9px] font-bold flex-shrink-0">G</div>
                      <div>
                        <p className="text-sm text-white font-semibold">Adicionar ao Google Agenda</p>
                        <p className="text-xs text-muted-foreground">Cria o evento também na sua conta Google</p>
                      </div>
                    </div>
                  </label>
                )}

                {/* Actions */}
                <div className="flex gap-2.5 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-white/[0.1] text-muted-foreground hover:text-white hover:border-white/20 text-sm font-semibold transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={!form.title.trim() || saving}
                    className="flex-1 bg-primary hover:bg-primary/85 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 shadow-[0_4px_20px_rgba(139,92,246,0.3)]">
                    {saving ? "Salvando…" : editingEvent ? "Salvar alterações" : "Criar evento"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════ EVENT DETAIL DRAWER ══════════════════════ */}
      <AnimatePresence>
        {detailEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setDetailEvent(null)}>
            <motion.div initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f0f17] border border-white/[0.1] rounded-3xl p-6 w-full max-w-sm shadow-[0_24px_80px_rgba(0,0,0,0.6)]">

              {/* Color accent bar */}
              <div className="h-1 rounded-full mb-5 -mx-6 -mt-6 rounded-t-3xl" style={{ background: `linear-gradient(90deg, ${detailEvent.color}80, ${detailEvent.color}20)` }} />

              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${detailEvent.color}20` }}>
                    {(() => { const Icon = typeConfig(detailEvent.type).icon; return <Icon size={16} style={{ color: detailEvent.color }} />; })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: detailEvent.color }}>
                      {typeConfig(detailEvent.type).label}
                      {detailEvent.source !== "local" && <span className="ml-1.5 opacity-60">{PROVIDER_LABEL[detailEvent.source ?? ""] ?? ""}</span>}
                    </p>
                    <h3 className="text-base font-bold text-white leading-snug">{detailEvent.title}</h3>
                  </div>
                </div>
                <button onClick={() => setDetailEvent(null)} className="p-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/8 transition-all ml-2 flex-shrink-0">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 mb-5">
                <DetailRow icon={<CalendarDays size={14} />}>
                  {format(new Date(detailEvent.event_date + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </DetailRow>
                {!detailEvent.all_day && detailEvent.start_time && (
                  <DetailRow icon={<Clock size={14} />}>
                    {detailEvent.start_time}{detailEvent.end_time ? ` – ${detailEvent.end_time}` : ""}
                  </DetailRow>
                )}
                {detailEvent.description && (
                  <DetailRow icon={<FileText size={14} />}>
                    {detailEvent.description}
                  </DetailRow>
                )}
                {detailEvent.remind_min != null && detailEvent.remind_min >= 0 && (
                  <DetailRow icon={<Bell size={14} />}>
                    {REMIND_OPTS.find(o => o.value === detailEvent.remind_min)?.label ?? "Lembrete"}
                  </DetailRow>
                )}
              </div>

              {detailEvent.source === "local" && (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(detailEvent)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.1] text-sm text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 font-semibold transition-all">
                    <Edit2 size={13} /> Editar
                  </button>
                  <button onClick={() => deleteEvent(detailEvent.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-500/20 text-sm text-red-400 hover:bg-red-500/10 hover:border-red-500/40 font-semibold transition-all">
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground/50 flex-shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  );
}

function DayEventList({ events, onDetail }: { events: CalEvent[]; onDetail: (e: CalEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <CalendarDays size={18} className="text-primary/30" />
        </div>
        <p className="text-muted-foreground/70 text-sm">Sem eventos neste dia</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={ev.id} onClick={() => onDetail(ev)}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.05] cursor-pointer transition-all group"
          style={{ borderLeftWidth: 3, borderLeftColor: ev.color }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-semibold truncate group-hover:text-white/90">{ev.title}</p>
            {!ev.all_day && ev.start_time && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                <Clock size={10} /> {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}
              </p>
            )}
          </div>
          {ev.source !== "local" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
              style={{ color: PROVIDER_COLOR[ev.source ?? ""], borderColor: `${PROVIDER_COLOR[ev.source ?? ""]}35`, background: `${PROVIDER_COLOR[ev.source ?? ""]}10` }}>
              {PROVIDER_LABEL[ev.source ?? ""]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

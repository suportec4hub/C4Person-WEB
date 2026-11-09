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
  MapPin, FileText, Trash2, Edit2, Video, CheckSquare,
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
  { value: 0,   label: "Na hora" },
  { value: 5,   label: "5 min antes" },
  { value: 10,  label: "10 min antes" },
  { value: 15,  label: "15 min antes" },
  { value: 30,  label: "30 min antes" },
  { value: 60,  label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

const PROVIDER_LABEL: Record<string, string> = { google: "Google", microsoft: "Outlook" };
const PROVIDER_COLOR: Record<string, string> = { google: "#4285F4", microsoft: "#0078D4" };

const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const totalMins = 6 * 60 + i * 30;
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
          body: ev.remind_min === 0
            ? "Agora!"
            : `Começa em ${ev.remind_min} min (${ev.start_time})`,
          icon: "/favicon.ico",
          tag: ev.id,
        });
      }, delay);
    }
  }
}

export default function CalendarPage() {
  const searchParams = useSearchParams();

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

  // Modal state
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingEvent, setEditingEvent]   = useState<CalEvent | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", type: "task" as "task" | "meeting" | "reminder",
    event_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "", end_time: "", all_day: false,
    remind_min: -1, color: "#8B5CF6", sync_google: false,
  });
  const [saving, setSaving] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);

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

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    fetchIntegrations();
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refreshRange(); }, [refreshRange]);

  useEffect(() => {
    if (localEvents.length > 0) scheduleNotifications(localEvents);
  }, [localEvents]);

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
        title:       form.title,
        description: form.description || undefined,
        type:        form.type,
        event_date:  form.event_date,
        start_time:  form.all_day ? undefined : (form.start_time || undefined),
        end_time:    form.all_day ? undefined : (form.end_time   || undefined),
        all_day:     form.all_day,
        remind_min:  form.remind_min >= 0 ? form.remind_min : undefined,
        color:       form.color,
        sync_google: form.sync_google,
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
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 relative">
      <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-white/10 text-sm text-white">
            <span>{banner}</span>
            <button onClick={() => setBanner(null)} className="text-muted-foreground hover:text-white"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-muted-foreground text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">Planejar</h2>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {view === "week"
              ? format(weekStart, "MMMM yyyy", { locale: ptBR })
              : format(monthDate, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-white/5 rounded-xl p-1 gap-0.5">
            <button onClick={() => setView("week")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "week" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}>
              <List size={14} /> Semana
            </button>
            <button onClick={() => setView("month")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "month" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}>
              <Grid3x3 size={14} /> Mês
            </button>
          </div>

          {/* Nav */}
          <button onClick={() => view === "week" ? setWeekStart(w => subWeeks(w, 1)) : setMonthDate(d => subMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all">
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => { const now = new Date(); setWeekStart(startOfWeek(now, { weekStartsOn: 1 })); setMonthDate(now); setSelectedDay(now); }}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 text-muted-foreground hover:text-white transition-all">
            Hoje
          </button>
          <button onClick={() => view === "week" ? setWeekStart(w => addWeeks(w, 1)) : setMonthDate(d => addMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all">
            <ChevronRight size={20} />
          </button>

          {/* Notifications */}
          <button
            onClick={requestNotifPerm}
            title={notifPerm === "granted" ? "Notificações ativas" : "Ativar notificações"}
            className={`p-2 rounded-xl transition-all ${notifPerm === "granted" ? "text-primary hover:bg-primary/10" : "hover:bg-white/5 text-muted-foreground hover:text-white"}`}>
            {notifPerm === "granted" ? <Bell size={18} /> : <BellOff size={18} />}
          </button>

          {/* Connect */}
          <button onClick={() => setShowSettings(s => !s)}
            title="Conectar agendas externas"
            className={`p-2 rounded-xl transition-all ${showSettings ? "bg-primary text-white" : "hover:bg-white/5 text-muted-foreground hover:text-white"}`}>
            <Link2 size={18} />
          </button>

          {/* New event */}
          <button onClick={() => openCreate(selectedDay)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-all shadow-[0_4px_16px_rgba(139,92,246,0.25)]">
            <Plus size={16} /> Novo evento
          </button>
        </div>
      </motion.header>

      {/* Integration settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <div className="bg-card border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-sm">Agendas externas</h3>
                <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-white"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { key: "google",    label: "Google Agenda",         href: "/api/integrations/google/auth",    bg: "#4285F4" },
                  { key: "microsoft", label: "Outlook / Microsoft 365", href: "/api/integrations/microsoft/auth", bg: "#0078D4" },
                ].map(p => (
                  <div key={p.key} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: p.bg }}>
                        {p.key === "google" ? "G" : "M"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {connectedProviders.has(p.key) ? integrations.find(i => i.provider === p.key)?.email : "Não conectado"}
                        </p>
                      </div>
                    </div>
                    {connectedProviders.has(p.key) ? (
                      <button onClick={() => disconnect(p.key)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-3 py-1.5 rounded-lg transition-all">
                        <Link2Off size={12} /> Desconectar
                      </button>
                    ) : (
                      <a href={p.href} className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-all" style={{ background: p.bg }}>
                        <Link2 size={12} /> Conectar
                      </a>
                    )}
                  </div>
                ))}
                {notifPerm !== "granted" && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>Ative as notificações para receber lembretes dos seus eventos.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected badges */}
      {integrations.length > 0 && !showSettings && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {integrations.map(i => (
            <div key={i.provider} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
              style={{ borderColor: `${PROVIDER_COLOR[i.provider]}40`, color: PROVIDER_COLOR[i.provider] }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLOR[i.provider] }} />
              {PROVIDER_LABEL[i.provider]}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════ MONTH VIEW ═══════════════ */}
      {view === "month" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, i) => {
              const events = eventsForDay(day);
              const inMonth = day.getMonth() === monthDate.getMonth();
              const active  = isSameDay(day, selectedDay);
              const today   = isToday(day);
              return (
                <button key={i} onClick={() => { setSelectedDay(day); if (view === "month") {} }}
                  className={`min-h-[80px] p-1.5 rounded-xl text-left transition-all border ${
                    active ? "border-primary bg-primary/10" : today ? "border-white/20 bg-white/5" : "border-transparent hover:border-white/10 hover:bg-white/3"
                  } ${!inMonth ? "opacity-30" : ""}`}>
                  <span className={`text-sm font-semibold ${active ? "text-primary" : today ? "text-white" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {events.slice(0, 3).map(ev => (
                      <div key={ev.id} className="text-[10px] truncate px-1 py-0.5 rounded font-medium"
                        style={{ background: `${ev.color}25`, color: ev.color }}>
                        {ev.start_time && !ev.all_day ? `${ev.start_time} ` : ""}{ev.title}
                      </div>
                    ))}
                    {events.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{events.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day detail panel */}
          <motion.div key={selectedDay.toISOString()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                {isToday(selectedDay) ? "Hoje" : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <button onClick={() => openCreate(selectedDay)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                <Plus size={14} /> Novo
              </button>
            </div>
            <DayEventList events={eventsForDay(selectedDay)} onDetail={setDetailEvent} />
          </motion.div>
        </motion.div>
      )}

      {/* ═══════════════ WEEK VIEW ═══════════════ */}
      {view === "week" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Day strip header */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-0 mb-0 border border-white/10 rounded-t-2xl overflow-hidden">
            <div className="bg-card/50" />
            {days.map((day, i) => {
              const active = isSameDay(day, selectedDay);
              const today  = isToday(day);
              return (
                <button key={i} onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center gap-1 py-3 transition-all border-l border-white/5 ${active ? "bg-primary/15" : "hover:bg-white/5"}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                  </span>
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                    active ? "bg-primary text-white" : today ? "bg-white/15 text-white" : "text-muted-foreground"
                  }`}>
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* All-day events row */}
          {(() => {
            const anyAllDay = days.some(d => eventsForDay(d).some(e => e.all_day));
            if (!anyAllDay) return null;
            return (
              <div className="grid grid-cols-[48px_repeat(7,1fr)] border-x border-b border-white/10 mb-0">
                <div className="flex items-center justify-center text-[10px] text-muted-foreground px-1 py-2 border-r border-white/10">dia</div>
                {days.map((day, i) => {
                  const all = eventsForDay(day).filter(e => e.all_day);
                  return (
                    <div key={i} className="border-l border-white/5 py-1 px-0.5 min-h-[28px]">
                      {all.map(ev => (
                        <div key={ev.id} onClick={() => setDetailEvent(ev)}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded mb-0.5 cursor-pointer font-medium"
                          style={{ background: `${ev.color}30`, color: ev.color }}>
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Time grid */}
          <div className="border-x border-b border-white/10 rounded-b-2xl overflow-hidden">
            <div className="overflow-y-auto max-h-[calc(100vh-320px)] relative">
              {TIME_SLOTS.map((slot, si) => (
                <div key={slot} className="grid grid-cols-[48px_repeat(7,1fr)] group/row">
                  <div className="text-[10px] text-muted-foreground/60 py-2 pr-2 text-right border-r border-white/8 select-none sticky-left">
                    {slot.endsWith(":00") ? slot : ""}
                  </div>
                  {days.map((day, di) => {
                    const startMin = timeToMinutes(slot);
                    const endMin   = startMin + 30;
                    const slotEvs  = eventsForDay(day).filter(ev => {
                      if (ev.all_day || !ev.start_time) return false;
                      const st = timeToMinutes(ev.start_time);
                      return st >= startMin && st < endMin;
                    });
                    return (
                      <div key={di}
                        onClick={() => openCreate(day, slot)}
                        className={`border-l border-b border-white/5 relative min-h-[28px] hover:bg-white/3 cursor-pointer transition-colors ${si % 2 === 0 ? "border-b-white/8" : ""}`}>
                        {slotEvs.map(ev => (
                          <div key={ev.id}
                            onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                            className="absolute inset-x-0.5 top-0.5 z-10 text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer truncate shadow-sm"
                            style={{ background: `${ev.color}30`, color: ev.color, borderLeft: `2px solid ${ev.color}` }}>
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════ CREATE/EDIT MODAL ═══════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">
                  {editingEvent ? "Editar evento" : "Novo evento"}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-white"><X size={20} /></button>
              </div>

              <form onSubmit={saveEvent} className="space-y-4">
                {/* Title */}
                <input autoFocus type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Título do evento…"
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors" />

                {/* Type */}
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.value} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.value, color: t.color }))}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.type === t.value ? "border-primary/50 text-white" : "border-white/10 text-muted-foreground hover:border-white/20"
                        }`}
                        style={form.type === t.value ? { background: `${t.color}20`, borderColor: `${t.color}60` } : {}}>
                        <Icon size={16} style={{ color: form.type === t.value ? t.color : undefined }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data</label>
                    <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                      className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 transition-colors text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                      Dia inteiro
                      <input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} className="accent-primary" />
                    </label>
                    {!form.all_day && (
                      <div className="flex gap-2 items-center">
                        <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                          className="flex-1 bg-background border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 text-sm" />
                        <span className="text-muted-foreground text-xs">até</span>
                        <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                          className="flex-1 bg-background border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-primary/50 text-sm" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Descrição (opcional)</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="Adicionar notas ou local…"
                    className="bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-colors resize-none text-sm" />
                </div>

                {/* Reminder */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
                    <Bell size={11} /> Lembrete
                  </label>
                  <select value={form.remind_min} onChange={e => setForm(f => ({ ...f, remind_min: Number(e.target.value) }))}
                    className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors">
                    <option value={-1}>Sem lembrete</option>
                    {REMIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {notifPerm !== "granted" && form.remind_min >= 0 && (
                    <p className="text-xs text-yellow-400">Ative as notificações do navegador para receber este lembrete.</p>
                  )}
                </div>

                {/* Color */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {["#8B5CF6","#0EA5E9","#10B981","#F59E0B","#EF4444","#EC4899","#6366F1","#F97316"].map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-1 ring-offset-background ring-white/50 scale-110" : "hover:scale-105"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>

                {/* Google sync */}
                {hasGoogle && !form.all_day && form.start_time && !editingEvent && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/3 cursor-pointer hover:border-white/20 transition-all">
                    <input type="checkbox" checked={form.sync_google} onChange={e => setForm(f => ({ ...f, sync_google: e.target.checked }))} className="accent-primary" />
                    <div>
                      <p className="text-sm text-white font-medium">Adicionar ao Google Agenda</p>
                      <p className="text-xs text-muted-foreground">Cria o evento também na sua conta Google</p>
                    </div>
                  </label>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 text-sm font-medium transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={!form.title.trim() || saving}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50">
                    {saving ? "Salvando…" : editingEvent ? "Salvar" : "Criar evento"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ EVENT DETAIL DRAWER ═══════════════ */}
      <AnimatePresence>
        {detailEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDetailEvent(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: detailEvent.color }} />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                      {typeConfig(detailEvent.type).label}
                      {detailEvent.source !== "local" && <span className="ml-1.5 opacity-60">{PROVIDER_LABEL[detailEvent.source ?? ""] ?? ""}</span>}
                    </p>
                    <h3 className="text-lg font-bold text-white">{detailEvent.title}</h3>
                  </div>
                </div>
                <button onClick={() => setDetailEvent(null)} className="text-muted-foreground hover:text-white ml-2 flex-shrink-0"><X size={18} /></button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CalendarDays size={15} className="flex-shrink-0" />
                  <span>{format(new Date(detailEvent.event_date + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
                </div>
                {!detailEvent.all_day && detailEvent.start_time && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Clock size={15} className="flex-shrink-0" />
                    <span>{detailEvent.start_time}{detailEvent.end_time ? ` – ${detailEvent.end_time}` : ""}</span>
                  </div>
                )}
                {detailEvent.description && (
                  <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <FileText size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{detailEvent.description}</span>
                  </div>
                )}
                {detailEvent.remind_min != null && detailEvent.remind_min >= 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Bell size={15} className="flex-shrink-0" />
                    <span>{REMIND_OPTS.find(o => o.value === detailEvent.remind_min)?.label ?? "Lembrete"}</span>
                  </div>
                )}
              </div>

              {detailEvent.source === "local" && (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(detailEvent)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white hover:border-white/20 transition-all">
                    <Edit2 size={14} /> Editar
                  </button>
                  <button onClick={() => deleteEvent(detailEvent.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-500/20 text-sm text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={14} /> Excluir
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

function DayEventList({ events, onDetail }: { events: CalEvent[]; onDetail: (e: CalEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CalendarDays size={28} className="text-primary/30 mb-2" />
        <p className="text-muted-foreground text-sm">Sem eventos neste dia</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={ev.id} onClick={() => onDetail(ev)}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 cursor-pointer transition-all"
          style={{ borderLeftWidth: 3, borderLeftColor: ev.color }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{ev.title}</p>
            {!ev.all_day && ev.start_time && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                <Clock size={10} className="inline mr-1" />
                {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}
              </p>
            )}
          </div>
          {ev.source !== "local" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0"
              style={{ color: PROVIDER_COLOR[ev.source ?? ""], borderColor: `${PROVIDER_COLOR[ev.source ?? ""]}40` }}>
              {PROVIDER_LABEL[ev.source ?? ""]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

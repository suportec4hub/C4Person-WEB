"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setNotifications(data as Notification[]);
  }, []);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase.channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, fetchNotifications)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  };

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) markAllRead(); }}
        className="p-3 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all relative"
        title="Notificações"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 top-0 z-50 w-80 bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Notificações</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    <Check size={12} /> Marcar todas lidas
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Bell size={28} className="text-muted-foreground mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? "text-white font-medium" : "text-white/70"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(new Date(n.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

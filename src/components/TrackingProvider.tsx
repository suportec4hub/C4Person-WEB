"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TrackingProvider() {
  const pathname = usePathname();
  const lastPageRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendBeat = async (isNavigation = false) => {
    try {
      await fetch("/api/track/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathname, isNavigation }),
      });
    } catch { /* silent — never break the app */ }
  };

  // Log page view whenever the route changes
  useEffect(() => {
    if (lastPageRef.current !== pathname) {
      lastPageRef.current = pathname;
      sendBeat(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Heartbeat every 60s to keep presence fresh
  useEffect(() => {
    sendBeat(false);
    timerRef.current = setInterval(() => sendBeat(false), 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

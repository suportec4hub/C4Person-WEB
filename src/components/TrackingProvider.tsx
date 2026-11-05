"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

function getOrCreateSessionId(): string {
  try {
    const key = "c4p_sid";
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function TrackingProvider() {
  const pathname = usePathname();
  const sessionId      = useRef<string>(getOrCreateSessionId());
  const lastPageRef    = useRef<string | null>(null);
  const pageEntryTime  = useRef<number>(Date.now());
  const scrollDepthRef = useRef<number>(0);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendBeat = useCallback(async (opts: {
    isNavigation?: boolean;
    timeOnPage?: number;
    scrollDepth?: number;
  } = {}) => {
    try {
      await fetch("/api/track/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pathname,
          sessionId: sessionId.current,
          isNavigation: opts.isNavigation ?? false,
          timeOnPage: opts.timeOnPage,
          scrollDepth: opts.scrollDepth ?? scrollDepthRef.current,
        }),
      });
    } catch { /* never break the app */ }
  }, [pathname]);

  // Track scroll depth
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop + el.clientHeight;
      const total = el.scrollHeight;
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      if (pct > scrollDepthRef.current) scrollDepthRef.current = pct;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // On route change: log navigation + reset scroll/time trackers
  useEffect(() => {
    if (lastPageRef.current !== null && lastPageRef.current !== pathname) {
      // Send final metrics for the page we're leaving
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      sendBeat({ isNavigation: false, timeOnPage, scrollDepth: scrollDepthRef.current });
    }
    // Now enter the new page
    lastPageRef.current = pathname;
    pageEntryTime.current = Date.now();
    scrollDepthRef.current = 0;
    sendBeat({ isNavigation: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Initial beat on mount
  useEffect(() => {
    sendBeat({ isNavigation: true });
    timerRef.current = setInterval(() => sendBeat(), 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

"use client";

import { useEffect, useRef } from "react";

function getOrCreateAnonId(): string {
  try {
    const key = "c4p_anon";
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function trackFunnelEvent(
  event: string,
  page?: string,
  metadata?: Record<string, unknown>
) {
  const session_id = getOrCreateAnonId();
  fetch("/api/track/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, event, page, metadata }),
  }).catch(() => {});
}

export function FunnelTracker({ page }: { page: string }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackFunnelEvent("page_view", page);
  }, [page]);

  return null;
}

"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TrialBanner } from "@/components/TrialBanner";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { SearchModal } from "@/components/SearchModal";

interface Props {
  children: React.ReactNode;
  isAdmin: boolean;
  showTrialBanner: boolean;
  trialEnd: string | null;
}

export function DashboardShell({ children, isAdmin, showTrialBanner, trialEnd }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parsedTrialEnd = trialEnd ? new Date(trialEnd) : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showTrialBanner && parsedTrialEnd && <TrialBanner trialEnd={parsedTrialEnd} />}
        {children}
      </div>
      <PomodoroTimer />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

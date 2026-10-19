"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Target, Wallet, PenTool, LogOut, Shield, UserCircle, CalendarDays, BarChart3, LifeBuoy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { SupportModal } from "@/components/SupportModal";

const NAV = [
  { href: "/C4Person",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/C4Person/goals",    icon: Target,          label: "Meta" },
  { href: "/C4Person/finance",  icon: Wallet,          label: "Finanças" },
  { href: "/C4Person/notes",    icon: PenTool,         label: "Notas" },
  { href: "/C4Person/calendar", icon: CalendarDays,    label: "Calendário" },
  { href: "/C4Person/reports",  icon: BarChart3,       label: "Relatório" },
  { href: "/C4Person/profile",  icon: UserCircle,      label: "Perfil" },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [supportOpen, setSupportOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
  };

  return (
    <>
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-16 glass border-r border-border flex-col items-center py-4 gap-0 relative z-10 flex-shrink-0 overflow-y-auto">
        {/* Logo */}
        <Link href="/C4Person" className="mb-4 flex-shrink-0 w-9 h-9 block" aria-label="C4Person">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_8px_rgba(124,58,237,0.6)]">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3730a3"/>
                <stop offset="52%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#c026d3"/>
              </linearGradient>
              <radialGradient id="sl" cx="38%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".18"/>
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
              </radialGradient>
              <clipPath id="srr"><rect width="100" height="100" rx="22"/></clipPath>
            </defs>
            <g clipPath="url(#srr)">
              <rect width="100" height="100" fill="url(#sg)"/>
              <rect width="100" height="100" fill="url(#sl)"/>
              <path d="M 43.9,59.7 A 17,17 0 1 0 43.9,40.3" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round"/>
              <line x1="69" y1="22" x2="69" y2="78" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
              <line x1="69" y1="22" x2="52" y2="57" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
              <line x1="48" y1="57" x2="73" y2="57" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
              <polygon points="50,74 53.5,78 50,82 46.5,78" fill="#fff" opacity=".45"/>
            </g>
          </svg>
        </Link>

        {/* Nav */}
        <nav className="flex flex-col gap-1 text-muted-foreground flex-1 items-center w-full px-2">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all ${
                pathname === href
                  ? "nav-item-active"
                  : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={20} />
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 items-center w-full px-2 pt-2 flex-shrink-0 text-muted-foreground">
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={() => setSupportOpen(true)}
            title="Suporte"
            className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-white/5 hover:text-white transition-all"
          >
            <LifeBuoy size={20} />
          </button>
          {isAdmin && (
            <Link
              href="/admin"
              title="Painel Admin"
              className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <Shield size={20} />
            </Link>
          )}
          <button
            onClick={handleLogout}
            title="Sair"
            className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      {/* pb-safe-2: padding-bottom = env(safe-area-inset-bottom) + 0.5rem
          so nav icons clear the home-indicator bar on iPhone */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 flex items-center justify-around px-1 pt-2 pb-safe-2 pl-safe pr-safe">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all min-w-[38px] ${
                active ? "text-primary drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]" : "text-muted-foreground"
              }`}
            >
              <Icon size={17} />
              <span className="text-[7px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setSupportOpen(true)}
          className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl text-muted-foreground hover:text-white transition-all min-w-[38px]"
        >
          <LifeBuoy size={17} />
          <span className="text-[7px] font-medium leading-none">Suporte</span>
        </button>
        {isAdmin && (
          <Link
            href="/admin"
            className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl text-muted-foreground hover:text-red-400 transition-all min-w-[38px]"
          >
            <Shield size={17} />
            <span className="text-[7px] font-medium leading-none">Admin</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl text-muted-foreground hover:text-red-400 transition-all min-w-[38px]"
        >
          <LogOut size={17} />
          <span className="text-[7px] font-medium leading-none">Sair</span>
        </button>
      </nav>
    </>
  );
}

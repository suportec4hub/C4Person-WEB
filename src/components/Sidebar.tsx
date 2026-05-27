"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Target, Wallet, PenTool, LogOut, Shield, UserCircle, CalendarDays, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const NAV = [
  { href: "/C4Person",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/C4Person/goals",    icon: Target,          label: "Nexus" },
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

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
  };

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-16 glass border-r border-border flex-col items-center py-4 gap-0 relative z-10 flex-shrink-0 overflow-y-auto">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(139,92,246,0.5)] mb-4 flex-shrink-0">
          C4
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 text-muted-foreground flex-1 items-center w-full px-2">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all ${
                pathname === href
                  ? "bg-white/5 text-primary"
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
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={17} />
              <span className="text-[7px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Target, Wallet, PenTool, LogOut, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/C4Person",         icon: LayoutDashboard, label: "Dashboard" },
  { href: "/C4Person/goals",   icon: Target,          label: "Nexus · Metas" },
  { href: "/C4Person/finance", icon: Wallet,          label: "Nectar · Finanças" },
  { href: "/C4Person/notes",   icon: PenTool,         label: "Anotar · Notas" },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-20 glass border-r border-border flex flex-col items-center py-8 gap-8 relative z-10 flex-shrink-0">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(139,92,246,0.5)]">
        C4
      </div>

      <nav className="flex flex-col gap-6 mt-8 text-muted-foreground">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`p-3 rounded-xl transition-all ${
              pathname === href
                ? "bg-white/5 text-primary"
                : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={22} />
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 text-muted-foreground">
        {isAdmin && (
          <Link
            href="/admin"
            title="Painel Admin"
            className="p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <Shield size={22} />
          </Link>
        )}
        <button
          onClick={handleLogout}
          title="Sair"
          className="p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={22} />
        </button>
      </div>
    </aside>
  );
}

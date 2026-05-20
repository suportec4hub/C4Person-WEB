"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Calendar, PenTool, Settings } from "lucide-react";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/goals", icon: Target, label: "Nexus · Metas" },
  { href: "/calendar", icon: Calendar, label: "Agenda" },
  { href: "/notes", icon: PenTool, label: "Notas" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-20 glass border-r border-border flex flex-col items-center py-8 gap-8 relative z-10 flex-shrink-0">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(139,92,246,0.5)]">
        NL
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

      <div className="mt-auto flex flex-col gap-6 text-muted-foreground">
        <button className="p-3 rounded-xl hover:bg-white/5 hover:text-white transition-all" title="Configurações">
          <Settings size={22} />
        </button>
        <div className="w-10 h-10 rounded-full bg-secondary border border-border overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ui-avatars.com/api/?name=Lucas+Machado&background=27272a&color=fff"
            alt="User"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </aside>
  );
}

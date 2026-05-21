import Link from "next/link";
import { LayoutDashboard, Users, UserPlus, ArrowLeft, Shield } from "lucide-react";

const NAV = [
  { href: "/admin",        icon: LayoutDashboard, label: "Visão Geral" },
  { href: "/admin/users",  icon: Users,           label: "Usuários" },
  { href: "/admin/create", icon: UserPlus,        label: "Criar Admin" },
];

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-white/5 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Shield size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">C4 Person</p>
              <p className="text-red-400 text-xs font-semibold">ADMIN</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-4 border-t border-white/5">
          <Link
            href="/C4Person"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft size={17} />
            Voltar ao App
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}

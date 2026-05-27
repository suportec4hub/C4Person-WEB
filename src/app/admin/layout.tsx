import Link from "next/link";
import { LayoutDashboard, Users, UserPlus, ArrowLeft, Shield } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isC4HubAdmin } from "@/lib/admin-auth";

const NAV = [
  { href: "/admin",        icon: LayoutDashboard, label: "Visão Geral" },
  { href: "/admin/users",  icon: Users,           label: "Usuários" },
  { href: "/admin/create", icon: UserPlus,        label: "Criar Admin" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isC4HubAdmin(profile?.role)) redirect("/C4Person");

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col md:flex-row">
      {/* ── Mobile top bar ── */}
      {/* pt-safe-3: padding-top = env(safe-area-inset-top) + 0.75rem so content
          clears the Dynamic Island / status bar on iPhone */}
      <div className="md:hidden flex items-center gap-3 px-4 pb-3 pt-safe-3 border-b border-white/5 bg-background/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
          <Shield size={13} className="text-red-400" />
        </div>
        <p className="text-white font-bold text-sm flex-1">Admin C4HUB</p>
        <div className="flex items-center gap-0.5">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className="p-2 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <Icon size={16} />
            </Link>
          ))}
          <Link href="/C4Person" title="Voltar ao App" className="p-2 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <ArrowLeft size={16} />
          </Link>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 border-r border-white/5 flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Shield size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">C4 Person</p>
              <p className="text-red-400 text-xs font-semibold">ADMIN C4HUB</p>
            </div>
          </div>
        </div>

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

      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}

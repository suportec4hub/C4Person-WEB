import { DashboardShell } from "@/app/C4Person/DashboardShell";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  const isFullAdmin = profile?.role === "ADMIN_C4HUB" || profile?.role === "admin";
  const isElevated = isFullAdmin || profile?.role === "ADM_PADRAO";

  if (!isElevated) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (sub?.status !== "active") {
      redirect("/assinar");
    }
  }

  return (
    <DashboardShell isAdmin={isFullAdmin}>
      {children}
    </DashboardShell>
  );
}

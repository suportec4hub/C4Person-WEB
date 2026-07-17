export const dynamic = "force-dynamic";
import { CheckCircle2, Lock, Zap, ArrowRight, Clock } from "lucide-react";
import { CheckoutButton } from "@/components/CheckoutButton";
import Link from "next/link";

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  const isExpired = expired === "true";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed top-0 left-[20%] w-[600px] h-[600px] bg-primary/8 rounded-full blur-[140px] pointer-events-none -z-0" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-accent/4 rounded-full blur-[120px] pointer-events-none -z-0" />

      <div className="relative z-10 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            C4
          </div>
          <span className="font-bold text-white text-xl">C4 Person</span>
        </div>

        <div className="bg-card border border-primary/20 rounded-3xl p-8 shadow-[0_0_80px_rgba(139,92,246,0.1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-300 rounded-t-3xl" />

          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            isExpired ? "bg-amber-500/10 border border-amber-500/20" : "bg-primary/10 border border-primary/20"
          }`}>
            {isExpired
              ? <Clock size={28} className="text-amber-400" />
              : <Lock size={28} className="text-primary" />}
          </div>

          <h1 className="text-2xl font-black text-white mb-2">
            {isExpired ? "Período de Teste Encerrado" : "Acesso Restrito"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {isExpired
              ? "Seus 15 dias de acesso gratuito expiraram. Assine agora para continuar usando o C4 Person e não perder seu progresso."
              : "Para acessar o C4 Person você precisa de uma assinatura ativa. Assine agora e tenha acesso imediato a todas as funcionalidades."}
          </p>

          <div className="flex items-end gap-2 justify-center mb-6">
            <span className="text-4xl font-black text-white">R$15,90</span>
            <span className="text-muted-foreground text-sm mb-1">/mês</span>
          </div>

          <div className="bg-background/60 border border-white/5 rounded-2xl p-4 mb-6 text-left space-y-2">
            {[
              "Tarefas e hábitos ilimitados",
              "Controle financeiro completo",
              "Notas com IA (Whisper + Llama)",
              "Sistema de metas com marcos",
              "Assistente IA personalizado",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <Zap size={13} className="text-primary shrink-0" />
                <span className="text-white/80">{f}</span>
              </div>
            ))}
          </div>

          <CheckoutButton className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2">
            Assinar agora <ArrowRight size={17} />
          </CheckoutButton>

          {!isExpired && (
            <p className="mt-4 text-xs text-muted-foreground">
              <CheckCircle2 size={12} className="inline mr-1 text-emerald-400" />
              15 dias grátis para novos usuários
            </p>
          )}
        </div>

        <Link
          href="/login"
          className="mt-5 inline-block text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Entrar com outra conta
        </Link>
      </div>
    </div>
  );
}

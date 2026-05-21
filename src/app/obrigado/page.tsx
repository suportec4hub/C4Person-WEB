import Link from "next/link";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";

export default function ObrigadoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed top-0 left-[20%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none -z-0" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px] pointer-events-none -z-0" />

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            C4
          </div>
          <span className="font-bold text-white text-xl">C4 Person</span>
        </div>

        {/* Success card */}
        <div className="bg-card border border-primary/20 rounded-3xl p-10 shadow-[0_0_80px_rgba(139,92,246,0.12)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-300 rounded-t-3xl" />

          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            <CheckCircle2 size={40} className="text-primary" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-white mb-3">
            Pagamento confirmado!
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Obrigado pela sua assinatura do <span className="text-white font-semibold">C4 Person Pro</span>.
            Seu acesso está ativo e você já pode usar todas as funcionalidades.
          </p>

          {/* Features reminder */}
          <div className="bg-background/60 border border-white/5 rounded-2xl p-5 mb-8 text-left space-y-2.5">
            {[
              "Tarefas e hábitos ilimitados",
              "Controle financeiro completo",
              "Notas com IA (Whisper + Llama)",
              "Sistema de metas com marcos",
              "Assistente IA personalizado",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm">
                <Zap size={14} className="text-primary flex-shrink-0" />
                <span className="text-white/80">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/C4Person"
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-semibold transition-all hover:scale-105 shadow-[0_4px_25px_rgba(139,92,246,0.4)]"
          >
            Acessar meu dashboard <ArrowRight size={18} />
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Dúvidas? Entre em contato: suporte.c4hub@gmail.com
        </p>
      </div>
    </div>
  );
}

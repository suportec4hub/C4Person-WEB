import Link from "next/link";
import { CheckCircle2, Flame, Wallet, Mic, Target, ArrowRight, Zap, Shield, Brain } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Background gradients */}
      <div className="fixed top-0 left-[30%] w-[700px] h-[700px] bg-primary/8 rounded-full blur-[140px] pointer-events-none -z-0" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent/4 rounded-full blur-[120px] pointer-events-none -z-0" />

      {/* ── HEADER ── */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(139,92,246,0.4)]">
            C4
          </div>
          <span className="font-bold text-white text-lg">C4 Person</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
          <a href="#how" className="hover:text-white transition-colors">Como funciona</a>
          <a href="#pricing" className="hover:text-white transition-colors">Preços</a>
        </nav>
        <Link
          href="/login"
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2 rounded-full text-sm font-medium transition-all"
        >
          Entrar <ArrowRight size={15} />
        </Link>
      </header>

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-24">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
          <Zap size={13} />
          Dashboard Pessoal com Inteligência Artificial
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6 max-w-4xl">
          Seu Pilar de{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-300">
            Execução Diária
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10">
          Tarefas, hábitos, finanças e reuniões com IA — tudo centralizado em um único dashboard.
          Projetado para quem precisa executar com consistência.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-semibold text-base shadow-[0_4px_30px_rgba(139,92,246,0.4)] transition-all hover:scale-105"
          >
            Começar agora — é grátis <ArrowRight size={18} />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm font-medium"
          >
            Ver funcionalidades ↓
          </a>
        </div>

        {/* App preview mockup */}
        <div className="mt-20 w-full max-w-5xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" style={{top: '60%'}} />
          <div className="bg-card border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex gap-4">
              {/* Sidebar mock */}
              <div className="w-14 bg-background/60 rounded-2xl flex flex-col items-center py-4 gap-4">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xs">C4</div>
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-primary"><CheckCircle2 size={16}/></div>
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground"><Target size={16}/></div>
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground"><Wallet size={16}/></div>
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground"><Mic size={16}/></div>
              </div>
              {/* Content mock */}
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 bg-background/60 rounded-2xl p-4 border border-white/5">
                    <div className="w-24 h-3 bg-primary/40 rounded mb-3" />
                    <div className="w-full h-2 bg-white/5 rounded mb-2" />
                    <div className="w-3/4 h-2 bg-white/5 rounded mb-2" />
                    <div className="w-1/2 h-2 bg-white/5 rounded" />
                  </div>
                  <div className="w-48 bg-background/60 rounded-2xl p-4 border border-white/5">
                    <div className="w-16 h-3 bg-orange-400/40 rounded mb-3" />
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-lg bg-white/5" />
                          <div className="flex-1 h-2 bg-white/5 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-background/60 rounded-2xl p-4 border border-white/5">
                  <div className="w-28 h-3 bg-emerald-400/40 rounded mb-3" />
                  <div className="flex gap-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex-1 bg-white/5 rounded-xl p-3">
                        <div className="w-full h-2 bg-white/5 rounded mb-2" />
                        <div className="w-2/3 h-4 bg-white/10 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative z-10 px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Funcionalidades</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white">Tudo que você precisa para executar</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: CheckCircle2,
              color: "text-primary",
              bg: "bg-primary/10 border-primary/20",
              title: "Gestão de Tarefas",
              desc: "Priorize, organize e conclua tarefas com um clique. Destaque automático do foco do dia e vínculo com suas metas.",
            },
            {
              icon: Flame,
              color: "text-orange-400",
              bg: "bg-orange-400/10 border-orange-400/20",
              title: "Hábitos com Streak",
              desc: "Construa hábitos duradouros com contador de sequência diária. Gamificação para manter a consistência.",
            },
            {
              icon: Wallet,
              color: "text-emerald-400",
              bg: "bg-emerald-400/10 border-emerald-400/20",
              title: "Controle Financeiro",
              desc: "Registre receitas e despesas com categorias. Histórico mensal, gráficos e taxa de economia em tempo real.",
            },
            {
              icon: Mic,
              color: "text-blue-400",
              bg: "bg-blue-400/10 border-blue-400/20",
              title: "Notas com IA",
              desc: "Grave reuniões e o sistema transcreve, resume e extrai tarefas automaticamente usando Groq Whisper + Llama.",
            },
            {
              icon: Target,
              color: "text-pink-400",
              bg: "bg-pink-400/10 border-pink-400/20",
              title: "Sistema de Metas",
              desc: "Defina metas com marcos e tarefas vinculadas. Acompanhe o progresso visual com barra de conclusão.",
            },
            {
              icon: Brain,
              color: "text-purple-400",
              bg: "bg-purple-400/10 border-purple-400/20",
              title: "Assistente IA",
              desc: "Converse com a IA sobre seus dados. Ela conhece suas tarefas, hábitos e finanças e dá insights personalizados.",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-card border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-all group">
              <div className={`w-11 h-11 rounded-xl border ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={22} className={color} />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="relative z-10 px-6 py-24 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Como funciona</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-16">Em 3 passos simples</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Crie sua conta", desc: "Cadastro rápido com e-mail e senha. Seus dados ficam seguros e isolados." },
              { step: "02", title: "Configure seu espaço", desc: "Adicione tarefas, hábitos e metas. O dashboard se adapta à sua rotina." },
              { step: "03", title: "Execute e evolua", desc: "Use o assistente IA, grave reuniões e acompanhe seu progresso diariamente." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative z-10 px-6 py-24 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Planos</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white">Simples e transparente</h2>
        </div>

        <div className="max-w-sm mx-auto">
          <div className="bg-card border border-primary/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-300 rounded-t-3xl" />
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-6">
              <Zap size={12} /> Em breve
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">C4 Person Pro</h3>
            <p className="text-muted-foreground text-sm mb-6">Acesso completo a todas as funcionalidades</p>
            <div className="flex items-end gap-2 mb-8">
              <span className="text-5xl font-black text-white">R$?</span>
              <span className="text-muted-foreground text-sm mb-2">/mês</span>
            </div>
            <div className="space-y-3 mb-8">
              {["Tarefas e hábitos ilimitados", "Controle financeiro completo", "Notas com IA (Whisper + Llama)", "Sistema de metas com marcos", "Assistente IA personalizado", "Suporte prioritário"].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 size={16} className="text-accent flex-shrink-0" />
                  <span className="text-white/80">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="block w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-semibold text-center transition-all shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
            >
              Criar conta grátis
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <Shield size={40} className="text-primary mx-auto mb-6 opacity-60" />
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Pronto para executar melhor?
          </h2>
          <p className="text-muted-foreground mb-8">
            Junte-se a quem já usa o C4 Person para organizar a vida e alcançar resultados.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-full font-semibold shadow-[0_4px_30px_rgba(139,92,246,0.4)] transition-all hover:scale-105"
          >
            Começar agora <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 px-8 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xs">C4</div>
          <span className="font-semibold text-white text-sm">C4 Person</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2025 C4 Person. Todos os direitos reservados.</p>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <a href="#" className="hover:text-white transition-colors">Privacidade</a>
          <a href="#" className="hover:text-white transition-colors">Termos</a>
          <Link href="/login" className="hover:text-white transition-colors">Entrar</Link>
        </div>
      </footer>
    </div>
  );
}

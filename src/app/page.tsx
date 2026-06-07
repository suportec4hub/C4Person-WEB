import Link from "next/link";
import {
  CheckCircle2, Flame, Wallet, Mic, Target, ArrowRight, Zap, Shield, Brain,
  Star, X, Clock, TrendingUp, Check, Smartphone, Lock, ChevronDown, Users,
  BarChart3, Quote, Layers,
} from "lucide-react";
import { CheckoutButton } from "@/components/CheckoutButton";

/* ── tiny helpers ── */
const Rating = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => <Star key={i} size={13} className="fill-amber-400 text-amber-400" />)}
  </div>
);

const FEATURES = [
  {
    icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10 border-primary/20",
    benefit: "Nunca mais esqueça o que importa",
    title: "Gestão de Tarefas Inteligente",
    desc: "Priorize, organize e conclua tarefas com um clique. Foco automático no que é urgente e vínculo direto com suas metas.",
  },
  {
    icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20",
    benefit: "Hábitos que duram anos, não dias",
    title: "Streak de Hábitos com Heatmap",
    desc: "Contador de sequência diária e mapa visual de consistência (estilo GitHub). Gamificação que faz a disciplina acontecer.",
  },
  {
    icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",
    benefit: "Saiba exatamente onde vai cada real",
    title: "Controle Financeiro Completo",
    desc: "Receitas, despesas, gráficos mensais e taxa de economia em tempo real. Nunca mais chegar ao fim do mês sem saber o saldo.",
  },
  {
    icon: Mic, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20",
    benefit: "Reuniões viram tarefas em segundos",
    title: "Notas com IA (Whisper + Llama)",
    desc: "Grave uma reunião, o sistema transcreve, resume e extrai os próximos passos automaticamente. Zero esforço manual.",
  },
  {
    icon: Target, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20",
    benefit: "Metas que saem do papel de verdade",
    title: "Sistema de Metas com Marcos",
    desc: "Defina objetivos com sub-metas e tarefas vinculadas. Barra de progresso visual que mostra exatamente onde você está.",
  },
  {
    icon: Brain, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20",
    benefit: "Um assistente que conhece sua vida",
    title: "IA Personalizada com Seus Dados",
    desc: "Converse com a IA sobre suas tarefas, hábitos e finanças. Ela conhece tudo e dá insights que apps genéricos jamais dariam.",
  },
];

const TESTIMONIALS = [
  {
    initials: "MA", gradient: "from-violet-500 to-purple-600",
    name: "Marco Aurélio", role: "Empreendedor",
    text: "Antes usava Notion, Todoist e planilha financeira. Agora uso só o C4Person. A diferença foi imediata — sei exatamente o que fazer a cada hora do dia.",
  },
  {
    initials: "JF", gradient: "from-emerald-500 to-teal-600",
    name: "Juliana Ferreira", role: "Freelancer de Design",
    text: "Gravar reuniões e ter as tarefas criadas automaticamente pela IA mudou meu negócio. Antes eu esquecia metade do combinado. Agora tudo vira ação.",
  },
  {
    initials: "RS", gradient: "from-blue-500 to-cyan-600",
    name: "Rodrigo Santos", role: "Gerente de Marketing",
    text: "R$15,90 é menos que um café por semana. E entrega tarefas, metas, financeiro e IA integrados. Não existe nada parecido nesse preço.",
  },
];

const PAIN_POINTS = [
  { icon: "📋", text: "Tarefas espalhadas entre WhatsApp, post-it e planilha — e você esquece metade" },
  { icon: "🔥", text: "Tenta criar um hábito e abandona na segunda semana" },
  { icon: "💸", text: "Fim do mês sem saber onde foi o dinheiro" },
  { icon: "🎙️", text: "Reuniões sem registro = próximos passos que desaparecem" },
  { icon: "🎯", text: "Metas que existem só na sua cabeça" },
  { icon: "⏰", text: "Sensação de estar ocupado sem progresso real" },
];

const COMPARISON_C4 = [
  "Tarefas + Hábitos + Finanças + IA em um app",
  "IA que conhece todos os seus dados",
  "PWA: instala no iPhone e Android",
  "15 dias grátis, sem cartão de crédito",
  "R$15,90/mês — tudo incluso",
];

const COMPARISON_OTHERS = [
  "5+ apps diferentes para gerenciar",
  "IA genérica sem contexto pessoal",
  "Cada app com sua própria assinatura",
  "Trials que pedem cartão imediatamente",
  "R$150+/mês somando todas as ferramentas",
];

const FAQ_ITEMS = [
  {
    q: "Preciso de cartão de crédito para os 15 dias grátis?",
    a: "Não. Você cria sua conta com e-mail e senha e já começa a usar. Cartão de crédito só é necessário se você decidir continuar após o trial.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem multa, sem burocracia, sem ligação de retenção. Um clique na sua área de perfil e a assinatura é cancelada imediatamente.",
  },
  {
    q: "O app funciona no celular?",
    a: "Sim! O C4Person é um PWA (Progressive Web App). Você pode instalar no iPhone e Android diretamente pelo navegador — sem passar pela App Store ou Google Play — e funciona até offline.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Totalmente. Usamos Supabase com infraestrutura enterprise, Row Level Security e criptografia em trânsito e em repouso. Só você acessa seus dados.",
  },
  {
    q: "Qual a diferença do C4Person para o Notion ou Todoist?",
    a: "O Notion é uma ferramenta em branco que você constrói do zero. O Todoist só faz tarefas. O C4Person é um sistema completo e pronto — com IA integrada aos seus dados pessoais, controle financeiro, hábitos e metas juntos. É a diferença entre construir uma casa e se mudar para uma pronta.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Ambient gradients ── */}
      <div className="fixed top-[-10%] left-[20%] w-[700px] h-[700px] bg-primary/6 rounded-full blur-[160px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-accent/3 rounded-full blur-[140px] pointer-events-none -z-0" />

      {/* ── Announcement bar ── */}
      <div className="relative z-50 bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center">
        <p className="text-sm text-primary font-medium">
          <span className="font-bold">🎁 15 dias completamente grátis</span>
          {" "}— sem cartão de crédito.{" "}
          <Link href="/login" className="underline underline-offset-2 hover:text-purple-300 transition-colors">
            Começar agora →
          </Link>
        </p>
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-40 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-sm shadow-[0_0_18px_rgba(139,92,246,0.5)]">
            C4
          </div>
          <span className="font-bold text-white text-lg tracking-tight">C4Person</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-white transition-colors">Preços</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-white transition-colors hidden sm:block">
            Entrar
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-[0_2px_20px_rgba(139,92,246,0.35)] transition-all hover:scale-105"
          >
            Grátis por 15 dias <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── HERO ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16 md:pt-28 md:pb-24 max-w-6xl mx-auto">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
          <Zap size={12} />
          Assistente IA integrado aos seus dados pessoais
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6 max-w-4xl">
          Pare de gerenciar apps.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-purple-300">
            Comece a entregar resultados.
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-4">
          C4Person reúne <strong className="text-white/80">tarefas, hábitos, finanças, metas e IA</strong> em um único dashboard.
          Para quem quer executar com consistência — sem perder tempo trocando de ferramenta.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold text-base shadow-[0_6px_40px_rgba(139,92,246,0.45)] transition-all hover:scale-105 hover:shadow-[0_8px_50px_rgba(139,92,246,0.55)]"
          >
            Começar 15 dias grátis <ArrowRight size={18} />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm font-medium"
          >
            Ver como funciona <ChevronDown size={15} />
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-xs text-muted-foreground mb-12">
          <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> Sem cartão de crédito</span>
          <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> Cancele quando quiser</span>
          <span className="flex items-center gap-1.5"><Check size={13} className="text-accent" /> 15 dias completamente grátis</span>
          <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-accent" /> Funciona no iPhone e Android</span>
        </div>

        {/* Social proof avatars */}
        <div className="flex items-center gap-3 mb-16">
          <div className="flex -space-x-2">
            {[
              { g: "from-violet-500 to-purple-600", t: "MA" },
              { g: "from-emerald-500 to-teal-600",  t: "JF" },
              { g: "from-blue-500 to-cyan-600",     t: "RS" },
              { g: "from-rose-500 to-pink-600",     t: "AL" },
              { g: "from-amber-500 to-orange-600",  t: "CB" },
            ].map(({ g, t }) => (
              <div key={t} className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} flex items-center justify-center text-white text-[10px] font-bold border-2 border-background ring-0`}>{t}</div>
            ))}
          </div>
          <div className="text-left">
            <Rating />
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="text-white font-semibold">+500 pessoas</span> já organizam a vida com C4Person
            </p>
          </div>
        </div>

        {/* App mockup */}
        <div className="w-full max-w-5xl mx-auto relative">
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl pointer-events-none" />
          <div className="relative bg-card border border-white/10 rounded-3xl p-5 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
            {/* Top bar */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/40" />
                <div className="w-3 h-3 rounded-full bg-amber-500/40" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white/5 rounded-lg px-8 py-1 text-[10px] text-muted-foreground">c4person.com.br</div>
              </div>
            </div>
            {/* Dashboard layout */}
            <div className="flex gap-4">
              {/* Sidebar */}
              <div className="w-12 bg-background/60 rounded-2xl flex flex-col items-center py-4 gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-black text-[10px]">C4</div>
                {[CheckCircle2, Target, Wallet, Mic, BarChart3].map((Icon, i) => (
                  <div key={i} className={`w-8 h-8 rounded-xl flex items-center justify-center ${i === 0 ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"}`}>
                    <Icon size={14} />
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 space-y-3 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="w-32 h-3 bg-white/5 rounded mb-1" />
                    <div className="w-20 h-5 bg-white/10 rounded" />
                  </div>
                  <div className="w-28 h-8 bg-primary/20 border border-primary/30 rounded-xl" />
                </div>
                {/* Cards row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { color: "bg-primary/10 border-primary/20", label: "bg-primary/40", val: "bg-white/15", w: "w-16" },
                    { color: "bg-emerald-500/10 border-emerald-500/20", label: "bg-emerald-400/40", val: "bg-white/15", w: "w-12" },
                    { color: "bg-orange-500/10 border-orange-500/20", label: "bg-orange-400/40", val: "bg-white/15", w: "w-14" },
                  ].map(({ color, label, val, w }, i) => (
                    <div key={i} className={`bg-card border ${color} rounded-2xl p-3`}>
                      <div className={`h-2 ${label} rounded mb-2 ${w}`} />
                      <div className={`h-5 ${val} rounded mb-1 w-20`} />
                      <div className={`h-1.5 ${val} rounded w-12`} />
                    </div>
                  ))}
                </div>
                {/* Task list */}
                <div className="bg-card border border-white/8 rounded-2xl p-3">
                  <div className="w-20 h-2.5 bg-primary/30 rounded mb-3" />
                  <div className="space-y-2">
                    {[
                      { done: true,  priority: "bg-red-400",    w: "w-32" },
                      { done: false, priority: "bg-amber-400",  w: "w-48" },
                      { done: false, priority: "bg-emerald-400",w: "w-40" },
                    ].map(({ done, priority, w }, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center ${done ? "bg-primary" : "border border-white/15"}`}>
                          {done && <Check size={9} className="text-white" />}
                        </div>
                        <div className={`flex-1 h-2 bg-white/5 rounded ${done ? "opacity-40" : ""}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${priority}`} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Habit heatmap mini */}
                <div className="bg-card border border-white/8 rounded-2xl p-3">
                  <div className="w-24 h-2.5 bg-orange-400/30 rounded mb-3" />
                  <div className="flex gap-1 flex-wrap">
                    {[...Array(28)].map((_, i) => (
                      <div key={i} className={`w-3.5 h-3.5 rounded-sm ${
                        [2,3,4,5,7,8,9,10,12,13,14,15,16,17,18,19,20,21,24,25,26,27].includes(i)
                          ? "bg-orange-400/70" : "bg-white/5"
                      }`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── STATS STRIP ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { icon: Users,       value: "+500",     label: "usuários ativos" },
            { icon: Star,        value: "4.9★",     label: "avaliação média" },
            { icon: TrendingUp,  value: "95%",      label: "renovam todo mês" },
            { icon: Clock,       value: "2h/dia",   label: "economizadas em média" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon size={18} className="text-primary opacity-70" />
              <p className="text-2xl md:text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── PAIN SECTION ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-3">O problema</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Se você está aqui,<br className="hidden md:block" /> provavelmente vive assim:
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Reconheceu alguma? A maioria das pessoas tenta resolver cada um com um app diferente. Spoiler: não funciona.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAIN_POINTS.map(({ icon, text }) => (
            <div key={text} className="bg-card border border-white/8 rounded-2xl p-5 flex items-start gap-3 group hover:border-red-500/20 transition-all">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <p className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">{text}</p>
            </div>
          ))}
        </div>

        {/* Bridge */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-primary/10 border border-primary/20 rounded-2xl px-8 py-5">
            <p className="text-lg md:text-xl font-semibold text-white mb-1">
              E se tudo isso estivesse resolvido em <span className="text-primary">um único lugar</span>?
            </p>
            <p className="text-sm text-muted-foreground">É exatamente isso que o C4Person faz.</p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── FEATURES ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 px-6 py-24 bg-white/[0.015] border-y border-white/5 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">O que você ganha</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white">
              Seis problemas resolvidos.<br className="hidden md:block" /> Uma só assinatura.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, color, bg, benefit, title, desc }) => (
              <div key={title} className="bg-card border border-white/8 rounded-2xl p-6 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all group flex flex-col">
                <div className={`w-11 h-11 rounded-xl border ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <Icon size={20} className={color} />
                </div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${color}`}>{benefit}</p>
                <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── TESTIMONIALS ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-3">Depoimentos</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white">
            Quem já usa não<br className="hidden md:block" /> volta para o caos de antes
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(({ initials, gradient, name, role, text }) => (
            <div key={name} className="bg-card border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/15 transition-all">
              <Quote size={24} className="text-primary/40" />
              <p className="text-sm text-white/80 leading-relaxed flex-1">&ldquo;{text}&rdquo;</p>
              <div>
                <Rating />
                <div className="flex items-center gap-3 mt-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── COMPARISON ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.015] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-3">Comparação</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white">
              C4Person vs a abordagem tradicional
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* C4Person */}
            <div className="bg-card border border-primary/30 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.1)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-300 rounded-t-2xl" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-sm">C4</div>
                <div>
                  <p className="font-bold text-white">C4Person</p>
                  <p className="text-xs text-primary font-semibold">Recomendado</p>
                </div>
              </div>
              <div className="space-y-3">
                {COMPARISON_C4.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Check size={16} className="text-accent mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/90">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/8 flex items-end gap-2">
                <span className="text-3xl font-black text-white">R$15,90</span>
                <span className="text-muted-foreground text-sm mb-1">/mês</span>
              </div>
            </div>

            {/* Others */}
            <div className="bg-card border border-white/8 rounded-2xl p-6 opacity-70">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <Layers size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-white/70">Apps separados</p>
                  <p className="text-xs text-red-400 font-semibold">Não recomendado</p>
                </div>
              </div>
              <div className="space-y-3">
                {COMPARISON_OTHERS.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <X size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/50">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/8 flex items-end gap-2">
                <span className="text-3xl font-black text-white/50">R$150+</span>
                <span className="text-muted-foreground text-sm mb-1 opacity-50">/mês</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── HOW IT WORKS ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="how" className="relative z-10 px-6 py-24 max-w-5xl mx-auto scroll-mt-20">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Como funciona</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white">Três passos. Dez minutos. Vida organizada.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* connector line desktop */}
          <div className="absolute top-7 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 hidden md:block" />
          {[
            {
              step: "01", icon: Lock, color: "text-primary", bg: "bg-primary/10 border-primary/20",
              title: "Crie sua conta em 30s",
              desc: "E-mail e senha. Sem formulário longo, sem cartão. Você já entra com 15 dias de acesso total.",
            },
            {
              step: "02", icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20",
              title: "Configure em minutos",
              desc: "Adicione suas tarefas, hábitos e a primeira meta. A IA já começa a aprender sua rotina.",
            },
            {
              step: "03", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",
              title: "Execute e veja a evolução",
              desc: "Use o assistente IA, grave reuniões, controle financeiro e acompanhe hábitos — tudo em um lugar.",
            },
          ].map(({ step, icon: Icon, color, bg, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center relative">
              <div className={`w-14 h-14 rounded-2xl border ${bg} flex items-center justify-center mb-4 relative z-10 bg-background`}>
                <Icon size={22} className={color} />
              </div>
              <span className="text-xs text-muted-foreground font-mono mb-2">PASSO {step}</span>
              <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── PRICING ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 px-6 py-24 bg-white/[0.015] border-y border-white/5 scroll-mt-20">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Preço</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">Simples. Justo. Acessível.</h2>
            <p className="text-muted-foreground">Menos que um café por semana. Sem surpresas na fatura.</p>
          </div>

          <div className="bg-card border border-primary/35 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.18)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-400 to-purple-300 rounded-t-3xl" />

            {/* Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
                <Zap size={11} /> Preço de lançamento
              </div>
              <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Clock size={11} /> Garantido para novos usuários
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">C4Person Pro</h3>
            <p className="text-muted-foreground text-sm mb-6">Acesso completo. Sem limites. Sem surpresas.</p>

            {/* Price */}
            <div className="flex items-end gap-2 mb-2">
              <span className="text-6xl font-black text-white tracking-tight">R$15,90</span>
              <span className="text-muted-foreground text-sm mb-2">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mb-8">≈ R$0,53 por dia · Menos que um café por semana</p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {[
                "Tarefas e hábitos ilimitados",
                "Controle financeiro completo com gráficos",
                "Notas com IA — Whisper + Llama (Groq)",
                "Sistema de metas com marcos e progresso",
                "Assistente IA com seus dados pessoais",
                "PWA — instala no iPhone e Android",
                "Suporte prioritário por e-mail",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 size={16} className="text-accent flex-shrink-0" />
                  <span className="text-white/85">{f}</span>
                </div>
              ))}
            </div>

            {/* Trial CTA */}
            <Link
              href="/login"
              className="block w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-center text-base shadow-[0_4px_30px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_6px_40px_rgba(139,92,246,0.5)] mb-3"
            >
              Começar 15 dias grátis — sem cartão
            </Link>
            <CheckoutButton className="block w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-xl font-semibold text-center text-sm transition-all">
              Já tenho conta — Assinar R$15,90/mês
            </CheckoutButton>

            {/* Guarantees */}
            <div className="flex flex-wrap justify-center gap-4 mt-6 pt-5 border-t border-white/8">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Shield size={12} className="text-accent" /> Dados criptografados</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={12} className="text-accent" /> Cancele quando quiser</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap size={12} className="text-accent" /> 15 dias grátis</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── FAQ ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 px-6 py-24 max-w-3xl mx-auto scroll-mt-20">
        <div className="text-center mb-14">
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-3">Dúvidas</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Perguntas frequentes</h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details key={q} className="group bg-card border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors">
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none text-white font-medium text-sm gap-3">
                <span>{q}</span>
                <ChevronDown size={16} className="text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5">
                <p className="text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-4">{a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── FINAL CTA ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.015] border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          {/* Glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />

          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <Zap size={12} />
            Comece agora, decida depois
          </div>

          <h2 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
            Sua vida organizada<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-purple-300">
              começa com um clique
            </span>
          </h2>

          <p className="text-muted-foreground mb-8 text-lg leading-relaxed max-w-lg mx-auto">
            15 dias completamente grátis. Sem cartão de crédito. Se não mudar nada na sua rotina, você não paga nada.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/login"
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-full font-bold text-lg shadow-[0_8px_50px_rgba(139,92,246,0.5)] transition-all hover:scale-105"
            >
              Começar grátis agora <ArrowRight size={20} />
            </Link>
          </div>

          {/* Final trust */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" />Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" />15 dias grátis</span>
            <span className="flex items-center gap-1.5"><Check size={12} className="text-accent" />Cancele a qualquer momento</span>
            <span className="flex items-center gap-1.5"><Shield size={12} className="text-accent" />Dados 100% seguros</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* ── FOOTER ── */}
      {/* ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 px-8 py-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xs shadow-[0_0_12px_rgba(139,92,246,0.4)]">C4</div>
            <div>
              <p className="font-bold text-white text-sm leading-none">C4Person</p>
              <p className="text-xs text-muted-foreground mt-0.5">Seu pilar de execução diária</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground order-last md:order-none">
            © {new Date().getFullYear()} C4Person · Todos os direitos reservados
          </p>

          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Termos</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/login" className="hover:text-white transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

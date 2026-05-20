# C4 Person — Seu Pilar de Execução Diária

Dashboard pessoal de produtividade com gerenciamento de tarefas, hábitos, finanças e anotações com IA. Desenvolvido com Next.js, Supabase e OpenAI.

---

## Visão Geral

O **C4 Person** centraliza os pilares essenciais da rotina em uma única interface: o que você precisa fazer hoje, os hábitos que está construindo, como estão suas finanças e o que foi discutido nas suas reuniões. Tudo em tempo real, com design escuro e minimalista.

---

## Funcionalidades

### Tarefas
- Criação de tarefas com título e horário opcional
- Marcação de prioridade (`alta` / `normal`)
- Conclusão com um clique — a tarefa de maior prioridade fica em destaque no topo
- Estado persistido no Supabase com atualizações otimistas na UI

### Hábitos
- Cadastro de hábitos diários
- Contador de sequência (streak) — incrementado automaticamente ao marcar o hábito do dia
- Reset diário automático via `is_completed_today`

### Finanças
- Registro de receitas e despesas com nome, valor e data
- Cálculo automático de saldo total, total de entradas e total de saídas
- Listagem das últimas 4 transações no painel

### Anotações com IA
- Gravação de áudio diretamente no navegador (WebM)
- Transcrição automática via **OpenAI Whisper** (idioma: português)
- Resumo inteligente com extração de pontos-chave e itens de ação via **GPT-4o-mini**
- Transcrição e resumo salvos no Supabase como nota

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Animações | Framer Motion |
| Ícones | Lucide React |
| Backend / Banco de dados | Supabase (PostgreSQL) |
| IA — Transcrição | OpenAI Whisper-1 |
| IA — Resumo | OpenAI GPT-4o-mini |
| Datas | date-fns (locale pt-BR) |
| Linguagem | TypeScript 5 |

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts          # Chat com IA sobre os dados do usuário
│   │   └── process-audio/
│   │       └── route.ts          # Transcrição e resumo de reunião (Whisper + GPT)
│   ├── goals/
│   │   └── page.tsx              # Nexus — Metas e marcos de progresso
│   ├── layout.tsx                # Layout raiz com Sidebar compartilhada
│   ├── page.tsx                  # Dashboard principal
│   └── globals.css               # Tema escuro, variáveis CSS, glassmorphism
├── components/
│   └── Sidebar.tsx               # Navegação lateral compartilhada
└── lib/
    └── supabase.ts               # Inicialização do client Supabase
```

---

## Banco de Dados (Supabase)

Execute as queries abaixo no **SQL Editor** do seu projeto Supabase para criar as tabelas necessárias.

### `tasks`
```sql
create table tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  time       text,
  is_done    boolean not null default false,
  priority   text not null default 'normal',
  created_at timestamptz not null default now()
);
```

### `habits`
```sql
create table habits (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  streak               integer not null default 0,
  is_completed_today   boolean not null default false,
  created_at           timestamptz not null default now()
);
```

### `transactions`
```sql
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  amount           numeric(12, 2) not null,
  type             text not null check (type in ('in', 'out')),
  transaction_date timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
```

### `notes`
```sql
create table notes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  transcription  text,
  summary        text,
  created_at     timestamptz not null default now()
);
```

### `goals`
```sql
create table goals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  target_date date,
  color       text not null default '#8b5cf6',
  created_at  timestamptz not null default now()
);
```

### `milestones`
```sql
create table milestones (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid references goals(id) on delete cascade,
  title      text not null,
  is_done    boolean not null default false,
  created_at timestamptz not null default now()
);
```

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Supabase — obtenha em: Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key

# OpenAI — obtenha em: platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
```

> **Atenção:** `OPENAI_API_KEY` é usada apenas no servidor (API Route) e nunca é exposta ao navegador.

---

## Instalação e Execução

### Pré-requisitos
- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- Conta na [OpenAI](https://platform.openai.com)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/suportec4hub/c4person-web.git
cd c4person-web

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# edite .env.local com suas chaves

# 4. Crie as tabelas no Supabase
# (execute os SQLs da seção "Banco de Dados" acima)

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## API Routes

### `POST /api/process-audio`

Recebe um arquivo de áudio gravado no navegador, transcreve e gera um resumo.

**Request:** `multipart/form-data`

| Campo | Tipo | Descrição |
|---|---|---|
| `audio` | `File` (webm) | Áudio gravado pelo MediaRecorder |

**Response:** `application/json`

```json
{
  "transcription": "Texto completo transcrito do áudio...",
  "summary": "## Resumo\n- Ponto 1\n- Ponto 2\n\n## Ações\n- [ ] Tarefa identificada"
}
```

**Fluxo interno:**
1. Recebe o blob webm via FormData
2. Envia para **Whisper-1** com `language: "pt"` para transcrição
3. Envia a transcrição para **GPT-4o-mini** para gerar um resumo estruturado em Markdown com pontos-chave e itens de ação
4. Retorna ambos como JSON

---

## Design

O C4 Person usa um tema escuro com glassmorphism, baseado nas seguintes variáveis CSS:

| Variável | Valor | Uso |
|---|---|---|
| `--background` | `#09090b` | Fundo principal |
| `--primary` | `#8b5cf6` | Roxo — ações principais |
| `--accent` | `#10b981` | Verde esmeralda — confirmações |
| `--secondary` | `#27272a` | Cinza escuro — cards e bordas |

Cards utilizam a classe `.glass-card` — `backdrop-filter: blur` com borda sutil — para criar profundidade visual sem peso visual.

---

## Deploy

A forma mais simples é usar a [Vercel](https://vercel.com):

1. Importe o repositório na Vercel
2. Adicione as três variáveis de ambiente no painel da Vercel
3. Deploy automático a cada push na branch `main`

Para outras plataformas, execute:

```bash
npm run build
npm start
```

---

## Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.

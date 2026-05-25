"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CheckSquare, Target, Wallet, FileText, Flame, ArrowRight } from "lucide-react";

interface SearchResult {
  id: string;
  type: "task" | "goal" | "transaction" | "note" | "habit";
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_CONFIG = {
  task:        { icon: CheckSquare, label: "Tarefa",     color: "text-primary",   href: "/C4Person" },
  goal:        { icon: Target,      label: "Meta",       color: "text-purple-400", href: "/C4Person/goals" },
  transaction: { icon: Wallet,      label: "Transação",  color: "text-accent",    href: "/C4Person/finance" },
  note:        { icon: FileText,    label: "Nota",       color: "text-yellow-400", href: "/C4Person/notes" },
  habit:       { icon: Flame,       label: "Hábito",     color: "text-orange-400", href: "/C4Person" },
};

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const term = `%${q}%`;

    const [tasks, goals, transactions, notes, habits] = await Promise.all([
      supabase.from("tasks").select("id,title,priority").ilike("title", term).limit(4),
      supabase.from("goals").select("id,title,description").ilike("title", term).limit(4),
      supabase.from("transactions").select("id,description,amount,type").ilike("description", term).limit(4),
      supabase.from("notes").select("id,title,summary").ilike("title", term).limit(4),
      supabase.from("habits").select("id,name").ilike("name", term).limit(4),
    ]);

    const items: SearchResult[] = [
      ...(tasks.data ?? []).map(t => ({
        id: t.id, type: "task" as const,
        title: t.title,
        subtitle: t.priority === "alta" ? "Prioridade alta" : undefined,
        href: "/C4Person",
      })),
      ...(goals.data ?? []).map(g => ({
        id: g.id, type: "goal" as const,
        title: g.title,
        subtitle: g.description ?? undefined,
        href: "/C4Person/goals",
      })),
      ...(transactions.data ?? []).map(tr => ({
        id: tr.id, type: "transaction" as const,
        title: tr.description,
        subtitle: `${tr.type === "income" ? "+" : "-"} R$ ${Number(tr.amount).toFixed(2)}`,
        href: "/C4Person/finance",
      })),
      ...(notes.data ?? []).map(n => ({
        id: n.id, type: "note" as const,
        title: n.title,
        subtitle: n.summary?.slice(0, 60) ?? undefined,
        href: "/C4Person/notes",
      })),
      ...(habits.data ?? []).map(h => ({
        id: h.id, type: "habit" as const,
        title: h.name,
        href: "/C4Person",
      })),
    ];

    setResults(items);
    setSelected(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  const navigate = (item: SearchResult) => {
    router.push(item.href);
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown")  { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")    { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected]);
    if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
              <Search size={18} className="text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar tarefas, metas, finanças, notas…"
                className="flex-1 bg-transparent text-white placeholder:text-muted-foreground outline-none text-sm"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-white transition-colors">
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-white/10 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {!query && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Digite para buscar em todo o seu conteúdo
                </p>
              )}
              {query && loading && (
                <p className="text-sm text-muted-foreground text-center py-8">Buscando…</p>
              )}
              {query && !loading && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum resultado para &ldquo;{query}&rdquo;
                </p>
              )}
              {results.length > 0 && (
                <ul className="py-2">
                  {results.map((item, i) => {
                    const cfg = TYPE_CONFIG[item.type];
                    const Icon = cfg.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => navigate(item)}
                          onMouseEnter={() => setSelected(i)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            selected === i ? "bg-white/5" : "hover:bg-white/3"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            {cfg.label}
                          </span>
                          {selected === i && <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span><kbd className="font-mono">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono">Enter</kbd> abrir</span>
              <span><kbd className="font-mono">Esc</kbd> fechar</span>
              <span className="ml-auto">Cmd+K para abrir</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

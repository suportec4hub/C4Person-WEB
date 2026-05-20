"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Search, Trash2, X, Mic, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface Note {
  id: string;
  title: string;
  transcription: string | null;
  summary: string | null;
  created_at: string;
}

export default function NotesPage() {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Note | null>(null);
  const [expandedTranscription, setExpandedTranscription] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setNotes(data as Note[]); });
  }, []);

  const filtered = useMemo(() =>
    notes.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.summary?.toLowerCase().includes(search.toLowerCase()) ||
      n.transcription?.toLowerCase().includes(search.toLowerCase())
    ), [notes, search]);

  const deleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) setSelected(null);
    await supabase.from("notes").delete().eq("id", id);
  };

  const openNote = (note: Note) => {
    setSelected(note);
    setExpandedTranscription(false);
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-10 flex justify-between items-end"
      >
        <div>
          <h2 className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">Anotar</h2>
          <h1 className="text-4xl font-bold tracking-tight">Notas & Reuniões</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {notes.length} nota{notes.length !== 1 ? "s" : ""} gravada{notes.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 w-72">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar em notas e transcrições…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </motion.header>

      {/* Empty state */}
      {notes.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Mic size={32} className="text-primary/50" />
          </div>
          <h3 className="text-xl font-semibold text-white/80 mb-2">Nenhuma nota ainda</h3>
          <p className="text-muted-foreground text-sm">
            Grave uma reunião ou nota de voz no Dashboard para começar.
          </p>
        </motion.div>
      )}

      {/* No search results */}
      {notes.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-12">
          Nenhuma nota corresponde à busca.
        </p>
      )}

      {/* Notes grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 flex flex-col gap-3 group cursor-pointer hover:border-white/15 transition-all relative"
              onClick={() => openNote(note)}
            >
              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 z-10"
              >
                <Trash2 size={15} />
              </button>

              {/* Icon + Title */}
              <div className="flex items-start gap-3 pr-6">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mic size={17} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">{note.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(note.created_at), "d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Summary preview */}
              {note.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 pl-12">
                  {note.summary.replace(/#+\s*/g, "").replace(/\n/g, " ").trim()}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-3 pl-12 mt-auto pt-1 border-t border-white/5">
                {note.transcription && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText size={11} />
                    {Math.round(note.transcription.split(" ").length)} palavras
                  </span>
                )}
                <span className="text-xs text-primary ml-auto">Ver nota →</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Note detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[85vh]"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between p-7 pb-4 border-b border-white/10">
                <div className="flex items-start gap-3 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Mic size={19} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white leading-snug">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(selected.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => deleteNote(selected.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1.5"
                    title="Excluir nota"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-white transition-colors p-1.5"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto px-7 py-5 space-y-5 custom-scrollbar">
                {/* Summary */}
                {selected.summary && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                      <PenTool size={15} />
                      Resumo da IA
                    </h3>
                    <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                      {selected.summary}
                    </div>
                  </div>
                )}

                {/* Transcription (collapsible) */}
                {selected.transcription && (
                  <div className="border border-white/8 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedTranscription(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FileText size={15} />
                        Transcrição Completa
                        <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">
                          {selected.transcription.split(" ").length} palavras
                        </span>
                      </span>
                      {expandedTranscription
                        ? <ChevronUp size={16} className="text-muted-foreground" />
                        : <ChevronDown size={16} className="text-muted-foreground" />}
                    </button>
                    {expandedTranscription && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <p className="text-sm text-white/70 leading-relaxed italic pt-3">
                          &ldquo;{selected.transcription}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "../components/editor";
import Flashcards from "../components/flashcards";
import History from "../components/history";
import Quiz from "../components/quiz";
import UploadCard from "../components/upload-card";
import { card } from "../components/ui";
import { MAX_SAVED, downloadBackup, loadHistory, newId, parseBackup, saveHistory } from "../lib/history";
import type { Saved } from "../lib/history";
import type { Question } from "../lib/types";

const MODES = [
  { id: "quiz", label: "Quiz" },
  { id: "flash", label: "Flashcards" },
  { id: "edit", label: "Edit questions" },
] as const;

export default function Home() {
  const [items, setItems] = useState<Question[]>([]);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("quiz");
  const studyRef = useRef<HTMLElement>(null);
  const [session, setSession] = useState(0); // changes whenever a different reviewer is opened, so the quiz restarts
  const [history, setHistory] = useState<Saved[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState<{ msg: string; error?: boolean }>({ msg: "" });

  // Read saved reviewers after the page loads (browser storage isn't available on the server).
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  function persist(next: Saved[]) {
    setHistory(next);
    if (!saveHistory(next)) setNote({ msg: "Couldn’t save to this browser (storage is full or blocked). Use Back up to keep your reviewers.", error: true });
  }

  function show(next: Question[]) {
    setItems(next);
    setSession((n) => n + 1);
    setStarted(true);
    setMode("quiz");
    requestAnimationFrame(() => studyRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  // A new reviewer was made: save it, then open it.
  function ready(next: Question[], title: string) {
    const entry: Saved = { id: newId(), title, createdAt: Date.now(), items: next };
    setNote({ msg: "" });
    persist([entry, ...history].slice(0, MAX_SAVED));
    setActiveId(entry.id);
    show(next);
  }

  function open(entry: Saved) {
    setActiveId(entry.id);
    setNote({ msg: "" });
    show(entry.items);
  }

  // Removing questions in the editor updates the saved copy too.
  function updateItems(next: Question[]) {
    setItems(next);
    if (activeId) persist(history.map((h) => (h.id === activeId && next.length > 0 ? { ...h, items: next } : h)));
  }

  function remove(id: string) {
    persist(history.filter((h) => h.id !== id));
    if (id === activeId) setActiveId(null);
  }

  async function restore(file: File) {
    try {
      const incoming = parseBackup(await file.text());
      const have = new Set(history.map((h) => h.id));
      const fresh = incoming.filter((h) => !have.has(h.id));
      persist([...history, ...fresh].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_SAVED));
      setNote({ msg: fresh.length ? `Restored ${fresh.length} reviewer${fresh.length === 1 ? "" : "s"}.` : "Those reviewers were already here." });
    } catch (error) {
      setNote({ msg: error instanceof Error ? error.message : "Couldn’t read that file.", error: true });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-20">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 transition-transform duration-700 hover:rotate-[360deg]">
          <defs>
            <radialGradient id="planet" cx="35%" cy="35%" r="75%">
              <stop offset="0" stopColor="#c4b5fd" />
              <stop offset="1" stopColor="#6d28d9" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="6.5" fill="url(#planet)" />
          <ellipse cx="16" cy="16" rx="14" ry="5.5" fill="none" stroke="#a78bfa" strokeWidth="1.4" transform="rotate(-24 16 16)" />
          <circle cx="27" cy="9.5" r="2" fill="#7dd3fc" />
        </svg>
        <span className="text-lg font-semibold text-bright">Reviewer Maker</span>
      </div>

      <h1 className="hero-title mt-10 text-4xl leading-tight font-bold sm:text-6xl">Turn your notes into a reviewer.</h1>
      <p className="mt-5 max-w-xl text-lg">
        Drop in a PDF, Word, PowerPoint, or text file, or paste your notes, and get a quiz and flashcards. The free method works right in your browser. Turn on AI for true or false, select-all, and enumeration questions.
      </p>

      <UploadCard onReady={ready} />

      {started && (
        <section ref={studyRef} className={`${card} mt-6 scroll-mt-6`}>
          <div role="group" aria-label="Study mode" className="mb-5 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-all duration-200 ${
                  mode === m.id ? "border-accent-strong bg-accent-strong text-white shadow-glow" : "border-line text-bright hover:border-accent hover:bg-accent/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <p>No questions left. Upload more notes to make new ones.</p>
          ) : mode === "quiz" ? (
            <Quiz key={session} items={items} />
          ) : mode === "flash" ? (
            <Flashcards key={session} items={items} />
          ) : (
            <Editor items={items} onRemove={(i) => updateItems(items.filter((_, j) => j !== i))} />
          )}
        </section>
      )}

      <History entries={history} activeId={activeId} note={note} onOpen={open} onDelete={remove} onBackup={() => downloadBackup(history)} onRestore={restore} />
    </main>
  );
}

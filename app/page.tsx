"use client";

import { useEffect, useRef, useState } from "react";
import { AiMenu, useAiSettings } from "../components/ai-settings";
import Editor from "../components/editor";
import ExportMenu from "../components/export-menu";
import Flashcards from "../components/flashcards";
import History from "../components/history";
import Logo from "../components/logo";
import PrintSheet from "../components/print-sheet";
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
  const ai = useAiSettings();
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

  const modeIndex = MODES.findIndex((m) => m.id === mode);
  const activeTitle = history.find((h) => h.id === activeId)?.title ?? "Quizmos reviewer";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/55 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="logo flex cursor-default items-center gap-3">
            <Logo className="size-11" />
            <span className="text-xl font-semibold tracking-tight text-bright">Quizmos</span>
          </div>
          <AiMenu ai={ai} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pt-12 pb-24 sm:px-8 lg:px-10 lg:pt-16">
        <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-10">
          <h1 className="hero text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:col-span-8 lg:text-7xl">
            <span className="block text-bright">Turn your notes</span>
            <span className="outline-text block">into a reviewer.</span>
          </h1>
          <p className="max-w-md text-lg lg:col-span-4 lg:pb-3">Drop in a PDF, Word, PowerPoint, or text file, or paste your notes. You get a quiz and flashcards, built right in your browser.</p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:mt-14 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <UploadCard onReady={ready} ai={ai} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:col-span-4">
            <History entries={history} activeId={activeId} note={note} onOpen={open} onDelete={remove} onBackup={() => downloadBackup(history)} onRestore={restore} />
          </aside>
        </div>

        {started && (
          <>
          <section ref={studyRef} className={`${card} mt-6 scroll-mt-24`} aria-label="Study">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div role="group" aria-label="Study mode" className="relative grid w-full max-w-md grid-cols-3 rounded-full border border-line bg-ink/60 p-1">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-accent-strong shadow-glow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(${modeIndex * 100}%)` }}
                />
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={`relative z-10 cursor-pointer rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 ${mode === m.id ? "text-white" : "text-bright/80 hover:text-white"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm">{items.length} questions</p>
                <ExportMenu items={items} title={activeTitle} />
              </div>
            </div>

            <div className="mx-auto max-w-3xl">
              {items.length === 0 ? (
                <p>No questions left. Upload more notes to make new ones.</p>
              ) : mode === "quiz" ? (
                <Quiz key={session} items={items} />
              ) : mode === "flash" ? (
                <Flashcards key={session} items={items} />
              ) : (
                <Editor items={items} onRemove={(i) => updateItems(items.filter((_, j) => j !== i))} />
              )}
            </div>
          </section>
          <PrintSheet items={items} title={activeTitle} />
          </>
        )}
      </main>
    </>
  );
}

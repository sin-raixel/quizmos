"use client";

import { useRef, useState } from "react";
import Editor from "../components/editor";
import Flashcards from "../components/flashcards";
import Quiz from "../components/quiz";
import UploadCard from "../components/upload-card";
import { card, eyebrow } from "../components/ui";
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

  function ready(next: Question[]) {
    setItems(next);
    setStarted(true);
    setMode("quiz");
    requestAnimationFrame(() => studyRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-12 pb-20">
      <p className={eyebrow}>Study tool</p>
      <h1 className="mt-2 text-4xl leading-tight font-bold text-bright sm:text-5xl">
        Turn your notes into a <span className="text-accent">reviewer.</span>
      </h1>
      <p className="mt-4">
        Upload a PDF, Word, PowerPoint, or text file, or paste your notes. Quiz questions and flashcards are made right here in your browser.
        By default nothing is uploaded and no AI is used. You can optionally turn on AI with your own free key.
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
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  mode === m.id ? "border-accent-strong bg-accent-strong text-white" : "border-line text-bright hover:border-accent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <p>No questions left. Upload more notes to make new ones.</p>
          ) : mode === "quiz" ? (
            <Quiz items={items} />
          ) : mode === "flash" ? (
            <Flashcards items={items} />
          ) : (
            <Editor items={items} onRemove={(i) => setItems(items.filter((_, j) => j !== i))} />
          )}
        </section>
      )}
    </main>
  );
}

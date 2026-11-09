"use client";

import { useEffect, useRef } from "react";
import { download, fileName, toAnki, toQuizlet } from "../lib/export";
import type { Question } from "../lib/types";

const row =
  "block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-bright transition-colors hover:bg-accent/10 hover:text-white";

export default function ExportMenu({ items, title }: { items: Question[]; title: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };

  // Close on Escape or when clicking elsewhere.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <details ref={ref} className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-line bg-ink/60 px-4 py-1.5 text-sm font-medium text-bright transition-colors hover:border-accent [&::-webkit-details-marker]:hidden">
        Export
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface/95 p-2 shadow-2xl backdrop-blur">
        <button
          type="button"
          className={row}
          onClick={() => {
            close();
            setTimeout(() => window.print(), 50); // let the menu close first
          }}
        >
          Print or save as PDF
          <span className="block text-xs text-body">Questions, then an answer key on a new page</span>
        </button>
        <button
          type="button"
          className={row}
          onClick={() => {
            download(fileName(title, "anki"), toAnki(items));
            close();
          }}
        >
          Anki flashcards (.txt)
          <span className="block text-xs text-body">In Anki: File, then Import</span>
        </button>
        <button
          type="button"
          className={row}
          onClick={() => {
            download(fileName(title, "quizlet"), toQuizlet(items));
            close();
          }}
        >
          Quizlet flashcards (.txt)
          <span className="block text-xs text-body">In Quizlet: Create, then Import</span>
        </button>
      </div>
    </details>
  );
}

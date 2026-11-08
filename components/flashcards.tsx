"use client";

import { useEffect, useState } from "react";
import { FORMAT_LABEL, formatOf } from "../lib/types";
import type { Question } from "../lib/types";
import { eyebrow, ghostBtn, primaryBtn } from "./ui";

export default function Flashcards({ items }: { items: Question[] }) {
  const [order, setOrder] = useState(items);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = order[index];

  const go = (step: number) => {
    setIndex((i) => (i + step + order.length) % order.length);
    setFlipped(false);
  };

  // Left and right arrows move between cards (Space or Enter flips the focused card).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length]);

  const label = card.kind === "def" ? "Term" : card.kind === "cloze" ? "Fill in the blank" : FORMAT_LABEL[formatOf(card)];

  return (
    <div>
      <div className="mb-3 flex justify-between text-sm">
        <span className={eyebrow}>
          Card {index + 1} of {order.length}
        </span>
        <span>Click the card to flip. Arrow keys change cards.</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Showing the answer. Press to show the question." : "Showing the question. Press to show the answer."}
        className="flip group block w-full cursor-pointer text-lg text-bright"
      >
        <span className="flip-inner" data-flipped={flipped}>
          <span aria-hidden={flipped} className="flip-face spot border border-line bg-ink/70 whitespace-pre-line transition-shadow group-hover:border-accent group-hover:shadow-glow">
            <span>
              <small className="chip mb-3">{label}</small>
              <span className="block">{card.front}</span>
            </span>
          </span>
          <span aria-hidden={!flipped} className="flip-face flip-back border border-accent/60 bg-accent-strong/15 whitespace-pre-line shadow-glow">
            <span>
              <small className="chip mb-3">Answer</small>
              <span className="block">{card.back}</span>
            </span>
          </span>
        </span>
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={ghostBtn} onClick={() => go(-1)}>
          Previous
        </button>
        <button
          type="button"
          className={ghostBtn}
          onClick={() => {
            setOrder([...order].sort(() => Math.random() - 0.5));
            setIndex(0);
            setFlipped(false);
          }}
        >
          Shuffle
        </button>
        <button type="button" className={primaryBtn} onClick={() => go(1)}>
          Next
        </button>
      </div>
    </div>
  );
}

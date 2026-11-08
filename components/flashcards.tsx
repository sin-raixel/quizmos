"use client";

import { useState } from "react";
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

  return (
    <div>
      <div className="mb-3 flex justify-between text-sm">
        <span className={eyebrow}>
          Card {index + 1} of {order.length}
        </span>
        <span>Click the card to flip</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label="Flashcard, press to flip"
        className="grid min-h-48 w-full cursor-pointer place-items-center rounded-2xl border border-line bg-ink p-6 text-center text-lg whitespace-pre-line text-bright transition-colors hover:border-accent"
      >
        <span>
          <small className={`${eyebrow} mb-2 block`}>{flipped ? "Answer" : card.kind === "def" ? "Term" : card.kind === "ai" ? "Question" : "Fill in the blank"}</small>
          {flipped ? card.back : card.front}
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

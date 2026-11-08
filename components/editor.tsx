"use client";

import type { Question } from "../lib/types";

export default function Editor({ items, onRemove }: { items: Question[]; onRemove: (index: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm">{items.length} questions. Remove any that look wrong or silly.</p>
      <ul>
        {items.map((item, i) => (
          <li key={item.q} className="flex items-start justify-between gap-4 border-b border-line py-3 text-sm">
            <span className="whitespace-pre-line">
              {item.q}
              <b className="mt-1 block text-accent">Answer: {item.options[item.answer]}</b>
            </span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove question ${i + 1}`}
              className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-1 transition-colors hover:border-rose-400 hover:text-rose-400"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Question } from "../lib/types";
import { eyebrow, primaryBtn } from "./ui";

export default function Quiz({ items }: { items: Question[] }) {
  const [order, setOrder] = useState(items);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Keyboard and screen reader users: focus follows the quiz, but not on first load.
  useEffect(() => {
    if (picked !== null) nextRef.current?.focus();
  }, [picked]);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [index]);

  if (index >= order.length) {
    const ratio = score / order.length;
    return (
      <div className="py-4 text-center">
        <p className={eyebrow}>Quiz complete</p>
        <p className="mt-3 text-6xl font-bold text-bright">
          {score}/{order.length}
        </p>
        <p className="mt-3">
          {ratio === 1 ? "Perfect score." : ratio >= 0.6 ? "Solid run. Review the ones you missed." : "Good start. Read your notes again and retry."}
        </p>
        <button
          type="button"
          className={`${primaryBtn} mt-6`}
          onClick={() => {
            setOrder([...order].sort(() => Math.random() - 0.5));
            setIndex(0);
            setScore(0);
            setPicked(null);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const q = order[index];
  const answered = picked !== null;
  const correct = picked === q.answer;

  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className={eyebrow}>
          Question {index + 1} of {order.length}
        </span>
        <span>
          Score: <b className="text-bright">{score}</b>
        </span>
      </div>
      <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${((index + (answered ? 1 : 0)) / order.length) * 100}%` }} />
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="my-6 text-xl leading-snug font-semibold whitespace-pre-line text-bright outline-none sm:text-2xl">
        {q.q}
      </h2>

      <ul className="space-y-3">
        {q.options.map((option, i) => {
          let state = "border-line text-bright hover:border-accent";
          if (answered) {
            if (i === q.answer) state = "border-emerald-400 bg-emerald-400/10 text-bright";
            else if (i === picked) state = "border-rose-400 bg-rose-400/10 text-bright";
            else state = "border-line text-body opacity-60";
          }
          return (
            <li key={option}>
              <button
                type="button"
                aria-disabled={answered}
                onClick={() => {
                  if (answered) return;
                  moved.current = true;
                  setPicked(i);
                  if (i === q.answer) setScore((s) => s + 1);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${state} ${answered ? "cursor-default" : "cursor-pointer"}`}
              >
                {option}
                {answered && i === q.answer && " ✓"}
                {answered && i === picked && i !== q.answer && " ✗"}
              </button>
            </li>
          );
        })}
      </ul>

      <div role="status" className="min-h-4">
        {answered && (
          <div className="mt-5 rounded-xl border border-line bg-ink p-4 text-sm">
            <b className={correct ? "text-emerald-400" : "text-rose-400"}>
              {correct ? "Correct." : `Not quite. The answer is ${q.options[q.answer].replace(/\.$/, "")}.`}
            </b>
            <br />
            {q.kind === "ai" ? "Why: " : "From your notes: "}{q.why}
          </div>
        )}
      </div>

      {answered && (
        <div className="mt-5 flex justify-end">
          <button
            ref={nextRef}
            type="button"
            className={primaryBtn}
            onClick={() => {
              setIndex((i) => i + 1);
              setPicked(null);
            }}
          >
            {index + 1 >= order.length ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}

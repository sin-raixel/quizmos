"use client";

import { useEffect, useRef, useState } from "react";
import { gradeEnum } from "../lib/grade";
import { FORMAT_LABEL, answerText, formatOf } from "../lib/types";
import type { Question } from "../lib/types";
import { eyebrow, ghostBtn, primaryBtn } from "./ui";

const LETTERS = "ABCDEF";

const OPTION_STYLE = {
  idle: "spot border-line bg-ink/40 text-bright hover:border-accent hover:bg-accent/10 hover:shadow-glow motion-safe:hover:-translate-y-0.5",
  on: "spot border-accent bg-accent/15 text-bright shadow-glow",
  ok: "border-emerald-400 bg-emerald-400/10 text-bright",
  bad: "border-rose-400 bg-rose-400/10 text-bright",
  missed: "border-dashed border-amber-300 bg-amber-300/10 text-bright",
  dim: "border-line text-body opacity-50",
} as const;
type OptionState = keyof typeof OPTION_STYLE;

function Badge({ children, square, state }: { children: React.ReactNode; square?: boolean; state: OptionState }) {
  const tone =
    state === "ok" ? "border-emerald-400 text-emerald-300" : state === "bad" ? "border-rose-400 text-rose-300" : state === "missed" ? "border-amber-300 text-amber-200" : state === "on" ? "border-accent bg-accent text-ink" : "border-line text-accent";
  return (
    <span className={`grid size-7 shrink-0 place-items-center border text-xs font-semibold transition-colors ${square ? "rounded-md" : "rounded-full"} ${tone}`}>{children}</span>
  );
}

// One question. It is remounted for every question, so its answers always start empty.
function QuestionView({ q, onAnswer }: { q: Question; onAnswer: (correct: boolean) => void }) {
  const format = formatOf(q);
  const want = q.answers ?? [q.answer];
  const [picked, setPicked] = useState<number | null>(null); // mcq and tf
  const [chosen, setChosen] = useState<number[]>([]); // multi
  const [typed, setTyped] = useState<string[]>(() => (q.items ?? []).map(() => "")); // enum
  const [matches, setMatches] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function finish(ok: boolean) {
    setCorrect(ok);
    setDone(true);
    onAnswer(ok);
  }
  function pick(i: number) {
    if (done) return;
    setPicked(i);
    finish(i === q.answer);
  }
  function toggle(i: number) {
    if (done) return;
    setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  }
  function submitMulti() {
    if (done || chosen.length === 0) return;
    finish(want.length === chosen.length && want.every((i) => chosen.includes(i)));
  }
  function submitEnum() {
    if (done || typed.every((t) => t.trim() === "")) return;
    const result = gradeEnum(q.items ?? [], typed);
    setMatches(result.matches);
    finish(result.correct);
  }

  // Keyboard: letters (or numbers) choose, T and F answer true or false, Enter submits a multi-select.
  useEffect(() => {
    if (done || format === "enum") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const key = e.key.toLowerCase();

      if (format === "tf") {
        if (key === "t" || key === "1") pick(0);
        else if (key === "f" || key === "2") pick(1);
        return;
      }
      const byLetter = key.length === 1 ? "abcdef".indexOf(key) : -1;
      const byNumber = /^[1-6]$/.test(key) ? Number(key) - 1 : -1;
      const idx = byLetter >= 0 ? byLetter : byNumber;
      if (idx >= 0 && idx < q.options.length) {
        e.preventDefault();
        if (format === "multi") toggle(idx);
        else pick(idx);
      } else if (e.key === "Enter" && format === "multi" && el?.tagName !== "BUTTON") {
        submitMulti();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, format, chosen, q]);

  function stateOf(i: number): OptionState {
    if (format === "multi") {
      if (!done) return chosen.includes(i) ? "on" : "idle";
      if (want.includes(i)) return chosen.includes(i) ? "ok" : "missed";
      return chosen.includes(i) ? "bad" : "dim";
    }
    if (!done) return "idle";
    if (i === q.answer) return "ok";
    return i === picked ? "bad" : "dim";
  }

  const rightText = answerText(q).replace(/\.$/, "");
  const verdict = correct
    ? "Correct."
    : format === "enum"
      ? `Not quite. You got ${matches.filter(Boolean).length} of ${(q.items ?? []).length}. The answers are ${rightText}.`
      : format === "multi"
        ? `Not quite. The correct choices are ${rightText}.`
        : `Not quite. The answer is ${rightText}.`;

  return (
    <div>
      {format === "multi" && <p className="-mt-3 mb-4 text-sm">Choose every correct answer, then check.</p>}
      {format === "enum" && <p className="-mt-3 mb-4 text-sm">Type all {(q.items ?? []).length} answers. Order doesn’t matter.</p>}

      {format === "enum" ? (
        <div className="space-y-3">
          {typed.map((value, i) => {
            const tone = !done ? "border-line focus:border-accent" : matches[i] ? "border-emerald-400 bg-emerald-400/10" : "border-rose-400 bg-rose-400/10";
            return (
              <div key={i} className="flex items-center gap-3">
                <Badge state={!done ? "idle" : matches[i] ? "ok" : "bad"}>{i + 1}</Badge>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={value}
                  disabled={done}
                  autoComplete="off"
                  aria-label={`Answer ${i + 1}`}
                  placeholder="Type an answer"
                  onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (i < typed.length - 1) inputs.current[i + 1]?.focus();
                    else submitEnum();
                  }}
                  className={`w-full rounded-xl border bg-ink/60 px-4 py-3 text-bright transition-colors outline-none placeholder:text-body/50 ${tone}`}
                />
                {done && <span className={matches[i] ? "text-emerald-400" : "text-rose-400"}>{matches[i] ? "✓" : "✗"}</span>}
              </div>
            );
          })}
          {!done && (
            <div className="flex justify-end pt-2">
              <button type="button" className={primaryBtn} disabled={typed.every((t) => t.trim() === "")} onClick={submitEnum}>
                Check answers
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <ul className={format === "tf" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {q.options.map((option, i) => {
              const state = stateOf(i);
              const badge = format === "tf" ? option[0] : format === "multi" && (state === "on" || state === "ok") ? "✓" : LETTERS[i];
              return (
                <li key={`${i}-${option}`}>
                  <button
                    type="button"
                    aria-disabled={done}
                    aria-pressed={format === "multi" ? chosen.includes(i) : undefined}
                    onClick={() => (format === "multi" ? toggle(i) : pick(i))}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${OPTION_STYLE[state]} ${done ? "cursor-default" : "cursor-pointer"} ${format === "tf" ? "justify-center text-lg font-semibold" : ""}`}
                  >
                    <Badge square={format === "multi"} state={state}>
                      {badge}
                    </Badge>
                    <span className={format === "tf" ? "" : "flex-1"}>
                      {option}
                      {done && state === "ok" && " ✓"}
                      {done && state === "bad" && " ✗"}
                      {done && state === "missed" && " (you missed this)"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {format === "multi" && !done && (
            <div className="mt-4 flex justify-end">
              <button type="button" className={primaryBtn} disabled={chosen.length === 0} onClick={submitMulti}>
                Check answers
              </button>
            </div>
          )}
        </>
      )}

      <div role="status" className="min-h-4">
        {done && (
          <div className={`rise mt-5 rounded-xl border bg-ink/70 p-4 text-sm ${correct ? "border-emerald-400/60" : "border-rose-400/60"}`}>
            <b className={correct ? "text-emerald-400" : "text-rose-400"}>{verdict}</b>
            {q.why && (
              <>
                <br />
                {q.kind === "ai" ? "Why: " : "From your notes: "}
                {q.why}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Ring({ ratio }: { ratio: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const C = 2 * Math.PI * 52;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto size-36" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-line)" strokeWidth="6" />
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={shown ? C * (1 - ratio) : C}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)", filter: "drop-shadow(0 0 6px rgb(167 139 250 / 0.8))" }}
      />
      <text x="60" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--color-bright)">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  );
}

export default function Quiz({ items }: { items: Question[] }) {
  const [order, setOrder] = useState(items);
  const [round, setRound] = useState(0); // changes on every restart so each question starts fresh
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Question[]>([]);
  const [answered, setAnswered] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Keyboard and screen reader users: focus follows the quiz, but not on first load.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [index]);

  function restart(list: Question[]) {
    setOrder(list);
    setRound((r) => r + 1);
    setIndex(0);
    setScore(0);
    setMissed([]);
    setAnswered(false);
  }
  const shuffled = (list: Question[]) => [...list].sort(() => Math.random() - 0.5);

  if (index >= order.length) {
    const ratio = score / order.length;
    return (
      <div className="py-4 text-center">
        <p className={eyebrow}>Quiz complete</p>
        <div className="mt-4">
          <Ring ratio={ratio} />
        </div>
        <p className="mt-2 text-3xl font-bold text-bright">
          {score} of {order.length}
        </p>
        <p className="mt-3">{ratio === 1 ? "Perfect score." : ratio >= 0.6 ? "Solid run. Review the ones you missed." : "Good start. Read your notes again and retry."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {missed.length > 0 && (
            <button type="button" className={primaryBtn} onClick={() => restart(shuffled(missed))}>
              Retry the {missed.length} I missed
            </button>
          )}
          <button type="button" className={missed.length > 0 ? ghostBtn : primaryBtn} onClick={() => restart(shuffled(items))}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  const q = order[index];
  const format = formatOf(q);

  function handleAnswer(correct: boolean) {
    moved.current = true;
    setAnswered(true);
    if (correct) setScore((s) => s + 1);
    else setMissed((m) => [...m, q]);
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-sm">
        <span className={eyebrow}>
          Question {index + 1} of {order.length}
        </span>
        <span>
          Score: <b className="text-bright">{score}</b>
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 rounded-full bg-line/70">
        <div className="comet h-full rounded-full" style={{ width: `${((index + (answered ? 1 : 0)) / order.length) * 100}%` }} />
      </div>

      <span className="chip mt-6">{FORMAT_LABEL[format]}</span>
      <h2 ref={headingRef} tabIndex={-1} className="my-4 text-xl leading-snug font-semibold whitespace-pre-line text-bright outline-none sm:text-2xl">
        {q.q}
      </h2>

      <QuestionView key={`${round}-${index}`} q={q} onAnswer={handleAnswer} />

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="hidden text-xs sm:block">{format === "enum" ? "Enter moves to the next box." : format === "tf" ? "Keyboard: T or F." : "Keyboard: press A, B, C… to choose."}</p>
        {answered && (
          <button
            ref={nextRef}
            type="button"
            className={`${primaryBtn} ml-auto`}
            onClick={() => {
              setIndex((i) => i + 1);
              setAnswered(false);
            }}
          >
            {index + 1 >= order.length ? "See results" : "Next question"}
          </button>
        )}
      </div>
    </div>
  );
}

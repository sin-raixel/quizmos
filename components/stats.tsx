"use client";

import type { Saved } from "../lib/history";
import { byFormat, byTopic, questionStats, summarize, trend, weakest } from "../lib/stats";
import type { Group } from "../lib/stats";
import type { Question } from "../lib/types";
import { eyebrow, primaryBtn } from "./ui";

const PRACTICE_SIZE = 10;
const pctOf = (g: Group) => Math.round((g.correct / g.asked) * 100);

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 px-4 py-3 text-center">
      <p className="text-2xl font-bold text-bright">{value}</p>
      <p className="mt-0.5 text-xs">{label}</p>
    </div>
  );
}

// Score per full attempt, oldest to newest.
function TrendChart({ points }: { points: number[] }) {
  const W = 560;
  const H = 150;
  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const x = (i: number) => (points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score by attempt: ${points.map((p) => `${p}%`).join(", ")}`} className="w-full">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === 50 ? "3 4" : undefined} />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--color-body)">
            {v}%
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 5px rgb(167 139 250 / 0.7))" }} />}
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="var(--color-ink)" stroke="var(--color-accent)" strokeWidth="2.5" />
      ))}
      <text x={pad.l} y={H - 4} fontSize="10" fill="var(--color-body)">
        Attempt 1
      </text>
      {points.length > 1 && (
        <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="10" fill="var(--color-body)">
          Attempt {points.length}
        </text>
      )}
    </svg>
  );
}

function Bars({ groups }: { groups: Group[] }) {
  return (
    <ul className="space-y-3">
      {groups.map((g) => {
        const p = pctOf(g);
        return (
          <li key={g.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-bright">{g.label}</span>
              <span className="shrink-0">
                {p}% <span className="text-xs">({g.correct}/{g.asked})</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-line/70" role="img" aria-label={`${g.label}: ${p}% correct`}>
              <div className={`h-full rounded-full ${p < 50 ? "bg-rose-400" : p < 80 ? "bg-nova" : "bg-emerald-400"}`} style={{ width: `${Math.max(p, 3)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Stats({ entry, items, onPractice }: { entry: Saved | undefined; items: Question[]; onPractice: (list: Question[]) => void }) {
  const attempts = entry?.attempts ?? [];
  const summary = summarize(attempts);
  const stats = questionStats(items, attempts);
  const weak = weakest(stats);
  const formats = byFormat(stats);
  const topics = byTopic(stats);

  if (attempts.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-line px-4 py-12 text-center">
        <p className="text-lg font-semibold text-bright">No attempts yet</p>
        <p className="mt-1 max-w-sm text-sm">Finish a quiz and your scores, weak spots, and progress will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Attempts" value={String(summary.attempts)} />
            <Tile label="Best" value={`${summary.best}%`} />
            <Tile label="Average" value={`${summary.average}%`} />
            <Tile label="Last" value={`${summary.last}%`} />
          </div>
          <section aria-labelledby="trend-title">
            <h3 id="trend-title" className={`${eyebrow} mb-2`}>
              Score over time
            </h3>
            <TrendChart points={trend(attempts)} />
          </section>
        </>
      ) : (
        <p className="text-sm">Only partial runs so far. Finish a full quiz to see your score trend.</p>
      )}

      <section aria-labelledby="weak-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="weak-title" className={eyebrow}>
            Most missed questions
          </h3>
          {weak.length > 0 && (
            <button type="button" className={`${primaryBtn} !px-4 !py-1.5 text-sm`} onClick={() => onPractice(weak.slice(0, PRACTICE_SIZE).map((w) => w.q))}>
              Practice these {Math.min(weak.length, PRACTICE_SIZE)}
            </button>
          )}
        </div>
        {weak.length === 0 ? (
          <p className="text-sm">Nothing missed so far. Nice.</p>
        ) : (
          <ol className="space-y-2">
            {weak.map(({ q, asked, missed }) => (
              <li key={q.q} className="flex items-start justify-between gap-4 rounded-xl border border-line bg-ink/40 px-4 py-2.5">
                <span className="min-w-0 text-sm whitespace-pre-line text-bright">{q.q}</span>
                <span className="chip shrink-0">
                  missed {missed} of {asked}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {topics.length > 0 && (
        <section aria-labelledby="topic-title">
          <h3 id="topic-title" className={`${eyebrow} mb-3`}>
            Accuracy by topic (weakest first)
          </h3>
          <Bars groups={topics} />
        </section>
      )}

      {formats.length > 0 && (
        <section aria-labelledby="type-title">
          <h3 id="type-title" className={`${eyebrow} mb-3`}>
            Accuracy by question type
          </h3>
          <Bars groups={formats} />
        </section>
      )}
    </div>
  );
}

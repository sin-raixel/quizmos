import { FORMAT_LABEL, formatOf } from "./types";
import type { Format, Question } from "./types";

// One finished run through a quiz. Questions are stored as short hashes of their text (not the
// text itself) so a reviewer's history stays small in localStorage.
export type Attempt = {
  at: number;
  score: number;
  total: number;
  full: boolean; // true when the run covered every question (not a "retry missed" or "practice" run)
  asked: string[]; // hash of every question in the run
  missed: string[]; // hash of the ones answered wrong
};

export const MAX_ATTEMPTS = 30;

// 32-bit djb2 hash, base 36. Collisions inside one reviewer (at most 50 questions) are very unlikely.
export function hashQ(q: Question): string {
  const text = `${formatOf(q)}|${q.q.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function makeAttempt(order: Question[], missed: Question[], total: number, now = Date.now()): Attempt {
  const asked = order.map(hashQ);
  const missedHashes = missed.map(hashQ);
  return { at: now, score: order.length - missedHashes.length, total: order.length, full: order.length === total, asked, missed: missedHashes };
}

export const addAttempt = (list: Attempt[] | undefined, a: Attempt): Attempt[] => [...(list ?? []), a].slice(-MAX_ATTEMPTS);

// Anything read from storage or a backup file is untrusted.
export function validAttempt(x: unknown): x is Attempt {
  if (!x || typeof x !== "object") return false;
  const a = x as Attempt;
  const strings = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === "string");
  return (
    typeof a.at === "number" &&
    Number.isInteger(a.score) &&
    Number.isInteger(a.total) &&
    a.total > 0 &&
    a.score >= 0 &&
    a.score <= a.total &&
    typeof a.full === "boolean" &&
    strings(a.asked) &&
    strings(a.missed)
  );
}

export const cleanAttempts = (x: unknown): Attempt[] => (Array.isArray(x) ? x.filter(validAttempt).slice(-MAX_ATTEMPTS) : []);

const pct = (a: Attempt) => Math.round((a.score / a.total) * 100);

export type Summary = { attempts: number; best: number; average: number; last: number };

// Best, average, and last count only full runs, so a 3-question retry can't skew them.
export function summarize(attempts: Attempt[] | undefined): Summary | null {
  const full = (attempts ?? []).filter((a) => a.full);
  if (full.length === 0) return null;
  const scores = full.map(pct);
  return {
    attempts: full.length,
    best: Math.max(...scores),
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    last: scores[scores.length - 1],
  };
}

// Points for the trend chart: percent per full run, oldest first.
export const trend = (attempts: Attempt[] | undefined, limit = 20): number[] =>
  (attempts ?? [])
    .filter((a) => a.full)
    .slice(-limit)
    .map(pct);

export type QStat = { q: Question; asked: number; missed: number };

// Per-question tallies for the questions that still exist (questions removed in the editor drop out).
export function questionStats(items: Question[], attempts: Attempt[] | undefined): QStat[] {
  const byHash = new Map(items.map((q) => [hashQ(q), { q, asked: 0, missed: 0 }]));
  for (const a of attempts ?? []) {
    for (const h of a.asked) {
      const s = byHash.get(h);
      if (s) s.asked++;
    }
    for (const h of a.missed) {
      const s = byHash.get(h);
      if (s) s.missed++;
    }
  }
  return [...byHash.values()];
}

// Most-missed first. Needs at least one miss, and ties go to the question missed more often relative to times asked.
export function weakest(stats: QStat[], limit = 10): QStat[] {
  return stats
    .filter((s) => s.missed > 0)
    .sort((a, b) => b.missed / b.asked - a.missed / a.asked || b.missed - a.missed)
    .slice(0, limit);
}

export type Group = { label: string; asked: number; correct: number };

function group(stats: QStat[], key: (q: Question) => string | undefined): Group[] {
  const map = new Map<string, Group>();
  for (const s of stats) {
    const label = key(s.q);
    if (!label || s.asked === 0) continue;
    const g = map.get(label) ?? { label, asked: 0, correct: 0 };
    g.asked += s.asked;
    g.correct += s.asked - s.missed;
    map.set(label, g);
  }
  return [...map.values()].sort((a, b) => a.correct / a.asked - b.correct / b.asked); // weakest first
}

export const byFormat = (stats: QStat[]): Group[] => group(stats, (q) => FORMAT_LABEL[formatOf(q) as Format]);
export const byTopic = (stats: QStat[]): Group[] => group(stats, (q) => q.topic);

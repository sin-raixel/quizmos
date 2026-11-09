import { cleanAttempts } from "./stats";
import type { Attempt } from "./stats";
import type { Question } from "./types";

// Saved reviewers live in this browser (localStorage). Only the generated questions are kept,
// not the uploaded file or your notes, so each reviewer takes just a few KB.
export type Saved = { id: string; title: string; createdAt: number; items: Question[]; attempts?: Attempt[] };

const KEY = "reviewer-maker-history-v1";
export const MAX_SAVED = 30;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

// Anything read back from storage or a backup file is untrusted, so check its shape.
function valid(x: unknown): x is Saved {
  if (!x || typeof x !== "object") return false;
  const s = x as Saved;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.createdAt === "number" &&
    Array.isArray(s.items) &&
    s.items.length > 0 &&
    s.items.every((q) => q && typeof q.q === "string" && Array.isArray(q.options) && typeof q.answer === "number")
  );
}

// Keep a reviewer even if its quiz history is damaged; just drop the bad attempts.
const tidy = (s: Saved): Saved => (s.attempts === undefined ? s : { ...s, attempts: cleanAttempts(s.attempts) });

export function loadHistory(): Saved[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter(valid).map(tidy) : [];
  } catch {
    return [];
  }
}

// Returns false if the browser refused (storage full or blocked in a private window).
export function saveHistory(list: Saved[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    return true;
  } catch {
    return false;
  }
}

export function downloadBackup(list: Saved[]) {
  const blob = new Blob([JSON.stringify(list)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quizmos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): Saved[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn’t a Quizmos backup.");
  }
  if (!Array.isArray(data)) throw new Error("That isn’t a Quizmos backup.");
  const good = data.filter(valid).map(tidy);
  if (good.length === 0) throw new Error("No reviewers were found in that file.");
  return good;
}

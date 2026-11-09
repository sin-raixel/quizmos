import { answerText } from "./types";
import type { Question } from "./types";

// Optional "smarter questions". Two ways to get them:
//   1. generateWithServer: the site owner's key lives on the server (app/api/generate/route.ts).
//      Friends only type an access code.
//   2. generateWithAI: the visitor pastes their OWN free Gemini key (sent from their browser to Google).
// If Google renames or retires a model, edit this list. Models are tried in order.
export const MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite"];
export const MAX_CHARS = 30000; // keeps requests small enough for free-tier limits

export const ATTEMPT_MS = 18000; // longest we wait on one model; 3 models x 18s fits the server's 60s limit
export const isTimeout = (error: unknown) => error instanceof DOMException && error.name === "TimeoutError";

export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 50;
export const clampCount = (n: number) => Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(n) || 25));
// Room for the answer: each question with its flashcard text needs a few hundred tokens.
export const outputTokens = (count: number) => Math.max(4096, count * 400);

export function promptFor(count: number): string {
  const mcq = Math.round(count * 0.5);
  const tf = Math.round(count * 0.2);
  const multi = Math.round(count * 0.15);
  const mix = [
    ['"mcq": multiple choice', mcq],
    ['"tf": true or false', tf],
    ['"multi": select all that apply', multi],
    ['"enum": enumeration, where the student lists items from memory', Math.max(0, count - mcq - tf - multi)],
  ]
    .filter(([, n]) => Number(n) > 0)
    .map(([label, n]) => `- ${label} (${n})`)
    .join("\n");

  return `You are a teacher writing a study reviewer from a student's notes.
Write ${count} question${count === 1 ? " that tests" : "s that test"} understanding of the notes below, mixing these types:
${mix}

Rules:
- Use only facts found in the notes. Do not invent anything. If the notes are too short for ${count}, write fewer questions, and skip a type the notes can't support.
- Ask about ideas, causes, effects, comparisons, and key terms, not trivia.
- Never write "according to the notes" in a question.
- "explanation" is one or two sentences on why the answer is right, based on the notes.
- "cardFront" and "cardBack" make a short flashcard for the same idea.
- mcq: exactly 4 options and only one is correct. Wrong options must be believable, on the same topic, and similar in length.
- tf: "question" is a single statement. About half should be false. A false statement should change one fact from the notes in a believable way, not be absurd. The explanation gives the correct fact.
- multi: 5 options, with 2 or 3 correct. "question" ends with "Select all that apply."
- enum: "question" asks for a specific number of items, for example "List the three types of ...". "answers" has that many short answers (1 to 4 words each). If an answer has an accepted alternative or abbreviation, join them with "|", for example "Carbon dioxide|CO2".

Return ONLY a JSON array. Use these shapes:
{"type":"mcq","question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"...","cardFront":"...","cardBack":"..."}
{"type":"tf","question":"...","answer":true,"explanation":"...","cardFront":"...","cardBack":"..."}
{"type":"multi","question":"...","options":["...","...","...","...","..."],"answerIndexes":[0,2],"explanation":"...","cardFront":"...","cardBack":"..."}
{"type":"enum","question":"...","answers":["...","...","..."],"explanation":"...","cardFront":"...","cardBack":"..."}

NOTES:
`;
}

type Raw = {
  type?: unknown;
  question?: unknown;
  options?: unknown;
  answerIndex?: unknown;
  answerIndexes?: unknown;
  answer?: unknown;
  answers?: unknown;
  explanation?: unknown;
  cardFront?: unknown;
  cardBack?: unknown;
};

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Shape = Pick<Question, "format" | "options" | "answer" | "answers" | "items">;

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim() !== "");
const distinct = (list: string[]) => new Set(list.map((o) => o.trim().toLowerCase())).size === list.length;

// Each type is checked separately because the AI's answer is untrusted text.
function shapeOf(r: Raw): Shape | null {
  const type = typeof r.type === "string" ? r.type.toLowerCase() : "mcq";

  if (type === "tf") {
    const v = typeof r.answer === "string" ? r.answer.trim().toLowerCase() : r.answer;
    if (v !== true && v !== false && v !== "true" && v !== "false") return null;
    return { format: "tf", options: ["True", "False"], answer: v === true || v === "true" ? 0 : 1 };
  }

  if (type === "enum") {
    if (!isStrings(r.answers) || r.answers.length < 2 || r.answers.length > 6) return null;
    const items = r.answers.map((a) => a.trim());
    if (!distinct(items.map((a) => a.split("|")[0]))) return null;
    return { format: "enum", options: [], answer: 0, items };
  }

  if (type === "multi") {
    if (!isStrings(r.options) || r.options.length < 4 || r.options.length > 6 || !distinct(r.options)) return null;
    if (!Array.isArray(r.answerIndexes)) return null;
    const options = r.options;
    const picks = [...new Set(r.answerIndexes.map(Number))];
    if (picks.length < 2 || picks.length >= options.length) return null;
    if (!picks.every((i) => Number.isInteger(i) && i >= 0 && i < options.length)) return null;
    const right = new Set(picks.map((i) => options[i]));
    const shuffled = shuffle(options);
    const answers = shuffled.map((o, i) => (right.has(o) ? i : -1)).filter((i) => i >= 0);
    return { format: "multi", options: shuffled, answer: answers[0], answers };
  }

  // mcq
  if (!isStrings(r.options) || r.options.length !== 4 || !distinct(r.options)) return null;
  const index = Number(r.answerIndex);
  if (!Number.isInteger(index) || index < 0 || index > 3) return null;
  const options = r.options as string[];
  const correct = options[index];
  const shuffled = shuffle(options); // models like to put the answer first
  return { format: "mcq", options: shuffled, answer: shuffled.indexOf(correct) };
}

function parse(raw: string): Question[] {
  const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("The AI didn’t return a list of questions. Try again.");

  const out: Question[] = [];
  for (const r of data as Raw[]) {
    if (!r || typeof r.question !== "string" || r.question.trim() === "") continue;
    const shape = shapeOf(r);
    if (!shape) continue;

    const why = typeof r.explanation === "string" ? r.explanation : "";
    const item: Question = { kind: "ai", q: r.question.trim(), why, front: "", back: "", ...shape };
    const correct = answerText(item);
    const prefix = shape.format === "tf" ? "True or false: " : "";
    item.front = typeof r.cardFront === "string" && r.cardFront ? r.cardFront : prefix + item.q;
    item.back = typeof r.cardBack === "string" && r.cardBack ? r.cardBack : `${correct}\n\n${why}`.trim();
    out.push(item);
  }
  if (out.length === 0) throw new Error("The AI’s answer couldn’t be used. Try again.");
  return out;
}

export async function generateWithAI(notes: string, apiKey: string, count = 25): Promise<Question[]> {
  const text = notes.slice(0, MAX_CHARS);
  let problem = "";

  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFor(clampCount(count)) + text }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: outputTokens(clampCount(count)) },
        }),
        signal: AbortSignal.timeout(ATTEMPT_MS),
      });
    } catch (error) {
      if (isTimeout(error)) {
        problem = "The AI took too long to answer. Try again in a moment.";
        continue; // try the next model
      }
      throw new Error("Couldn’t reach Google. Check your internet connection.");
    }

    // Model missing or free limit reached: try the next model.
    if (res.status === 404 || res.status === 429) {
      problem =
        res.status === 429
          ? "You’ve hit the free limit for now. Wait a minute, or try again tomorrow."
          : "No available Gemini model was found.";
      continue;
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message: string = body?.error?.message ?? "";
      if (res.status === 400 && /api key/i.test(message)) throw new Error("That API key isn’t valid. Check that you copied all of it.");
      if (res.status === 403) throw new Error("Google refused that key. It may not have access to the Gemini API.");
      throw new Error(message || `Google returned an error (${res.status}).`);
    }

    const answer: string = (body?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!answer) {
      problem = "The AI returned an empty answer.";
      continue;
    }
    return parse(answer);
  }
  throw new Error(problem || "The AI request failed.");
}

// Is the owner's shared key set up on the server? (Decides whether to show the access-code box.)
export async function serverAiAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/generate");
    const body = await res.json();
    return Boolean(body?.enabled);
  } catch {
    return false;
  }
}

// Ask the site's own server (which holds the owner's key) to write the questions.
export async function generateWithServer(notes: string, code: string, count = 25): Promise<Question[]> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.slice(0, MAX_CHARS), code, count: clampCount(count) }),
      signal: AbortSignal.timeout(65000), // just over the server's own 60s limit
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("The server took too long. Try again, or use the free method.");
    throw new Error("Couldn’t reach the server. Check your internet connection.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `The server returned an error (${res.status}).`);
  if (typeof body?.answer !== "string" || !body.answer) throw new Error("The AI returned an empty answer.");
  return parse(body.answer);
}

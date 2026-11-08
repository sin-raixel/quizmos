import type { Question } from "./types";

// Optional "smarter questions" using the visitor's OWN free Gemini API key.
// The key stays in their browser and is only ever sent to Google.
// If Google renames or retires a model, edit this list. Models are tried in order.
const MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite"];
export const MAX_CHARS = 30000; // keeps requests small enough for free-tier limits

const PROMPT = `You are a teacher writing a study reviewer from a student's notes.
Write 15 multiple-choice questions that test understanding of the notes below.

Rules:
- Use only facts found in the notes. Do not invent anything.
- Ask about ideas, causes, effects, comparisons, and key terms, not trivia.
- Each question has exactly 4 options and only one is correct. Wrong options must be believable, on the same topic, and similar in length.
- Never write "according to the notes" in a question.
- "explanation" is one or two sentences on why the answer is right, based on the notes.
- "cardFront" and "cardBack" make a short flashcard for the same idea.

Return ONLY a JSON array in this shape:
[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"...","cardFront":"...","cardBack":"..."}]

NOTES:
`;

type Raw = {
  question?: unknown;
  options?: unknown;
  answerIndex?: unknown;
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

// The AI's answer is untrusted text, so check every question before using it.
function parse(raw: string): Question[] {
  const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("The AI didn’t return a list of questions. Try again.");

  const out: Question[] = [];
  for (const r of data as Raw[]) {
    if (typeof r.question !== "string" || !Array.isArray(r.options) || r.options.length !== 4) continue;
    if (!r.options.every((o) => typeof o === "string")) continue;
    const options = r.options as string[];
    const index = Number(r.answerIndex);
    if (!Number.isInteger(index) || index < 0 || index > 3) continue;
    if (new Set(options.map((o) => o.trim().toLowerCase())).size !== 4) continue;

    const correct = options[index];
    const shuffled = shuffle(options); // models like to put the answer first
    const why = typeof r.explanation === "string" ? r.explanation : "";
    out.push({
      kind: "ai",
      q: r.question,
      options: shuffled,
      answer: shuffled.indexOf(correct),
      why,
      front: typeof r.cardFront === "string" && r.cardFront ? r.cardFront : r.question,
      back: typeof r.cardBack === "string" && r.cardBack ? r.cardBack : `${correct}\n\n${why}`,
    });
  }
  if (out.length === 0) throw new Error("The AI’s answer couldn’t be used. Try again.");
  return out;
}

export async function generateWithAI(notes: string, apiKey: string): Promise<Question[]> {
  const text = notes.slice(0, MAX_CHARS);
  let problem = "";

  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT + text }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      });
    } catch {
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

import { timingSafeEqual } from "node:crypto";
import { MAX_CHARS, MODELS, clampCount, isTimeout, outputTokens, promptFor } from "../../../lib/ai";

// The owner's Gemini key lives ONLY here, as an environment variable. It is never sent to the browser.
//   GEMINI_API_KEY        required: your key from aistudio.google.com/apikey
//   ACCESS_CODE           required: the passcode you give your friends
//   RATE_LIMIT_PER_DAY    optional: generations per person per day (default 10)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//                         optional but recommended on Vercel: makes the limits reliable

export const runtime = "nodejs";
export const maxDuration = 60; // all model attempts together must fit in this

const LIMIT = Number(process.env.RATE_LIMIT_PER_DAY) || 10;
const MAX_BAD_CODES = 5; // wrong access codes allowed per address per hour
const configured = () => Boolean(process.env.GEMINI_API_KEY && process.env.ACCESS_CODE);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function codeMatches(given: unknown): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from((process.env.ACCESS_CODE ?? "").trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

// Behind a proxy like Vercel's, the first address in x-forwarded-for is the visitor.
const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

// ---- counters ---------------------------------------------------------------
// Used for the daily limit and for wrong-code attempts. Upstash Redis when configured (reliable).
// Otherwise an in-memory counter, which is only best-effort on serverless hosts (it can reset).
const memory = new Map<string, { window: string; count: number }>();

async function counter(bucket: string, ip: string, op: "INCR" | "DECR" | "GET", span: "day" | "hour"): Promise<number> {
  const stamp = new Date().toISOString().slice(0, span === "hour" ? 13 : 10);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const key = `rm:${bucket}:${stamp}:${ip}`;
      const commands = op === "GET" ? [["GET", key]] : [[op, key], ["EXPIRE", key, span === "hour" ? 3700 : 90000]];
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      const n = Number(data?.[0]?.result ?? 0);
      if (Number.isFinite(n)) return n;
    } catch {
      // Fall through to the in-memory counter.
    }
  }

  const id = `${bucket}:${ip}`;
  const entry = memory.get(id);
  const current = !entry || entry.window !== stamp ? { window: stamp, count: 0 } : entry;
  if (op === "INCR") current.count += 1;
  if (op === "DECR") current.count = Math.max(0, current.count - 1);
  memory.set(id, current);
  return current.count;
}

// ---- asking Google ----------------------------------------------------------

type Outcome = { answer: string } | { error: string; status: number };

const TOTAL_MS = 55_000; // all attempts together, safely inside maxDuration
const FIRST_MS = 35_000; // a big set can take a while, so one model may use most of the time

async function askGemini(notes: string, count: number): Promise<Outcome> {
  const deadline = Date.now() + TOTAL_MS;
  let problem = "";
  for (const model of MODELS) {
    const left = deadline - Date.now();
    if (left < 8000) break; // not enough time left for another try
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFor(count) + notes }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: outputTokens(count) },
        }),
        signal: AbortSignal.timeout(Math.min(left, FIRST_MS)),
      });
    } catch (error) {
      if (isTimeout(error)) {
        problem = "The AI took too long to answer. Try a smaller number of questions, or try again in a moment.";
        continue; // try the next model if there is time left
      }
      return { error: "The server couldn’t reach Google. Try again in a moment.", status: 502 };
    }

    // Model missing or shared free limit reached: try the next model.
    if (res.status === 404 || res.status === 429) {
      problem =
        res.status === 429
          ? "The shared AI is busy right now (lots of people studying!). Wait a minute and try again."
          : "No available Gemini model was found.";
      continue;
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Gemini error", res.status, body?.error?.message); // details stay in your server logs
      return { error: "The AI service had a problem. Try again in a moment.", status: 502 };
    }

    const answer: string = (body?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!answer) {
      problem = "The AI returned an empty answer.";
      continue;
    }
    return { answer };
  }
  return { error: problem || "The AI request failed.", status: 503 };
}

// ---- routes -----------------------------------------------------------------

// Lets the page know whether to show the "access code" box.
export async function GET() {
  return json({ enabled: configured() });
}

export async function POST(req: Request) {
  if (!configured()) return json({ error: "Shared AI isn’t set up on this site yet." }, 503);

  let payload: { notes?: unknown; code?: unknown; count?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const ip = clientIp(req);

  // Stop code guessers: after too many wrong codes, this address is blocked until the hour is up.
  // This check comes first, so even the right code is refused while blocked.
  if ((await counter("bad", ip, "GET", "hour")) >= MAX_BAD_CODES) {
    return json({ error: "Too many wrong access codes. Try again in an hour." }, 429);
  }
  if (!codeMatches(payload.code)) {
    await counter("bad", ip, "INCR", "hour");
    return json({ error: "That access code isn’t right." }, 401);
  }

  if (typeof payload.notes !== "string" || payload.notes.trim().length < 200) {
    return json({ error: "There isn’t enough text to make questions from." }, 400);
  }
  const notes = payload.notes.slice(0, MAX_CHARS); // enforced here too: client limits can be bypassed
  const count = clampCount(Number(payload.count)); // 1 to 50, also enforced here

  // Take a daily slot now, and give it back below if the AI couldn't deliver.
  if ((await counter("day", ip, "INCR", "day")) > LIMIT) {
    await counter("day", ip, "DECR", "day");
    return json({ error: `You’ve reached today’s limit of ${LIMIT} AI reviewers. Try again tomorrow, or use the free method.` }, 429);
  }

  const result = await askGemini(notes, count);
  if ("error" in result) {
    await counter("day", ip, "DECR", "day"); // a failed request shouldn't cost a daily slot
    return json({ error: result.error }, result.status);
  }
  return json({ answer: result.answer });
}

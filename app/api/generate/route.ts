import { timingSafeEqual } from "node:crypto";
import { MAX_CHARS, MODELS, PROMPT } from "../../../lib/ai";

// The owner's Gemini key lives ONLY here, as an environment variable. It is never sent to the browser.
//   GEMINI_API_KEY        required: your key from aistudio.google.com/apikey
//   ACCESS_CODE           required: the passcode you give your friends
//   RATE_LIMIT_PER_DAY    optional: generations per person per day (default 10)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//                         optional but recommended on Vercel: makes the daily limit reliable

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMIT = Number(process.env.RATE_LIMIT_PER_DAY) || 10;
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

// ---- daily rate limit -------------------------------------------------------
// Upstash Redis when configured (reliable). Otherwise an in-memory counter, which is only
// best-effort on serverless hosts (it can reset when the server restarts).
const memory = new Map<string, { day: string; count: number }>();

async function underLimit(ip: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const key = `rm:${day}:${ip}`;
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, 90000]]),
      });
      const data = await res.json();
      const count = Number(data?.[0]?.result);
      if (Number.isFinite(count)) return count <= LIMIT;
    } catch {
      // Fall through to the in-memory counter.
    }
  }

  const entry = memory.get(ip);
  if (!entry || entry.day !== day) {
    memory.set(ip, { day, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT;
}

// ---- routes -----------------------------------------------------------------

// Lets the page know whether to show the "access code" box.
export async function GET() {
  return json({ enabled: configured() });
}

export async function POST(req: Request) {
  if (!configured()) return json({ error: "Shared AI isn’t set up on this site yet." }, 503);

  let payload: { notes?: unknown; code?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  if (!codeMatches(payload.code)) return json({ error: "That access code isn’t right." }, 401);

  if (typeof payload.notes !== "string" || payload.notes.trim().length < 200) {
    return json({ error: "There isn’t enough text to make questions from." }, 400);
  }
  const notes = payload.notes.slice(0, MAX_CHARS); // enforced here too: client limits can be bypassed

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await underLimit(ip))) {
    return json({ error: `You’ve reached today’s limit of ${LIMIT} AI reviewers. Try again tomorrow, or use the free method.` }, 429);
  }

  let problem = "";
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT + notes }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 },
        }),
      });
    } catch {
      return json({ error: "The server couldn’t reach Google. Try again in a moment." }, 502);
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
      return json({ error: "The AI service had a problem. Try again in a moment." }, 502);
    }

    const answer: string = (body?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!answer) {
      problem = "The AI returned an empty answer.";
      continue;
    }
    return json({ answer });
  }
  return json({ error: problem || "The AI request failed." }, 503);
}

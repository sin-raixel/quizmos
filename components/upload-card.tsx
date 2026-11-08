"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MAX_CHARS, MAX_QUESTIONS, MIN_QUESTIONS, clampCount, generateWithAI, generateWithServer } from "../lib/ai";
import { buildQuestions } from "../lib/generate";
import { readFile } from "../lib/read-file";
import type { Question } from "../lib/types";
import { CODE_NAME, KEY_NAME } from "./ai-settings";
import type { AiSettings } from "./ai-settings";
import { card, primaryBtn } from "./ui";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FORMATS = ["PDF", "DOCX", "PPTX", "TXT", "MD"];
const PRESETS = [5, 10, 25];

export default function UploadCard({ onReady, ai }: { onReady: (items: Question[], title: string) => void; ai: AiSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; error?: boolean }>({ msg: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(25);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("25");
  const { useAi, apiKey, remember, sharedAi, code, rememberCode, ownKey } = ai;

  function setAmount(n: number) {
    const v = clampCount(n);
    setCount(v);
    setDraft(String(v));
  }

  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setStatus({ msg: `Selected: ${next.name}` });
  }

  async function generate() {
    // Name for the saved reviewer: the file name, or the start of the pasted notes.
    const firstLine = text.trim().split("\n")[0].slice(0, 40).trim();
    const title = file ? file.name.replace(/\.[^.]+$/, "") : firstLine || "Pasted notes";
    setBusy(true);
    setStatus({ msg: "Reading…" });
    try {
      let content = text.trim();
      if (file) content = `${await readFile(file)}\n${content}`;
      if (content.trim().length < 200) {
        setStatus({
          msg: "There isn’t enough text yet. Scanned PDFs (pictures of pages) can’t be read, so try pasting the text instead.",
          error: true,
        });
        return;
      }

      const key = apiKey.trim();
      const accessCode = code.trim();
      const viaOwnKey = useAi && (ownKey || !sharedAi) && key !== "";
      const viaServer = useAi && sharedAi && !ownKey && accessCode !== "";

      if (viaOwnKey || viaServer) {
        try {
          if (viaOwnKey) {
            if (remember) localStorage.setItem(KEY_NAME, key);
            else localStorage.removeItem(KEY_NAME);
          } else if (rememberCode) {
            localStorage.setItem(CODE_NAME, accessCode);
          } else {
            localStorage.removeItem(CODE_NAME);
          }
        } catch {
          // Not being able to save is fine.
        }
        setStatus({ msg: `Asking the AI to write your questions. ${count > 25 ? "A big set can take up to a minute…" : "This can take up to 30 seconds…"}` });
        try {
          const items = (viaOwnKey ? await generateWithAI(content, key, count) : await generateWithServer(content, accessCode, count)).slice(0, count);
          setStatus({
            msg: `Made ${items.length} questions with AI.${content.length > MAX_CHARS ? " Only the first part of a long file was used." : ""}`,
          });
          onReady(items, title);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Something went wrong.";
          const fallback = buildQuestions(content, count);
          if (fallback.items.length === 0) {
            setStatus({ msg: reason, error: true });
          } else {
            setStatus({ msg: `${reason} I used the free method instead.`, error: true });
            onReady(fallback.items, title);
          }
        }
        return;
      }

      if (useAi) {
        setStatus({
          msg: sharedAi && !ownKey ? "Add the access code in the key menu (top right) to use AI, or turn AI off to use the free method." : "Add a Gemini key in the key menu (top right) to use AI, or turn AI off to use the free method.",
          error: true,
        });
        return;
      }

      const result = buildQuestions(content, count);
      if (result.items.length === 0) {
        setStatus({ msg: "I couldn’t find enough to ask about. Notes with definitions (“Router: forwards packets”) or with names, dates, and numbers work best.", error: true });
        return;
      }
      setStatus({
        msg: `Read ${result.words.toLocaleString("en-US")} words, found ${result.defs} definitions, made ${result.items.length} questions${result.items.length < count ? ` (you asked for ${count}, but your notes only had enough for ${result.items.length})` : ""}.`,
      });
      onReady(result.items, title);
    } catch (error) {
      console.error(error);
      setStatus({ msg: "Couldn’t read that file. Try another one, or paste the text.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card} aria-labelledby="make-title">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="make-title" className="text-xl font-semibold text-bright">
          Add your notes
        </h2>
        <p className="text-sm">Files are read on your device and never uploaded.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left pane: the file */}
        <div className="relative">
          <button
            type="button"
            data-over={over}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              choose(e.dataTransfer.files[0]);
            }}
            className={`dz spot group relative flex h-full min-h-72 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-6 py-8 text-center transition-all duration-300 hover:bg-accent/5 data-[over=true]:scale-[1.015] ${
              over ? "border-dashed border-accent bg-accent/10" : file ? "border-solid border-accent/60 bg-accent/5" : "border-dashed border-line hover:border-accent/50"
            }`}
          >
            {file ? (
              <span key={file.name} className="rise flex w-full flex-col items-center">
                <span className="mb-3 grid size-14 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-400 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                    <path d="M14 3v5h5M9 14.5l2 2 4-4" />
                  </svg>
                </span>
                <span className="block max-w-full truncate px-6 font-semibold text-bright">{file.name}</span>
                <span className="mt-1 block text-sm">{formatSize(file.size)}, ready to use</span>
                <span className="mt-3 block text-sm text-accent">Click or drop another file to replace it</span>
              </span>
            ) : (
              <>
                <span className="mb-4 grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-accent group-hover:shadow-glow group-data-[over=true]:-translate-y-2.5">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                  </svg>
                </span>
                <span className="text-lg font-semibold text-bright">{over ? "Let go to add it" : "Drop a file here"}</span>
                <span className="mt-1 block text-sm">or click to browse</span>
                <span className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {FORMATS.map((f) => (
                    <span key={f} className="chip transition-transform duration-200 group-hover:-translate-y-0.5">
                      {f}
                    </span>
                  ))}
                </span>
              </>
            )}
          </button>
          {file && (
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => {
                setFile(null);
                setStatus({ msg: "" });
                if (inputRef.current) inputRef.current.value = ""; // so choosing the same file again still works
              }}
              className="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-ink/70 text-bright transition-all duration-200 hover:rotate-90 hover:border-rose-400 hover:bg-rose-400/10 hover:text-rose-400"
            >
              ✕
            </button>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.docx,.pptx,.txt,.md" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
        </div>

        {/* Right pane: pasted notes */}
        <div className="flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or paste your notes here…"
            aria-label="Paste your notes"
            className="min-h-72 w-full flex-1 resize-none rounded-xl border border-line bg-ink/60 p-4 text-bright transition-all duration-300 placeholder:text-body/60 hover:border-accent/50 focus:border-accent focus:shadow-glow focus:outline-none"
          />
          <p className="mt-2 text-right text-xs tabular-nums">{text.length.toLocaleString("en-US")} characters</p>
        </div>
      </div>

      {/* How many questions */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div>
          <p className="font-semibold text-bright">How many questions?</p>
          <p className="text-sm">Up to {MAX_QUESTIONS}. Short notes may make fewer.</p>
        </div>
        <div role="group" aria-label="Number of questions" className="relative grid w-full max-w-sm grid-cols-4 rounded-full border border-line bg-ink/60 p-1 sm:ml-auto">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-accent-strong shadow-glow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${(custom ? PRESETS.length : Math.max(0, PRESETS.indexOf(count))) * 100}%)` }}
          />
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={!custom && count === n}
              onClick={() => {
                setCustom(false);
                setAmount(n);
              }}
              className={`relative z-10 cursor-pointer rounded-full py-2 text-sm font-medium tabular-nums transition-colors duration-300 ${!custom && count === n ? "text-white" : "text-bright/80 hover:text-white"}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className={`relative z-10 cursor-pointer rounded-full py-2 text-sm font-medium transition-colors duration-300 ${custom ? "text-white" : "text-bright/80 hover:text-white"}`}
          >
            Custom
          </button>
        </div>
        {custom && (
          <div className="rise flex w-full items-center gap-4">
            <input
              type="range"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              value={count}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="Number of questions"
              className="slider flex-1"
              style={{ "--pct": `${((count - MIN_QUESTIONS) / (MAX_QUESTIONS - MIN_QUESTIONS)) * 100}%` } as CSSProperties}
            />
            <input
              type="number"
              inputMode="numeric"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setCount(clampCount(n));
              }}
              onBlur={() => setDraft(String(count))}
              aria-label="Number of questions, 1 to 50"
              className="w-20 rounded-lg border border-line bg-ink/60 px-3 py-2 text-center text-bright tabular-nums transition-all focus:border-accent focus:shadow-glow focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line/70 pt-5">
        <p role="status" className={`min-w-0 flex-1 basis-60 text-sm ${status.error ? "text-rose-400" : ""}`}>
          {status.msg}
        </p>
        <span className="chip inline-flex items-center gap-1.5" title="Change this with the key icon in the top bar">
          {useAi && (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="currentColor">
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
            </svg>
          )}
          {useAi ? "AI questions on" : "Free method"}
        </span>
        <button type="button" onClick={generate} disabled={busy} className={primaryBtn}>
          {busy ? "Working…" : "Make my reviewer"}
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHARS, generateWithAI } from "../lib/ai";
import { buildQuestions } from "../lib/generate";
import { readFile } from "../lib/read-file";
import type { Question } from "../lib/types";
import { card, primaryBtn } from "./ui";

const KEY_NAME = "reviewer-maker-gemini-key";

export default function UploadCard({ onReady }: { onReady: (items: Question[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; error?: boolean }>({ msg: "" });
  const [useAi, setUseAi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bring back a key the visitor chose to remember on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_NAME);
      if (saved) {
        setApiKey(saved);
        setRemember(true);
        setUseAi(true);
      }
    } catch {
      // Storage can be blocked in private windows. Nothing to do.
    }
  }, []);

  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setStatus({ msg: `Selected: ${next.name}` });
  }

  async function generate() {
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
      if (useAi && key) {
        try {
          if (remember) localStorage.setItem(KEY_NAME, key);
          else localStorage.removeItem(KEY_NAME);
        } catch {
          // Not being able to save the key is fine.
        }
        setStatus({ msg: "Asking Gemini to write your questions. This can take up to 30 seconds…" });
        try {
          const items = await generateWithAI(content, key);
          setStatus({
            msg: `Made ${items.length} questions with AI.${content.length > MAX_CHARS ? " Only the first part of a long file was used." : ""}`,
          });
          onReady(items);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Something went wrong.";
          const fallback = buildQuestions(content);
          if (fallback.items.length === 0) {
            setStatus({ msg: reason, error: true });
          } else {
            setStatus({ msg: `${reason} I used the free method instead.`, error: true });
            onReady(fallback.items);
          }
        }
        return;
      }

      const result = buildQuestions(content);
      if (result.items.length === 0) {
        setStatus({ msg: "I couldn’t find enough to ask about. Notes with definitions (“Router: forwards packets”) or with names, dates, and numbers work best.", error: true });
        return;
      }
      setStatus({
        msg: `Read ${result.words.toLocaleString("en-US")} words, found ${result.defs} definitions, made ${result.items.length} questions.`,
      });
      onReady(result.items);
    } catch (error) {
      console.error(error);
      setStatus({ msg: "Couldn’t read that file. Try another one, or paste the text.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} mt-8`}>
      <button
        type="button"
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
        className={`w-full cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-accent ${
          over ? "border-accent bg-accent/10" : "border-line"
        }`}
      >
        <span className="font-semibold text-bright">Drop a file here</span> or click to choose
        <span className="mt-1 block text-sm">PDF, DOCX, PPTX, TXT, or MD</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Or paste your notes here…"
        aria-label="Paste your notes"
        className="mt-4 min-h-28 w-full resize-y rounded-lg border border-line bg-ink p-3 text-bright focus:outline-2 focus:outline-accent"
      />

      <div className="mt-4 rounded-lg border border-line p-4">
        <label className="flex cursor-pointer items-center gap-2 font-medium text-bright">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="size-4 accent-accent-strong" />
          Smarter questions with AI (optional, free with your own key)
        </label>
        {useAi && (
          <div className="mt-4 space-y-3 text-sm">
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Gemini API key"
              aria-label="Gemini API key"
              className="w-full rounded-lg border border-line bg-ink p-3 text-bright focus:outline-2 focus:outline-accent"
            />
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-accent-strong" />
              Remember my key on this device
            </label>
            <p>
              Get a free key at{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline">
                aistudio.google.com/apikey
              </a>
              . It stays in your browser and is only sent to Google.
            </p>
            <p className="text-amber-300">
              With AI on, your notes are sent to Google. On the free tier Google may use them to improve its products, so don’t upload private or sensitive material.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p role="status" className={`max-w-md text-sm ${status.error ? "text-rose-400" : ""}`}>
          {status.msg}
        </p>
        <button type="button" onClick={generate} disabled={busy} className={primaryBtn}>
          {busy ? "Working…" : "Make my reviewer"}
        </button>
      </div>
    </section>
  );
}

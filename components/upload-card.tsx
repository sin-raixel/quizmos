"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CHARS, generateWithAI, generateWithServer, serverAiAvailable } from "../lib/ai";
import { buildQuestions } from "../lib/generate";
import { readFile } from "../lib/read-file";
import type { Question } from "../lib/types";
import { card, primaryBtn } from "./ui";

const KEY_NAME = "reviewer-maker-gemini-key";
const CODE_NAME = "reviewer-maker-access-code";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadCard({ onReady }: { onReady: (items: Question[], title: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; error?: boolean }>({ msg: "" });
  const [useAi, setUseAi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [sharedAi, setSharedAi] = useState(false); // does the site owner offer shared AI?
  const [code, setCode] = useState("");
  const [rememberCode, setRememberCode] = useState(true);
  const [ownKey, setOwnKey] = useState(false); // "advanced": use my own key instead of the access code
  const inputRef = useRef<HTMLInputElement>(null);

  // Bring back a key the visitor chose to remember on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_NAME);
      if (saved) {
        setApiKey(saved);
        setRemember(true);
        setUseAi(true);
        setOwnKey(true);
      }
      const savedCode = localStorage.getItem(CODE_NAME);
      if (savedCode) {
        setCode(savedCode);
        setUseAi(true);
      }
    } catch {
      // Storage can be blocked in private windows. Nothing to do.
    }
    serverAiAvailable().then(setSharedAi);
  }, []);

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
        setStatus({ msg: "Asking the AI to write your questions. This can take up to 30 seconds…" });
        try {
          const items = viaOwnKey ? await generateWithAI(content, key) : await generateWithServer(content, accessCode);
          setStatus({
            msg: `Made ${items.length} questions with AI.${content.length > MAX_CHARS ? " Only the first part of a long file was used." : ""}`,
          });
          onReady(items, title);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Something went wrong.";
          const fallback = buildQuestions(content);
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
        setStatus({ msg: sharedAi && !ownKey ? "Enter the access code to use AI, or untick the AI box to use the free method." : "Paste a Gemini key to use AI, or untick the AI box to use the free method.", error: true });
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
      onReady(result.items, title);
    } catch (error) {
      console.error(error);
      setStatus({ msg: "Couldn’t read that file. Try another one, or paste the text.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} mt-8`}>
      <div className="relative">
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
          className={`spot w-full cursor-pointer rounded-xl border-2 px-4 py-8 text-center transition-all duration-300 hover:border-accent hover:bg-accent/5 ${
            over ? "border-dashed border-accent bg-accent/10" : file ? "border-solid border-accent/60 bg-accent/5" : "border-dashed border-line"
          }`}
        >
          {file ? (
            <>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto mb-2 size-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                <path d="M14 3v5h5M9 14.5l2 2 4-4" />
              </svg>
              <span className="mx-auto block max-w-full truncate px-8 font-semibold text-bright">{file.name}</span>
              <span className="mt-1 block text-sm">
                {formatSize(file.size)} · ready to use
              </span>
              <span className="mt-2 block text-sm text-accent">Click or drop another file to replace it</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto mb-2 size-8 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              <span className="font-semibold text-bright">Drop a file here</span> or click to choose
              <span className="mt-1 block text-sm">PDF, DOCX, PPTX, TXT, or MD</span>
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
            className="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-ink/70 text-bright transition-colors hover:border-rose-400 hover:bg-rose-400/10 hover:text-rose-400"
          >
            ✕
          </button>
        )}
      </div>
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
          {sharedAi ? "Smarter questions with AI (needs an access code)" : "Smarter questions with AI (optional, free with your own key)"}
        </label>
        <p className="mt-1 pl-6 text-sm">Adds true or false, select-all, and enumeration questions.</p>
        {useAi && (
          <div className="mt-4 space-y-3 text-sm">
            {sharedAi && !ownKey && (
              <>
                <input
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Access code (ask whoever shared this site)"
                  aria-label="Access code"
                  className="w-full rounded-lg border border-line bg-ink p-3 text-bright focus:outline-2 focus:outline-accent"
                />
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={rememberCode} onChange={(e) => setRememberCode(e.target.checked)} className="size-4 accent-accent-strong" />
                  Remember the code on this device
                </label>
              </>
            )}

            {(ownKey || !sharedAi) && (
              <>
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
              </>
            )}

            {sharedAi && (
              <button type="button" onClick={() => setOwnKey((v) => !v)} className="cursor-pointer text-accent underline">
                {ownKey ? "Use the access code instead" : "Advanced: use my own Gemini key instead"}
              </button>
            )}

            <p className="text-amber-300">
              {sharedAi && !ownKey
                ? "With AI on, your notes are sent through this site’s server to Google. On the free tier Google may use them to improve its products, so don’t upload private or sensitive material."
                : "With AI on, your notes are sent to Google. On the free tier Google may use them to improve its products, so don’t upload private or sensitive material."}
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

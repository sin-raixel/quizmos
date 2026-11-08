"use client";

import { useRef, useState } from "react";
import type { Saved } from "../lib/history";
import { card, eyebrow, ghostBtn } from "./ui";

const when = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function History({
  entries,
  activeId,
  note,
  onOpen,
  onDelete,
  onBackup,
  onRestore,
}: {
  entries: Saved[];
  activeId: string | null;
  note: { msg: string; error?: boolean };
  onOpen: (entry: Saved) => void;
  onDelete: (id: string) => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className={`${card} mt-6`} aria-labelledby="history-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="history-title" className="text-xl font-semibold text-bright">
            Your reviewers
          </h2>
          <p className={`${eyebrow} mt-1`}>Saved on this device only</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${ghostBtn} text-sm`} disabled={entries.length === 0} onClick={onBackup}>
            Back up
          </button>
          <button type="button" className={`${ghostBtn} text-sm`} onClick={() => fileRef.current?.click()}>
            Restore
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onRestore(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <p role="status" className={`mt-3 min-h-5 text-sm ${note.error ? "text-rose-400" : ""}`}>
        {note.msg}
      </p>

      {entries.length === 0 ? (
        <p className="mt-2">Reviewers you make show up here, so you can come back to them later.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {entries.map((e) => {
            const active = e.id === activeId;
            const ai = e.items.some((q) => q.kind === "ai");
            return (
              <li key={e.id} className={`spot flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-200 hover:border-accent hover:shadow-glow ${active ? "border-accent bg-accent/10" : "border-line bg-ink/40"}`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-bright">{e.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {when(e.createdAt)} · {e.items.length} questions
                    </span>
                    {ai && <span className="chip">AI</span>}
                    {active && <span className="chip">Open now</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {confirming === e.id ? (
                    <>
                      <span className="text-sm">Delete this?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(null);
                          onDelete(e.id);
                        }}
                        className="cursor-pointer rounded-full border border-rose-400 px-4 py-1.5 text-sm text-rose-400 transition-colors hover:bg-rose-400/10"
                      >
                        Yes, delete
                      </button>
                      <button type="button" className={`${ghostBtn} text-sm`} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={`${ghostBtn} text-sm`} onClick={() => onOpen(e)}>
                        Open
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${e.title}`}
                        onClick={() => setConfirming(e.id)}
                        className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:border-rose-400 hover:bg-rose-400/10 hover:text-rose-400"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

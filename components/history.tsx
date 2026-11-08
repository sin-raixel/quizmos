"use client";

import { useRef, useState } from "react";
import type { Saved } from "../lib/history";
import { card, ghostBtn } from "./ui";

const when = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const icon = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

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
    <section className={`${card} sm:p-6`} aria-labelledby="history-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="history-title" className="text-xl font-semibold text-bright">
            Your reviewers
          </h2>
          <p className="mt-0.5 text-sm">Saved on this device only</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" title="Back up" aria-label="Back up your reviewers" disabled={entries.length === 0} onClick={onBackup} className={`${ghostBtn} grid size-9 place-items-center !p-0 disabled:cursor-not-allowed disabled:opacity-40`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5" {...icon}>
              <path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
          </button>
          <button type="button" title="Restore" aria-label="Restore reviewers from a backup" onClick={() => fileRef.current?.click()} className={`${ghostBtn} grid size-9 place-items-center !p-0`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5" {...icon}>
              <path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />
            </svg>
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

      {note.msg && (
        <p role="status" className={`rise mt-3 text-sm ${note.error ? "text-rose-400" : ""}`}>
          {note.msg}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mb-2 size-8 text-accent/70" {...icon}>
            <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V5Z" />
          </svg>
          Reviewers you make show up here, so you can come back to them later.
        </div>
      ) : (
        <ul className="thin-scroll -mr-2 mt-4 max-h-[30rem] space-y-2.5 overflow-y-auto pr-2">
          {entries.map((e) => {
            const active = e.id === activeId;
            const ai = e.items.some((q) => q.kind === "ai");
            return (
              <li
                key={e.id}
                className={`spot group relative overflow-hidden rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-glow ${active ? "border-accent bg-accent/10" : "border-line bg-ink/40"}`}
              >
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 origin-top bg-accent transition-transform duration-300 ${active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"}`} />
                <p className="truncate font-semibold text-bright">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span>
                    {when(e.createdAt)}, {e.items.length} questions
                  </span>
                  {ai && <span className="chip">AI</span>}
                  {active && <span className="chip">Open now</span>}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {confirming === e.id ? (
                    <>
                      <span className="text-sm">Delete this?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(null);
                          onDelete(e.id);
                        }}
                        className="cursor-pointer rounded-full border border-rose-400 px-3.5 py-1 text-sm text-rose-400 transition-colors hover:bg-rose-400/10"
                      >
                        Yes, delete
                      </button>
                      <button type="button" className={`${ghostBtn} !px-3.5 !py-1 text-sm`} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={`${ghostBtn} !px-4 !py-1 text-sm`} onClick={() => onOpen(e)}>
                        Open
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${e.title}`}
                        onClick={() => setConfirming(e.id)}
                        className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full border border-line transition-colors hover:border-rose-400 hover:bg-rose-400/10 hover:text-rose-400"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" {...icon}>
                          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
                        </svg>
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

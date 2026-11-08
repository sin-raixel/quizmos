"use client";

import { useEffect, useRef, useState } from "react";
import { serverAiAvailable } from "../lib/ai";

export const KEY_NAME = "reviewer-maker-gemini-key";
export const CODE_NAME = "reviewer-maker-access-code";

// All AI choices live here, so the key menu in the top bar and the upload card share one state.
export function useAiSettings() {
  const [useAi, setUseAi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [sharedAi, setSharedAi] = useState(false); // does the site owner offer shared AI?
  const [code, setCode] = useState("");
  const [rememberCode, setRememberCode] = useState(true);
  const [ownKey, setOwnKey] = useState(false); // "advanced": use my own key instead of the access code

  // Bring back a key or code the visitor chose to remember on this device.
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

  return { useAi, setUseAi, apiKey, setApiKey, remember, setRemember, sharedAi, code, setCode, rememberCode, setRememberCode, ownKey, setOwnKey };
}
export type AiSettings = ReturnType<typeof useAiSettings>;

const icon = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Secret({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-lg border border-line bg-ink/70 py-2.5 pr-11 pl-3 text-bright transition-all placeholder:text-body/60 focus:border-accent focus:shadow-glow focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide it" : "Show it"}
        aria-pressed={shown}
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-body transition-colors hover:bg-accent/15 hover:text-bright"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true" {...icon}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!shown && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm transition-colors hover:text-bright">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-accent-strong" />
      {children}
    </label>
  );
}

// A key icon in the top bar. The panel opens on hover or keyboard focus, and stays open while you type.
// Clicking the icon pins it open (the way to open it on a phone).
export function AiMenu({ ai }: { ai: AiSettings }) {
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const viaCode = ai.sharedAi && !ai.ownKey;

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) setPinned(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPinned(false);
      if (wrap.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div ref={wrap} className="menu relative" data-open={pinned}>
      <button
        type="button"
        aria-label="AI settings: access code and API key"
        aria-expanded={pinned}
        aria-controls="ai-panel"
        onClick={() => setPinned((p) => !p)}
        className="menu-btn relative grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-surface/70 text-bright transition-all duration-300 hover:border-accent hover:shadow-glow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="menu-icon size-5" {...icon}>
          <path d="m21 2-9.6 9.6" />
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
        {ai.useAi && <span className="absolute top-0 right-0 size-3 rounded-full border-2 border-ink bg-nova shadow-[0_0_10px_2px_rgb(125_211_252/0.8)]" />}
      </button>

      <div id="ai-panel" className="menu-panel absolute top-full right-0 z-40 w-[min(23rem,calc(100vw-2.5rem))] pt-3">
        <div className="glass spot edge rounded-2xl bg-surface/95 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-bright">Smarter questions with AI</p>
              <p className="mt-0.5 text-sm">Adds true or false, select-all, and enumeration.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ai.useAi}
              aria-label="Use AI"
              onClick={() => ai.setUseAi(!ai.useAi)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-all duration-300 ${ai.useAi ? "border-accent bg-accent-strong shadow-glow" : "border-line bg-ink"}`}
            >
              <span className={`absolute top-0.5 left-0.5 size-4.5 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${ai.useAi ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {ai.useAi && (
            <div className="rise mt-4 space-y-3 border-t border-line pt-4">
              {viaCode && (
                <>
                  <Secret value={ai.code} onChange={ai.setCode} placeholder="Access code from whoever shared this site" label="Access code" />
                  <Check checked={ai.rememberCode} onChange={ai.setRememberCode}>
                    Remember the code on this device
                  </Check>
                </>
              )}

              {(ai.ownKey || !ai.sharedAi) && (
                <>
                  <Secret value={ai.apiKey} onChange={ai.setApiKey} placeholder="Paste your Gemini API key" label="Gemini API key" />
                  <Check checked={ai.remember} onChange={ai.setRemember}>
                    Remember my key on this device
                  </Check>
                  <p className="text-sm">
                    Get a free key at{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:text-bright">
                      aistudio.google.com/apikey
                    </a>
                    . It stays in your browser and is only sent to Google.
                  </p>
                </>
              )}

              {ai.sharedAi && (
                <button type="button" onClick={() => ai.setOwnKey(!ai.ownKey)} className="cursor-pointer text-sm text-accent underline underline-offset-2 transition-colors hover:text-bright">
                  {ai.ownKey ? "Use the access code instead" : "Advanced: use my own Gemini key"}
                </button>
              )}

              <p className="flex gap-2 rounded-lg bg-ink/60 p-3 text-xs leading-relaxed">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-nova" {...icon}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                {viaCode ? "Your notes are sent through this site’s server to Google." : "Your notes are sent to Google."} On the free tier Google may use them to improve its products, so skip private or sensitive material.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

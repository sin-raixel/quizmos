"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// The theme lives on <html data-theme="...">. The inline script in app/layout.tsx sets it before the first paint.
function subscribe(onChange: () => void) {
  const watcher = new MutationObserver(onChange);
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => watcher.disconnect();
}
const current = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
const onServer = (): Theme => "dark";

const icon = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, onServer);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("quizmos-theme", next);
    } catch {
      // Storage can be blocked; the theme still changes for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="relative grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-surface/70 text-bright transition-all duration-300 hover:border-accent hover:shadow-glow"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" {...icon}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" {...icon}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

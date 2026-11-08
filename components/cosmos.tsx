"use client";

import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

// A small seeded random generator, so the server and the browser draw the same stars.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One tiny element whose box-shadow draws a whole field of stars.
function field(count: number, seed: number, colors: string[]) {
  const next = rng(seed);
  return Array.from({ length: count }, () => {
    const x = (next() * 100).toFixed(2);
    const y = (next() * 100).toFixed(2);
    return `${x}vw ${y}vh 0 ${colors[Math.floor(next() * colors.length)]}`;
  }).join(",");
}

export default function Cosmos() {
  const layers = useMemo(
    () => [
      { size: 1, depth: 4, twinkle: "9s", shadow: field(150, 11, ["#fff", "#c4b5fd", "#bae6fd"]) },
      { size: 2, depth: 10, twinkle: "6s", shadow: field(48, 23, ["#fff", "#a78bfa", "#7dd3fc"]) },
      { size: 3, depth: 18, twinkle: "4.5s", shadow: field(14, 37, ["#fff", "#e9d5ff"]) },
    ],
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      // 1. Cursor light inside anything marked .spot.
      if (e.target instanceof Element) {
        const spot = e.target.closest<HTMLElement>(".spot");
        if (spot) {
          const box = spot.getBoundingClientRect();
          spot.style.setProperty("--mx", `${e.clientX - box.left}px`);
          spot.style.setProperty("--my", `${e.clientY - box.top}px`);
        }
      }
      // 2. The stars drift a little against the cursor, nearer stars more.
      if (reduce || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--px", String((e.clientX / window.innerWidth - 0.5) * 2));
        root.style.setProperty("--py", String((e.clientY / window.innerHeight - 0.5) * 2));
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="cosmos">
      <div className="nebula nebula-a" />
      <div className="nebula nebula-b" />
      <div className="nebula nebula-c" />
      {layers.map((l) => (
        <div key={l.size} className="parallax" style={{ "--depth": l.depth } as CSSProperties}>
          <div className="star-layer" style={{ width: l.size, height: l.size, boxShadow: l.shadow, animationDuration: l.twinkle }} />
        </div>
      ))}
      <span className="shooting-star" />
    </div>
  );
}

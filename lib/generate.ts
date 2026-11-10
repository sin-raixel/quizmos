import type { Question } from "./types";

// No AI here: questions come from pattern matching plus a little text analysis.
// 1. The notes are split into sections (headings come from read-file.ts, or are guessed).
// 2. Sentences and terms are scored by how central they are to the notes, so the quiz
//    asks about the important things instead of random ones, spread across all sections.
// 3. Every wrong answer is taken from the same notes, and the ones that look most like
//    the right answer (same section, similar shape) are picked first.

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Make a definition read like a sentence, and keep long ones from filling the screen.
const tidy = (d: string) => cap(d.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "")) + ".";
const short = (d: string) => (d.length > 140 ? `${d.slice(0, d.lastIndexOf(" ", 140))}…` : d);

// "X is a ...", "X refers to ...", "Term: explanation", "Term - explanation"
const IS_RE = /^([A-Z][^.:,;]{1,45}?)\s+(?:is|are|refers to|means|is defined as|can be defined as|is known as)\s+(?:an?|the)?\s*(.{25,200}?)\.?$/;
const COLON_RE = /^([A-Z][^.:,;]{1,40}):\s+(.{25,200})$/;
const DASH_RE = /^([A-Z][^.:,;–—]{1,40}?)\s+[–—-]\s+(.{25,200})$/;

// Sentences that start with these are ordinary sentences, not "Term is meaning".
const NOT_A_TERM = new Set(
  "this that these those it its there here he she they we you i which what who whom whose one some many most each another such also however but and or so then thus therefore the in on at of for with from into when if while because although since as after before once unless until why how only about almost nearly roughly just even still now today".split(" "),
);

// Words that start instructions or exercises ("Compute the...", "Segregate at source..."), not definitions.
const IMPERATIVES = new Set(
  "segregate design compute calculate solve identify explain describe list discuss create use avoid reduce prefer apply determine find state name give show write draw analyze analyse evaluate compare measure".split(" "),
);
const startsImperative = (s: string) => IMPERATIVES.has(s.split(" ")[0].toLowerCase());

// Slide headings and labels that look like terms but aren't ("Causes: ...", "Remember It: ...").
const LABELS = new Set(
  "causes effects solutions examples types steps impacts outcomes objectives goals summary overview introduction conclusion evidence note notes remember key check discussion activity quiz review questions answer answers low medium high yes no".split(" "),
);
const PREFIXES = new Set("non anti pre post re co sub semi self ex multi inter intra over under".split(" "));
// A definition that ends on one of these, or on a comma, was probably cut off.
const DANGLING = new Set("the a an of in on to with and or their its for from by as at that which is are".split(" "));
const isComplete = (raw: string) => {
  const d = raw.replace(/[.!?]+$/, "").trim();
  return (
    (d.match(/\(/g) || []).length === (d.match(/\)/g) || []).length &&
    !/[,;:]$/.test(d) &&
    !DANGLING.has((d.toLowerCase().split(" ").pop() ?? "").replace(/\W/g, ""))
  );
};

type Section = { title: string; level: number };
type Sentence = { text: string; sec: number };
type Def = { term: string; def: string; src: string; sec: number; score: number };
type Cand = { item: Question; score: number; sec: number };

// ---- Sections -------------------------------------------------------------------------

const MD_HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const tidyTitle = (t: string) =>
  t.replace(/^\d+(?:\.\d+)*[.)]?\s+/, "").replace(/[\s:#]+$/, "").replace(/\s+/g, " ").trim().slice(0, 60);

// "# Heading" lines are written by read-file.ts (and by Markdown notes). For plain text
// a short Title Case or ALL CAPS line with no punctuation, followed by real text, is a heading.
function headingOf(line: string, next: string, prevBlank: boolean): Section | null {
  const md = line.match(MD_HEADING);
  if (md) {
    const title = tidyTitle(md[2]);
    return title ? { title, level: md[1].length } : null;
  }
  const words = line.split(" ");
  if (words.length > 8 || line.length > 70 || !next) return null;
  if (/^[-•*]/.test(line) || /[.!?,;]$/.test(line) || /:\s+\S|\s[–—-]\s/.test(line)) return null;
  if (/^(?:figure|fig|table|page|slide)\b/i.test(line) || !/^[A-Z]/.test(line)) return null;
  const caps = line === line.toUpperCase() && /[A-Z]{3}/.test(line);
  const titleCase = words.length >= 2 && words.filter((w) => w.length > 3).every((w) => /^[A-Z0-9(]/.test(w));
  if (!(prevBlank || caps || titleCase) || (words.length === 1 && !prevBlank)) return null;
  if (next.split(" ").length < 4 && !/^[-•*]/.test(next)) return null;
  const title = tidyTitle(line);
  return title ? { title, level: 1 } : null;
}

// Pick the heading level to use as the "topic" label for stats: the shallowest one that
// gives between 2 and 12 groups. Returns one label per section (index 0 = before any heading).
function topicsOf(sections: Section[]): (string | undefined)[] {
  const levels = [...new Set(sections.map((s) => s.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const labels: string[] = [""];
    let current = "";
    for (const s of sections) {
      if (s.level <= level) current = s.title;
      labels.push(current);
    }
    const distinct = new Set(labels.filter(Boolean)).size;
    if (distinct >= 2 && distinct <= 12) return labels.map((l) => l || undefined);
  }
  return [];
}

// ---- Importance -----------------------------------------------------------------------

const STOP = new Set(
  "the and for that this with from are was were has have had not but can will would should could their there which when what where while into than then also such been being its they them these those about over under more most other some any each very just only your you our out use used using may might must shall does did done make made many much how why who whom whose because between during through after before above below within without across per via".split(" "),
);
const stem = (w: string) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const contentWords = (s: string) => [...new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem))];
const mentions = (text: string, term: string) => new RegExp(`\\b${escapeRe(term)}(?:s|es)?\\b`, "i").test(text);

// Highest scores first, with a little randomness so "generate again" doesn't repeat exactly.
function ranked<T>(list: T[], score: (x: T) => number, noise = 0.15): T[] {
  return list
    .map((x) => ({ x, k: score(x) + Math.random() * noise }))
    .sort((a, b) => b.k - a.k)
    .map((r) => r.x);
}

// Pick the best questions, but spread them over the sections: each question already taken
// from a section lowers the score of the next one from it.
function select(cands: Cand[], count: number): Question[] {
  const pool = cands.map((c) => ({ ...c, s: c.score + Math.random() * 0.12 }));
  const taken = new Map<number, number>();
  const out: Question[] = [];
  while (out.length < count && pool.length) {
    let best = 0;
    let bestValue = -Infinity;
    pool.forEach((c, i) => {
      const value = c.s - 0.18 * (taken.get(c.sec) ?? 0);
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    });
    const [c] = pool.splice(best, 1);
    taken.set(c.sec, (taken.get(c.sec) ?? 0) + 1);
    out.push(c.item);
  }
  return shuffle(out);
}

// ---- Wrong answers --------------------------------------------------------------------

// The best `n` from the pool. A score of -Infinity means "only use if nothing else is left".
function top<T>(pool: T[], score: (x: T) => number, n = 3): T[] {
  const scored = pool.map((x) => ({ x, v: score(x) }));
  const good = scored.filter((r) => r.v > -Infinity).sort((a, b) => b.v - a.v).map((r) => r.x);
  const rest = shuffle(scored.filter((r) => r.v === -Infinity).map((r) => r.x));
  return [...good, ...rest].slice(0, n);
}
const wc = (s: string) => s.split(" ").length;
const isAcronym = (t: string) => t === t.toUpperCase() && /[A-Z]/.test(t);
const jaccard = (a: string[], b: string[]) => {
  const B = new Set(b);
  const both = a.filter((x) => B.has(x)).length;
  return both / (a.length + b.length - both || 1);
};
// Wrong terms that are from the same section and look like the answer (similar length and shape).
const termFit = (a: Def, b: Def, secA = a.sec) =>
  (secA === b.sec ? 0.5 : 0) +
  Math.max(0, 0.25 - 0.1 * Math.abs(wc(a.term) - wc(b.term))) +
  (isAcronym(a.term) === isAcronym(b.term) ? 0.1 : 0) +
  Math.random() * 0.25;
// Wrong definitions that share some vocabulary, but are not near copies of the right one.
const defFit = (a: Def, b: Def) => {
  const overlap = jaccard(contentWords(a.def), contentWords(b.def));
  // Skip near copies, and definitions that name the term being asked about (they would be obviously wrong).
  if (overlap > 0.6 || mentions(b.def, a.term)) return -Infinity;
  return (a.sec === b.sec ? 0.5 : 0) + 0.6 * overlap + 0.25 * (1 - Math.abs(a.def.length - b.def.length) / Math.max(a.def.length, b.def.length)) + Math.random() * 0.25;
};

export function buildQuestions(text: string, count = 25) {
  // Lines that wrap mid-sentence (common in PDFs) are joined back together,
  // except right after a "# Heading" line.
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/^(.*[^\n.!?:;])\n(?=[a-z(,])/gm, (m, line: string) => (line.startsWith("#") ? m : `${line} `));

  // 0. Split into sections and sentences. Each sentence remembers its section.
  const sections: Section[] = [];
  const sents: Sentence[] = [];
  const lines = clean.split("\n").map((l) => l.trim());
  let prevBlank = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      prevBlank = true;
      continue;
    }
    let next = "";
    for (let j = i + 1; j < lines.length && j < i + 4; j++) {
      if (lines[j]) {
        next = lines[j];
        break;
      }
    }
    const heading = headingOf(line, next, prevBlank);
    prevBlank = false;
    if (heading) {
      sections.push(heading);
      continue;
    }
    for (const part of line.split(/(?<=[.!?])\s+/)) {
      const s = part.trim().replace(/^[-•*#\d.)\s]+/, "");
      const n = s.split(" ").length;
      if (n >= 5 && n <= 40 && !/[→⇒➔➜•·|]|->|=>/.test(s) && !/\?$/.test(s)) sents.push({ text: s, sec: sections.length });
    }
  }
  const sentences = sents.map((s) => s.text);
  const secOf = new Map<string, number>();
  for (const s of sents) if (!secOf.has(s.text)) secOf.set(s.text, s.sec);
  const topics = topicsOf(sections);
  const headText = sections.map((s) => s.title.toLowerCase()).join(" | ");

  // How central is each sentence to the notes? Sentences that share vocabulary
  // with many other sentences are about the main ideas of the lesson.
  const df = new Map<string, number>();
  for (const s of sentences) for (const w of contentWords(s)) df.set(w, (df.get(w) ?? 0) + 1);
  const centRaw = new Map<string, number>();
  let centMax = 0;
  for (const s of sentences) {
    if (centRaw.has(s)) continue;
    const ws = contentWords(s);
    let total = 0;
    for (const w of ws) if ((df.get(w) ?? 0) >= 2) total += Math.log(df.get(w)!);
    const v = total / Math.sqrt(ws.length + 3);
    centRaw.set(s, v);
    centMax = Math.max(centMax, v);
  }
  const cent = (s: string) => (centMax ? (centRaw.get(s) ?? 0) / centMax : 0);

  // 1. Find the definitions
  const defs: Def[] = [];
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const { text: s, sec } of sents) {
    const m = s.match(IS_RE) || s.match(COLON_RE) || s.match(DASH_RE);
    if (!m || m[1].split(" ").length > 5 || m[2].trim().split(" ").length < 5) continue;
    // Drop "(SDG 14" style bits from the term, then skip headings like "Causes" or "Remember It".
    const term = cap(m[1].trim().replace(/^(?:an?|the)\s+/i, "").replace(/\s*\([^)]*\)?/g, "").trim() || "x");
    const termWords = term.toLowerCase().split(" ");
    if (term.length < 3 || NOT_A_TERM.has(termWords[0]) || LABELS.has(termWords[0]) || LABELS.has(termWords[termWords.length - 1]) || PREFIXES.has(termWords[termWords.length - 1])) continue;
    if (IMPERATIVES.has(termWords[0]) || /[%=×÷]/.test(term)) continue;
    const defText = m[2].trim();
    // Skip formulas, "If ..." exercises, instructions, and cut-off text.
    if (!isComplete(defText) || /[=×÷]/.test(defText) || /^if\b/i.test(defText) || startsImperative(defText)) continue;
    if (seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    used.add(s);
    defs.push({ term, def: m[2].trim(), src: s, sec, score: 0 });
  }

  // How important is each term? It matters more when the notes keep coming back to it,
  // when its sentence is central, and when it shows up in a heading.
  for (const d of defs) {
    let others = 0;
    for (const s of sentences) if (s !== d.src && mentions(s, d.term)) others++;
    d.score = 0.4 * cent(d.src) + 0.4 * (Math.min(others, 5) / 5) + (mentions(headText, d.term) ? 0.2 : 0);
  }

  const cands: Cand[] = [];

  // Choices only make sense with at least 3 definitions to pick from.
  if (defs.length >= 3) {
    // 2. Definition questions, asked in either direction
    for (const d of defs) {
      const answerDef = tidy(d.def);
      let item: Question;
      if (Math.random() < 0.5) {
        // Wrong terms: same section, similar shape, and not mentioned in the definition itself.
        const wrong = top(
          defs.filter((x) => x !== d),
          (o) => (mentions(d.def, o.term) ? -Infinity : termFit(d, o)),
        );
        const options = shuffle([d.term, ...wrong.map((o) => o.term)]);
        const masked = answerDef.replace(new RegExp(escapeRe(d.term), "gi"), "_____");
        item = {
          kind: "def",
          q: `Which term matches this definition?\n“${masked}”`,
          options,
          answer: options.indexOf(d.term),
          why: d.src,
          front: d.term,
          back: answerDef,
        };
      } else {
        const wrong = top(defs.filter((x) => x !== d), (o) => defFit(d, o));
        const options = shuffle([answerDef, ...wrong.map((o) => tidy(o.def))].map(short));
        item = {
          kind: "def",
          q: `Which definition best describes “${d.term}”?`,
          options,
          answer: options.indexOf(short(answerDef)),
          why: d.src,
          front: d.term,
          back: answerDef,
        };
      }
      cands.push({ item, score: d.score, sec: d.sec });
    }

    // 3. Fill in the blank: a defined term that shows up in another sentence.
    // The most central sentences are tried first, and the most important term in each is blanked.
    const byImportance = [...defs].sort((a, b) => b.score - a.score);
    let clozes = 0;
    for (const { text: s, sec } of ranked(sents, (x) => cent(x.text))) {
      if (clozes >= 15) break;
      const n = s.split(" ").length;
      if (used.has(s) || n < 8 || n > 30 || startsImperative(s) || (s.match(/,/g) ?? []).length > 2) continue;
      let hit: Def | undefined;
      let matched = "";
      for (const d of byImportance) {
        const found = s.match(new RegExp(`\\b${escapeRe(d.term)}\\b`, "i"));
        if (found) {
          hit = d;
          matched = found[0];
          break;
        }
      }
      if (!hit) continue;
      // Match the capital letters of the sentence, except for acronyms like DNS
      const fit = (t: string) =>
        matched[0] === matched[0].toLowerCase() && t !== t.toUpperCase() ? t[0].toLowerCase() + t.slice(1) : t;
      // Wrong terms must not already appear in the sentence, or they would be easy to rule out.
      const wrong = top(
        defs.filter((x) => x !== hit),
        (o) => (mentions(s, o.term) ? -Infinity : termFit(hit, o, sec)),
      );
      const answerText = fit(hit.term);
      const options = shuffle([answerText, ...wrong.map((o) => fit(o.term))]);
      const blanked = s.replace(new RegExp(`\\b${escapeRe(hit.term)}\\b`, "i"), "_____");
      used.add(s);
      cands.push({
        item: {
          kind: "cloze",
          q: `Fill in the blank:\n${blanked}`,
          options,
          answer: options.indexOf(answerText),
          why: s,
          front: blanked,
          back: `${answerText}\n\n${s}`,
        },
        score: 0.85 * (0.6 * cent(s) + 0.4 * hit.score),
        sec,
      });
      clozes++;
    }
  }

  // 4. Facts from ordinary paragraphs: blank a name or a number, and use other
  // names or numbers from the same notes (preferably the same section) as the wrong choices.
  const NAME_RE = /\b[A-Z][a-z]{2,}(?:(?:\s(?:de|del|of|the|la|las|los|na|ng))?\s[A-Z][a-z]{2,})*\b/g;
  const NUM_RE = /\b\d[\d,]*(?:\.\d+)?%?/g;
  const digits = (x: string) => x.replace(/\D/g, "").length;
  const lowerWords = new Set(clean.match(/\b[a-z]{3,}\b/g) ?? []);
  const nameCount: Record<string, number> = {};
  for (const s of sentences) {
    for (const m of s.matchAll(NAME_RE)) if (m.index !== 0) nameCount[m[0]] = (nameCount[m[0]] || 0) + 1;
  }
  const find = (s: string, kind: "name" | "num") =>
    [...s.matchAll(kind === "name" ? NAME_RE : NUM_RE)]
      .filter((m) =>
        kind === "name"
          ? m.index !== 0 &&
            !NOT_A_TERM.has(m[0].split(" ")[0].toLowerCase()) &&
            !LABELS.has(m[0].toLowerCase()) &&
            (nameCount[m[0]] ?? 0) >= 2 &&
            (m[0].includes(" ") || !lowerWords.has(m[0].toLowerCase()))
          : digits(m[0]) >= 2,
      )
      .map((m) => m[0]);
  const pool = { name: new Map<string, number>(), num: new Map<string, number>() };
  for (const { text: s, sec } of sents) {
    for (const x of find(s, "name")) if (!pool.name.has(x)) pool.name.set(x, sec);
    for (const x of find(s, "num")) if (!pool.num.has(x)) pool.num.set(x, sec);
  }
  let facts = 0;
  for (const { text: s, sec } of ranked(sents, (x) => cent(x.text))) {
    if (facts >= 15) break;
    const n = s.split(" ").length;
    if (used.has(s) || n < 8 || n > 35 || startsImperative(s) || !/[.!]$/.test(s) || (s.match(/,/g) ?? []).length > 2) continue;
    for (const kind of shuffle(["name", "num"] as const)) {
      const answerText = find(s, kind)[0];
      if (!answerText) continue;
      const choices = [...pool[kind].keys()].filter(
        (x) => x !== answerText && !s.includes(x) && (kind === "name" || digits(x) === digits(answerText)),
      );
      if (choices.length < 3) continue;
      const wrong = top(
        choices,
        (x) =>
          (pool[kind].get(x) === sec ? 0.5 : 0) +
          (kind === "name"
            ? Math.max(0, 0.2 - 0.07 * Math.abs(wc(x) - wc(answerText)))
            : (x.endsWith("%") === answerText.endsWith("%") ? 0.1 : 0) + (/[.,]/.test(x) === /[.,]/.test(answerText) ? 0.1 : 0)) +
          Math.random() * 0.25,
      );
      const blanked = s.split(answerText).join("_____");
      const options = shuffle([answerText, ...wrong]);
      used.add(s);
      cands.push({
        item: {
          kind: "cloze",
          q: `Fill in the blank:\n${blanked}`,
          options,
          answer: options.indexOf(answerText),
          why: s,
          front: blanked,
          back: `${answerText}\n\n${s}`,
        },
        score: 0.7 * cent(s),
        sec,
      });
      facts++;
      break;
    }
  }

  // 5. Choose the best questions across all sections and label each with its topic.
  const items = select(cands, count).map((item) => {
    const topic = topics[secOf.get(item.why) ?? 0];
    return topic ? { ...item, topic } : item;
  });

  return {
    items,
    words: clean.split(/\s+/).length,
    defs: defs.length,
    sections: sections.length,
  };
}

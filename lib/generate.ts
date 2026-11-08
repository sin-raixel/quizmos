import type { Question } from "./types";

// No AI here: questions come from plain pattern matching on the text.
// Every wrong answer is taken from the same notes (other terms or other definitions),
// so the choices look like they belong to the same lesson.

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

export function buildQuestions(text: string, count = 25) {
  // Lines that wrap mid-sentence (common in PDFs) are joined back together.
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/([^\n.!?:;])\n(?=[a-z(,])/g, "$1 ");
  const sentences = clean
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[-•*\d.)\s]+/, ""))
    .filter((s) => {
      const n = s.split(" ").length;
      return n >= 5 && n <= 40 && !/[→⇒➔➜•·|]|->|=>/.test(s) && !/\?$/.test(s);
    });

  // 1. Find the definitions
  const defs: { term: string; def: string; src: string }[] = [];
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const s of sentences) {
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
    defs.push({ term, def: m[2].trim(), src: s });
  }

  const items: Question[] = [];

  // Choices only make sense with at least 3 definitions to pick from.
  if (defs.length >= 3) {
    // 2. Definition questions, asked in either direction
    for (const d of defs) {
      const others = shuffle(defs.filter((x) => x !== d)).slice(0, 3);
      const answerDef = tidy(d.def);
      if (Math.random() < 0.5) {
        const options = shuffle([d.term, ...others.map((o) => o.term)]);
        const masked = answerDef.replace(new RegExp(escapeRe(d.term), "gi"), "_____");
        items.push({
          kind: "def",
          q: `Which term matches this definition?\n“${masked}”`,
          options,
          answer: options.indexOf(d.term),
          why: d.src,
          front: d.term,
          back: answerDef,
        });
      } else {
        const options = shuffle([answerDef, ...others.map((o) => tidy(o.def))].map(short));
        items.push({
          kind: "def",
          q: `Which definition best describes “${d.term}”?`,
          options,
          answer: options.indexOf(short(answerDef)),
          why: d.src,
          front: d.term,
          back: answerDef,
        });
      }
    }

    // 3. Fill in the blank: a defined term that shows up in another sentence
    let clozes = 0;
    for (const s of shuffle(sentences)) {
      if (clozes >= 15) break;
      const n = s.split(" ").length;
      if (used.has(s) || n < 8 || n > 30 || startsImperative(s) || (s.match(/,/g) ?? []).length > 2) continue;
      let hit: (typeof defs)[number] | undefined;
      let matched = "";
      for (const d of shuffle(defs)) {
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
      const others = shuffle(defs.filter((x) => x !== hit)).slice(0, 3);
      const answerText = fit(hit.term);
      const options = shuffle([answerText, ...others.map((o) => fit(o.term))]);
      items.push({
        kind: "cloze",
        q: `Fill in the blank:\n${s.replace(new RegExp(`\\b${escapeRe(hit.term)}\\b`, "i"), "_____")}`,
        options,
        answer: options.indexOf(answerText),
        why: s,
        front: s.replace(new RegExp(`\\b${escapeRe(hit.term)}\\b`, "i"), "_____"),
        back: `${answerText}\n\n${s}`,
      });
      clozes++;
    }
  }

  // 4. Facts from ordinary paragraphs: blank a name or a number, and use other
  // names or numbers from the same notes as the wrong choices.
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
  const pool = { name: new Set<string>(), num: new Set<string>() };
  for (const s of sentences) {
    find(s, "name").forEach((x) => pool.name.add(x));
    find(s, "num").forEach((x) => pool.num.add(x));
  }
  let facts = 0;
  for (const s of shuffle(sentences)) {
    if (facts >= 15) break;
    const n = s.split(" ").length;
    if (used.has(s) || n < 8 || n > 35 || startsImperative(s) || !/[.!]$/.test(s) || (s.match(/,/g) ?? []).length > 2) continue;
    for (const kind of shuffle(["name", "num"] as const)) {
      const answerText = find(s, kind)[0];
      if (!answerText) continue;
      const wrong = shuffle(
        [...pool[kind]].filter((x) => x !== answerText && !s.includes(x) && (kind === "name" || digits(x) === digits(answerText))),
      ).slice(0, 3);
      if (wrong.length < 3) continue;
      const blanked = s.split(answerText).join("_____");
      const options = shuffle([answerText, ...wrong]);
      items.push({
        kind: "cloze",
        q: `Fill in the blank:\n${blanked}`,
        options,
        answer: options.indexOf(answerText),
        why: s,
        front: blanked,
        back: `${answerText}\n\n${s}`,
      });
      facts++;
      break;
    }
  }

  return {
    items: shuffle(items).slice(0, count),
    words: clean.split(/\s+/).length,
    defs: defs.length,
  };
}

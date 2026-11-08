// Grading for enumeration questions: typed answers are matched to the expected items
// in any order, ignoring capitalisation, punctuation, "the/a/an", and one small typo.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u00c0-\uffff\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function same(typed: string, accepted: string): boolean {
  const a = norm(typed);
  const b = norm(accepted);
  if (!a || !b) return false;
  if (a === b || a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const longest = Math.max(a.length, b.length);
  return longest >= 6 && distance(a, b) <= (longest >= 12 ? 2 : 1);
}

export function gradeEnum(items: string[], typed: string[]) {
  const used = new Set<number>();
  const matches = typed.map((text) => {
    const found = items.findIndex((item, i) => !used.has(i) && item.split("|").some((alt) => same(text, alt)));
    if (found === -1) return false;
    used.add(found);
    return true;
  });
  return { matches, correct: used.size === items.length };
}

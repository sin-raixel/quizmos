import type { Question } from "./types";

// Flashcards use each question's front and back, the same text the Flashcards tab shows.

const tidy = (s: string) => s.replace(/\t/g, " ").trim();

// Anki accepts HTML in fields, so escape the text and turn line breaks into <br>.
const html = (s: string) => tidy(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
// Quizlet wants one line per card, so line breaks become spaces.
const oneLine = (s: string) => tidy(s).replace(/\s*\n+\s*/g, " ");

// File > Import in Anki. The first two lines tell Anki the separator and that fields contain HTML.
export const toAnki = (items: Question[]) =>
  ["#separator:tab", "#html:true", ...items.map((q) => `${html(q.front)}\t${html(q.back)}`)].join("\n") + "\n";

// Quizlet > Create > Import: tab between term and definition, new line between cards.
export const toQuizlet = (items: Question[]) => items.map((q) => `${oneLine(q.front)}\t${oneLine(q.back)}`).join("\n") + "\n";

export const fileName = (title: string, suffix: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "quizmos"}-${suffix}.txt`;

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

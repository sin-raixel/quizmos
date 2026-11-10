export type Format = "mcq" | "tf" | "multi" | "enum";

export type Question = {
  kind: "def" | "cloze" | "ai";
  format?: Format; // missing means multiple choice (the free method only makes those)
  q: string; // the prompt shown in the quiz
  options: string[]; // choices (mcq, multi) or ["True", "False"] (tf); empty for enumeration
  answer: number; // index of the correct option (first correct one for multi; unused for enum)
  answers?: number[]; // multi: indexes of every correct option
  items?: string[]; // enum: the answers; alternatives for one answer are separated by "|"
  why: string; // the sentence from the notes this came from
  front: string; // flashcard front
  back: string; // flashcard back
  topic?: string; // optional label used to group questions in the stats
};

export const formatOf = (q: Question): Format => q.format ?? "mcq";

export const FORMAT_LABEL: Record<Format, string> = {
  mcq: "Multiple choice",
  tf: "True or false",
  multi: "Select all that apply",
  enum: "Enumeration",
};

// The correct answer as one readable string (used in feedback, the editor, and flashcards).
export function answerText(q: Question): string {
  switch (formatOf(q)) {
    case "enum":
      return (q.items ?? []).map((item) => item.split("|")[0].trim()).join(", ");
    case "multi":
      return (q.answers ?? [q.answer]).map((i) => q.options[i]).join("; ");
    default:
      return q.options[q.answer] ?? "";
  }
}
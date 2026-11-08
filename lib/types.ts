export type Question = {
  kind: "def" | "cloze" | "ai";
  q: string; // the prompt shown in the quiz
  options: string[];
  answer: number; // index of the correct option
  why: string; // the sentence from the notes this came from
  front: string; // flashcard front
  back: string; // flashcard back
};

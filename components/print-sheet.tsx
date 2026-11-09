import { answerText, formatOf } from "../lib/types";
import type { Question } from "../lib/types";

// Hidden on screen. When printing, this is the only thing on the page (see .print-sheet in globals.css).
export default function PrintSheet({ items, title }: { items: Question[]; title: string }) {
  if (items.length === 0) return null;

  return (
    <div className="print-sheet" aria-hidden="true">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm">
        Name: ______________________ &nbsp; Date: ____________ &nbsp; Score: ______ / {items.length}
      </p>

      <div className="mt-6 space-y-5 text-sm">
        {items.map((q, i) => {
          const format = formatOf(q);
          return (
            <div key={i} className="break-inside-avoid">
              <p className="whitespace-pre-line">
                <b>{i + 1}.</b> {q.q}
              </p>
              {format === "tf" && <p className="mt-1 pl-5">( ) True &nbsp;&nbsp; ( ) False</p>}
              {(format === "mcq" || format === "multi") &&
                q.options.map((option, j) => (
                  <p key={j} className="mt-0.5 pl-5">
                    {String.fromCharCode(65 + j)}. {option}
                  </p>
                ))}
              {format === "enum" &&
                Array.from({ length: q.items?.length ?? 3 }, (_, j) => (
                  <p key={j} className="mt-2 pl-5">
                    {j + 1}. ______________________________
                  </p>
                ))}
            </div>
          );
        })}
      </div>

      <section className="mt-10 text-sm" style={{ breakBefore: "page" }}>
        <h2 className="text-xl font-bold">Answer key</h2>
        <div className="mt-4 space-y-3">
          {items.map((q, i) => (
            <div key={i} className="break-inside-avoid">
              <p>
                <b>{i + 1}.</b> {formatOf(q) === "mcq" || formatOf(q) === "multi" ? answerLetters(q) : answerText(q)}
              </p>
              {q.why && <p className="pl-5 text-xs">{q.why}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// "B. Siltation" or "A. First; C. Third" so the key matches the lettered options.
function answerLetters(q: Question): string {
  const picks = formatOf(q) === "multi" ? (q.answers ?? [q.answer]) : [q.answer];
  return picks.map((i) => `${String.fromCharCode(65 + i)}. ${q.options[i]}`).join("; ");
}

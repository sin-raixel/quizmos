import { describe, expect, it } from "vitest";
import { fileName, toAnki, toQuizlet } from "./export";
import { question } from "./fixtures";

const card = question({ front: "Router", back: "Forwards <packets> & more\nSecond line" });

describe("export", () => {
  it("writes an Anki file with headers, escaped HTML, and <br> for line breaks", () => {
    expect(toAnki([card]).split("\n")).toEqual([
      "#separator:tab",
      "#html:true",
      "Router\tForwards &lt;packets&gt; &amp; more<br>Second line",
      "",
    ]);
  });

  it("writes a Quizlet file with one line per card", () => {
    expect(toQuizlet([card])).toBe("Router\tForwards <packets> & more Second line\n");
  });

  it("keeps tabs inside a card from breaking the columns", () => {
    expect(toQuizlet([question({ front: "A\tB", back: "C" })])).toBe("A B\tC\n");
  });

  it("makes safe file names", () => {
    expect(fileName("Network Basics!", "anki")).toBe("network-basics-anki.txt");
    expect(fileName("???", "quizlet")).toBe("quizmos-quizlet.txt");
  });
});

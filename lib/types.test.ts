import { describe, expect, it } from "vitest";
import { question } from "./fixtures";
import { answerText, formatOf } from "./types";

describe("answerText / formatOf", () => {
  it("treats a question with no format as multiple choice", () => {
    expect(formatOf(question())).toBe("mcq");
    expect(answerText(question({ options: ["A", "B"], answer: 1 }))).toBe("B");
  });

  it("joins every correct option for select-all", () => {
    expect(answerText(question({ format: "multi", options: ["A", "B", "C"], answer: 0, answers: [0, 2] }))).toBe("A; C");
  });

  it("shows the first accepted spelling for each enumeration item", () => {
    expect(answerText(question({ format: "enum", options: [], items: ["Carbon dioxide|CO2", "Water"] }))).toBe("Carbon dioxide, Water");
  });
});

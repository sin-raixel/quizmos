import { describe, expect, it } from "vitest";
import { clampCount, outputTokens, parse, promptFor } from "./ai";

const mcq = {
  type: "mcq",
  question: "What is the capital of France?",
  options: ["Paris", "Rome", "Madrid", "Berlin"],
  answerIndex: 0,
  explanation: "Paris is the capital.",
  cardFront: "Capital of France?",
  cardBack: "Paris",
};
const json = (items: unknown[]) => JSON.stringify(items);

describe("parse (checks the AI's answer before it is used)", () => {
  it("reads a multiple-choice question and keeps the right answer after shuffling", () => {
    const [item] = parse(json([mcq]));
    expect(item.kind).toBe("ai");
    expect(item.format).toBe("mcq");
    expect(item.options[item.answer]).toBe("Paris");
    expect([...item.options].sort()).toEqual(["Berlin", "Madrid", "Paris", "Rome"]);
  });

  it("accepts an answer wrapped in a code fence", () => {
    expect(parse("```json\n" + json([mcq]) + "\n```")).toHaveLength(1);
  });

  it("reads true or false, including the answer as text", () => {
    const [yes, no] = parse(
      json([
        { type: "tf", question: "The sky is blue.", answer: true, explanation: "It is." },
        { type: "tf", question: "Fish can fly.", answer: "false", explanation: "They can't." },
      ]),
    );
    expect(yes.options).toEqual(["True", "False"]);
    expect(yes.answer).toBe(0);
    expect(no.answer).toBe(1);
    expect(yes.front).toBe("True or false: The sky is blue.");
  });

  it("reads select-all and keeps every correct option correct after shuffling", () => {
    const [item] = parse(
      json([{ type: "multi", question: "Pick the vowels. Select all that apply.", options: ["A", "B", "C", "D", "F"], answerIndexes: [0, 2], explanation: "A and C." }]),
    );
    expect(item.format).toBe("multi");
    expect(new Set(item.answers!.map((i) => item.options[i]))).toEqual(new Set(["A", "C"]));
  });

  it("reads enumeration questions", () => {
    const [item] = parse(json([{ type: "enum", question: "List the three states of matter.", answers: ["Solid", "Liquid", "Gas"], explanation: "Basics." }]));
    expect(item.format).toBe("enum");
    expect(item.items).toEqual(["Solid", "Liquid", "Gas"]);
    expect(item.back).toContain("Solid, Liquid, Gas");
  });

  it("drops bad questions and keeps the good ones", () => {
    const result = parse(
      json([
        mcq,
        { ...mcq, options: ["A", "A", "B", "C"] }, // duplicate options
        { ...mcq, answerIndex: 9 }, // answer out of range
        { type: "tf", question: "Maybe?", answer: "maybe" }, // not true or false
        { question: "   " }, // empty question
        null,
      ]),
    );
    expect(result).toHaveLength(1);
  });

  it("throws when nothing is usable", () => {
    expect(() => parse(json([{ ...mcq, answerIndex: 9 }]))).toThrow();
    expect(() => parse("{}")).toThrow();
    expect(() => parse("not json at all")).toThrow();
  });
});

describe("limits and prompt", () => {
  it("keeps the question count between 1 and 50, defaulting to 25", () => {
    expect(clampCount(100)).toBe(50);
    expect(clampCount(-5)).toBe(1);
    expect(clampCount(7.6)).toBe(8);
    expect(clampCount(NaN)).toBe(25);
  });

  it("asks for enough output room", () => {
    expect(outputTokens(5)).toBe(4096);
    expect(outputTokens(50)).toBe(20000);
  });

  it("puts the requested number in the prompt", () => {
    expect(promptFor(10)).toContain("Write 10 questions that test");
    expect(promptFor(1)).toContain("Write 1 question that tests");
  });
});

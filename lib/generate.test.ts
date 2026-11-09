import { describe, expect, it } from "vitest";
import { buildQuestions } from "./generate";
import { SAMPLE_NOTES } from "./fixtures";

describe("buildQuestions", () => {
  it("finds the definitions in clean notes", () => {
    expect(buildQuestions(SAMPLE_NOTES).defs).toBeGreaterThanOrEqual(10);
  });

  it("makes questions whose answer index points at a real, distinct option", () => {
    const { items } = buildQuestions(SAMPLE_NOTES);
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.options.length).toBeGreaterThanOrEqual(3);
      expect(item.options[item.answer]).toBeTruthy();
      expect(new Set(item.options.map((o) => o.toLowerCase())).size).toBe(item.options.length);
      expect(item.front).not.toBe("");
      expect(item.back).not.toBe("");
    }
  });

  it("never gives away the answer in a 'which term' question", () => {
    for (const item of buildQuestions(SAMPLE_NOTES).items) {
      if (!item.q.startsWith("Which term")) continue;
      expect(item.q.toLowerCase()).not.toContain(item.options[item.answer].toLowerCase());
    }
  });

  it("skips headings, exercises, and questions in the notes", () => {
    const notes = `${SAMPLE_NOTES}
Causes: burning fossil fuels, deforestation, and agriculture across many regions.
Compute the speed of a packet that travels 300 kilometres in 2 seconds on the network.
Why is the router the best first device for a small office with 50 users?
`;
    const { items } = buildQuestions(notes);
    expect(items.some((i) => i.front === "Causes" || i.options.includes("Causes"))).toBe(false);
    expect(items.some((i) => i.q.includes("Compute"))).toBe(false);
    expect(items.some((i) => i.q.includes("small office"))).toBe(false);
  });

  it("returns no questions, and does not crash, when there is nothing to ask about", () => {
    expect(buildQuestions("Too short to ask about.").items).toEqual([]);
    expect(buildQuestions("").items).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buildQuestions } from "./generate";
import { SAMPLE_NOTES, SECTIONED_NOTES } from "./fixtures";

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

  it("does not turn headings into questions", () => {
    for (let run = 0; run < 20; run++) {
      for (const item of buildQuestions(SECTIONED_NOTES).items) {
        expect(item.q).not.toContain("Networking Hardware");
        expect(item.options).not.toContain("Networking Hardware");
        expect(item.options).not.toContain("Network Protocols");
      }
    }
  });

  it("labels questions with the heading they came from", () => {
    const { items, sections } = buildQuestions(SECTIONED_NOTES);
    expect(sections).toBe(2);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(["Networking Hardware", "Network Protocols"]).toContain(item.topic);
      const hardware = /router|switch|firewall|modem/i.test(item.why);
      const protocols = /HTTP|DNS|DHCP|FTP/.test(item.why);
      if (hardware && !protocols) expect(item.topic).toBe("Networking Hardware");
      if (protocols && !hardware) expect(item.topic).toBe("Network Protocols");
    }
  });

  it("sets no topic when the notes have no sections", () => {
    const { items, sections } = buildQuestions(SAMPLE_NOTES);
    expect(sections).toBe(1);
    expect(items.every((i) => i.topic === undefined)).toBe(true);
  });

  it("spreads a small quiz over every section", () => {
    for (let run = 0; run < 20; run++) {
      const topics = new Set(buildQuestions(SECTIONED_NOTES, 6).items.map((i) => i.topic));
      expect(topics.size).toBe(2);
    }
  });

  it("prefers wrong answers from the same section", () => {
    // 'Which term' questions about a hardware definition should mostly offer hardware terms.
    const hardware = new Set(["Router", "Switch", "Firewall", "Modem"]);
    let same = 0;
    let total = 0;
    for (let run = 0; run < 40; run++) {
      for (const item of buildQuestions(SECTIONED_NOTES, 50).items) {
        if (!item.q.startsWith("Which term") || !hardware.has(item.options[item.answer])) continue;
        total++;
        if (item.options.every((o) => hardware.has(o))) same++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(same / total).toBe(1);
  });

  it("never leaves a wrong choice that already appears in the fill-in-the-blank sentence", () => {
    for (let run = 0; run < 30; run++) {
      for (const item of buildQuestions(SAMPLE_NOTES, 50).items) {
        if (item.kind !== "cloze") continue;
        const wrong = item.options.filter((_, i) => i !== item.answer);
        for (const w of wrong) expect(item.q.toLowerCase()).not.toContain(w.toLowerCase());
      }
    }
  });

  it("does not offer a wrong definition that contains the word being asked about", () => {
    // (When every other definition mentions the term, as with "network" in a networking lesson,
    // there is no clean choice, so those are allowed as a fallback and not checked here.)
    for (let run = 0; run < 30; run++) {
      for (const item of buildQuestions(SECTIONED_NOTES, 50).items) {
        const m = item.q.match(/^Which definition best describes “(.+)”\?$/);
        if (!m) continue;
        item.options.forEach((o, i) => {
          if (i !== item.answer) expect(o.toLowerCase()).not.toContain(` ${m[1].toLowerCase()} `);
        });
      }
    }
  });
});

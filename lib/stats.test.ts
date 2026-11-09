import { describe, expect, it } from "vitest";
import { question } from "./fixtures";
import { parseBackup } from "./history";
import { addAttempt, byFormat, byTopic, cleanAttempts, hashQ, makeAttempt, MAX_ATTEMPTS, questionStats, summarize, trend, weakest } from "./stats";

const a = question({ q: "Alpha?", topic: "Nets" });
const b = question({ q: "Beta?", topic: "Nets" });
const c = question({ q: "Gamma?", format: "tf", options: ["True", "False"], topic: "Security" });
const all = [a, b, c];

describe("makeAttempt", () => {
  it("scores a full run and records which questions were missed", () => {
    const at = makeAttempt(all, [b], 3, 100);
    expect(at).toMatchObject({ at: 100, score: 2, total: 3, full: true, missed: [hashQ(b)] });
    expect(at.asked).toEqual(all.map(hashQ));
  });

  it("marks a short run (retry or practice) as not full", () => {
    expect(makeAttempt([b], [], 3).full).toBe(false);
  });
});

describe("hashQ", () => {
  it("ignores case and spacing around the text but separates different formats", () => {
    expect(hashQ(question({ q: " ALPHA? " }))).toBe(hashQ(question({ q: "alpha?" })));
    expect(hashQ(question({ q: "x" }))).not.toBe(hashQ(question({ q: "x", format: "tf" })));
  });
});

describe("summarize and trend", () => {
  const runs = [makeAttempt(all, [a, b], 3), makeAttempt(all, [], 3), makeAttempt([a], [a], 3), makeAttempt(all, [c], 3)];
  it("uses only full runs", () => {
    expect(summarize(runs)).toEqual({ attempts: 3, best: 100, average: 67, last: 67 });
    expect(trend(runs)).toEqual([33, 100, 67]);
  });
  it("returns null with no full run", () => {
    expect(summarize([])).toBeNull();
    expect(summarize(undefined)).toBeNull();
    expect(summarize([makeAttempt([a], [], 3)])).toBeNull();
  });
});

describe("questionStats, weakest, and groups", () => {
  const runs = [makeAttempt(all, [a, b], 3), makeAttempt(all, [a], 3), makeAttempt([a, b], [], 3)];
  const stats = questionStats(all, runs);

  it("tallies asked and missed per question", () => {
    expect(stats.map((s) => [s.q.q, s.asked, s.missed])).toEqual([["Alpha?", 3, 2], ["Beta?", 3, 1], ["Gamma?", 2, 0]]);
  });
  it("lists only missed questions, worst first", () => {
    expect(weakest(stats).map((s) => s.q.q)).toEqual(["Alpha?", "Beta?"]);
    expect(weakest(stats, 1)).toHaveLength(1);
  });
  it("ignores questions that were deleted since", () => {
    expect(questionStats([c], runs)).toHaveLength(1);
  });
  it("groups by type and topic, weakest first", () => {
    expect(byFormat(stats).map((g) => [g.label, g.correct, g.asked])).toEqual([["Multiple choice", 3, 6], ["True or false", 2, 2]]);
    expect(byTopic(stats).map((g) => g.label)).toEqual(["Nets", "Security"]);
  });
  it("has no topic groups when questions have no topic", () => {
    expect(byTopic(questionStats([question({ q: "x" })], [makeAttempt([question({ q: "x" })], [], 1)]))).toEqual([]);
  });
});

describe("addAttempt", () => {
  it("keeps only the most recent attempts", () => {
    let list = undefined as ReturnType<typeof addAttempt> | undefined;
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) list = addAttempt(list, makeAttempt(all, [], 3, i));
    expect(list).toHaveLength(MAX_ATTEMPTS);
    expect(list![0].at).toBe(5);
  });
});

describe("stored attempts are untrusted", () => {
  it("drops malformed attempts", () => {
    const good = makeAttempt(all, [a], 3);
    expect(cleanAttempts([good, { nope: 1 }, { ...good, score: 99 }, { ...good, asked: [1] }, null])).toEqual([good]);
    expect(cleanAttempts("x")).toEqual([]);
  });
  it("keeps a reviewer in a backup even if its attempts are damaged", () => {
    const good = makeAttempt(all, [a], 3);
    const text = JSON.stringify([
      { id: "1", title: "T", createdAt: 1, items: [question()], attempts: [good, { bad: true }] },
      { id: "2", title: "Old", createdAt: 1, items: [question()] },
    ]);
    const out = parseBackup(text);
    expect(out[0].attempts).toEqual([good]);
    expect(out[1].attempts).toBeUndefined();
  });
});

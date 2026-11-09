import { describe, expect, it } from "vitest";
import { question } from "./fixtures";
import { parseBackup } from "./history";

const saved = (over: object = {}) => ({ id: "1", title: "Notes", createdAt: 1, items: [question()], ...over });

describe("parseBackup (a backup file is untrusted)", () => {
  it("restores valid reviewers", () => {
    expect(parseBackup(JSON.stringify([saved(), saved({ id: "2" })]))).toHaveLength(2);
  });

  it("skips broken entries but keeps good ones", () => {
    const text = JSON.stringify([saved(), saved({ id: 5 }), saved({ items: [] }), { nope: true }]);
    expect(parseBackup(text)).toHaveLength(1);
  });

  it("rejects files that are not a backup", () => {
    expect(() => parseBackup("not json")).toThrow(/backup/);
    expect(() => parseBackup(JSON.stringify({ a: 1 }))).toThrow(/backup/);
    expect(() => parseBackup(JSON.stringify([{ nope: true }]))).toThrow(/No reviewers/);
  });
});

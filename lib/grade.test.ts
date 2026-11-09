import { describe, expect, it } from "vitest";
import { gradeEnum } from "./grade";

describe("gradeEnum", () => {
  it("accepts the answers in any order, and accepted alternatives", () => {
    const result = gradeEnum(["Carbon dioxide|CO2", "Water", "Oxygen"], ["water", "co2", "oxygen"]);
    expect(result.correct).toBe(true);
    expect(result.matches).toEqual([true, true, true]);
  });

  it("forgives capitalisation, 'the', and one small typo", () => {
    expect(gradeEnum(["The mitochondria"], ["Mitochondria"]).correct).toBe(true);
    expect(gradeEnum(["Oxygen"], ["Oxigen"]).correct).toBe(true);
  });

  it("does not forgive typos in short words or wrong answers", () => {
    expect(gradeEnum(["cat"], ["car"]).correct).toBe(false);
    expect(gradeEnum(["Oxygen"], ["Nitrogen"]).correct).toBe(false);
  });

  it("is not correct when an item is missing", () => {
    expect(gradeEnum(["Solid", "Liquid", "Gas"], ["Solid", "Liquid"]).correct).toBe(false);
  });

  it("does not count the same item twice", () => {
    const result = gradeEnum(["Water", "Oxygen"], ["water", "water"]);
    expect(result.matches).toEqual([true, false]);
    expect(result.correct).toBe(false);
  });
});

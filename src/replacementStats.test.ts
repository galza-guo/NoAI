import { describe, expect, it } from "vitest";
import { formatHitMultiplier, formatReplacementTotals } from "./replacementStats";

describe("replacement list stats", () => {
  it("formats row hit counts as compact multipliers", () => {
    expect(formatHitMultiplier({ count: 1 })).toBe("x1");
    expect(formatHitMultiplier({ count: 5 })).toBe("x5");
  });

  it("formats total rule and replacement counts", () => {
    expect(formatReplacementTotals([{ count: 1 }])).toBe(
      "1 rule, 1 replacement",
    );
    expect(formatReplacementTotals([{ count: 2 }, { count: 3 }])).toBe(
      "2 rules, 5 replacements",
    );
  });
});

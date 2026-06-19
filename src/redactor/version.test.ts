import { describe, expect, it } from "vitest";
import {
  CHINESE_RULES_VERSION,
  ENGINE_VERSION,
  ENGINE_VERSION_INFO,
  ENGINE_VERSION_LABEL,
  GENERAL_RULES_VERSION,
} from "./version";

describe("redaction engine version metadata", () => {
  it("exposes a readable label and machine-readable split ruleset versions", () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(GENERAL_RULES_VERSION).toBeGreaterThanOrEqual(1);
    expect(CHINESE_RULES_VERSION).toBeGreaterThanOrEqual(1);
    expect(ENGINE_VERSION_LABEL).toBe(
      `NoAI redaction engine ${ENGINE_VERSION} (general r${GENERAL_RULES_VERSION}, chinese r${CHINESE_RULES_VERSION})`,
    );
    expect(ENGINE_VERSION_INFO).toEqual({
      engine: ENGINE_VERSION,
      label: ENGINE_VERSION_LABEL,
      rulesets: {
        general: GENERAL_RULES_VERSION,
        chinese: CHINESE_RULES_VERSION,
      },
    });
  });
});

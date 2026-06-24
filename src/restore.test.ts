import { describe, expect, it } from "vitest";
import { isSafeRestoreToken } from "./restore";

describe("restore token safety", () => {
  it("accepts machine-style tokens", () => {
    expect(isSafeRestoreToken("PERSON_001")).toBe(true);
    expect(isSafeRestoreToken("ORG_002")).toBe(true);
    expect(isSafeRestoreToken("CUSTOM_123")).toBe(true);
  });

  it("rejects human-friendly labels", () => {
    expect(isSafeRestoreToken("Client")).toBe(false);
    expect(isSafeRestoreToken("Company")).toBe(false);
    expect(isSafeRestoreToken("A")).toBe(false);
    expect(isSafeRestoreToken("Supplier")).toBe(false);
  });
});

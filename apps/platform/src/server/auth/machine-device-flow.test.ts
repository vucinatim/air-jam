import { describe, expect, it } from "vitest";
import {
  formatMachineUserCode,
  normalizeMachineUserCode,
} from "./machine-device-flow";

describe("machine device flow helpers", () => {
  it("normalizes and formats user codes consistently", () => {
    expect(normalizeMachineUserCode("ab cd-efgh")).toBe("ABCDEFGH");
    expect(formatMachineUserCode("ab cd-efgh")).toBe("ABCD-EFGH");
  });
});

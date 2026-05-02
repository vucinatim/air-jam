// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAirJamContext } from "../src/context/air-jam-context";
import { useAssertSessionScope } from "../src/context/session-scope";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";

describe("diagnostics behavior", () => {
  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);
  });

  afterEach(() => {
    resetAirJamDiagnosticsForTests();
  });

  it("emits AJ_SCOPE_MISMATCH when a scoped hook is used outside required scope", () => {
    const codes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      codes.push(diagnostic.code);
    });

    expect(() =>
      renderHook(() => useAssertSessionScope("host", "useAirJamHost")),
    ).toThrow("[AirJam][AJ_SCOPE_MISMATCH]");

    expect(codes).toContain("AJ_SCOPE_MISMATCH");
    unsubscribe();
  });

  it("emits AJ_MISSING_SESSION_PROVIDER when context is read outside provider", () => {
    const codes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      codes.push(diagnostic.code);
    });

    expect(() => renderHook(() => useAirJamContext())).toThrow(
      "[AirJam][AJ_MISSING_SESSION_PROVIDER]",
    );

    expect(codes).toContain("AJ_MISSING_SESSION_PROVIDER");
    unsubscribe();
  });
});

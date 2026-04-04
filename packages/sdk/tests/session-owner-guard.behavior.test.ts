// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
} from "../src/diagnostics";
import {
  ControllerSessionProvider,
  HostSessionProvider,
  useClaimSessionRuntimeOwner,
} from "../src/context/session-providers";

const PROVIDER_CONFIG = {
  serverUrl: "http://localhost:3001",
  appId: "test_app_id",
};

const ControllerProviderForTest = ControllerSessionProvider as React.ComponentType<any>;
const HostProviderForTest = HostSessionProvider as React.ComponentType<any>;

const ClaimOwner = ({
  kind,
  hookName,
}: {
  kind: "host-runtime" | "controller-runtime";
  hookName: string;
}) => {
  useClaimSessionRuntimeOwner(kind, hookName);
  return null;
};

describe("session owner guard", () => {
  afterEach(() => {
    resetAirJamDiagnosticsForTests();
    vi.restoreAllMocks();
  });

  it("rejects duplicate controller runtime owners in one provider tree", async () => {
    const diagnostics: string[] = [];
    const stop = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() =>
      render(
        React.createElement(
          ControllerProviderForTest,
          PROVIDER_CONFIG,
          React.createElement(ClaimOwner, {
            kind: "controller-runtime",
            hookName: "useAirJamController",
          }),
          React.createElement(ClaimOwner, {
            kind: "controller-runtime",
            hookName: "useAirJamController",
          }),
        ),
      ),
    ).toThrow(/AJ_DUPLICATE_SESSION_OWNER/);

    await waitFor(() => {
      expect(diagnostics).toContain("AJ_DUPLICATE_SESSION_OWNER");
    });

    stop();
    consoleErrorSpy.mockRestore();
  });

  it("rejects duplicate host runtime owners in one provider tree", async () => {
    const diagnostics: string[] = [];
    const stop = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() =>
      render(
        React.createElement(
          HostProviderForTest,
          PROVIDER_CONFIG,
          React.createElement(ClaimOwner, {
            kind: "host-runtime",
            hookName: "useAirJamHost",
          }),
          React.createElement(ClaimOwner, {
            kind: "host-runtime",
            hookName: "useAirJamHost",
          }),
        ),
      ),
    ).toThrow(/AJ_DUPLICATE_SESSION_OWNER/);

    await waitFor(() => {
      expect(diagnostics).toContain("AJ_DUPLICATE_SESSION_OWNER");
    });

    stop();
    consoleErrorSpy.mockRestore();
  });
});

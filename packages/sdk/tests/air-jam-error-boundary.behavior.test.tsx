// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { AirJamErrorBoundary } from "../src/runtime/air-jam-error-boundary";

const ThrowOnRender = (): never => {
  throw new Error("boom");
};

describe("AirJamErrorBoundary behavior", () => {
  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);
  });

  afterEach(() => {
    resetAirJamDiagnosticsForTests();
  });

  it("renders fallback UI and emits AJ_RUNTIME_RENDER_CRASH on render failure", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const diagnosticCodes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnosticCodes.push(diagnostic.code);
    });

    render(
      <AirJamErrorBoundary role="host" roomId="ABCD">
        <ThrowOnRender />
      </AirJamErrorBoundary>,
    );

    expect(screen.getByText(/AirJam · runtime error · host/i)).toBeTruthy();
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText(/Host runtime hit an error/i)).toBeTruthy();
    expect(screen.getByText("ABCD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy details" })).toBeTruthy();
    expect(diagnosticCodes).toContain("AJ_RUNTIME_RENDER_CRASH");

    unsubscribe();
    consoleErrorSpy.mockRestore();
  });

  it("reports only the bounded hosted-runtime crash contract", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const reportError = vi.fn();

    const SecretFailure = (): never => {
      throw new Error("password=must-not-escape https://secret.invalid/path");
    };

    render(
      <AirJamErrorBoundary
        role="controller"
        roomId="ABCD"
        appId="private-app-id"
        reportError={reportError}
      >
        <SecretFailure />
      </AirJamErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      contractVersion: 1,
      roomId: "ABCD",
      role: "controller",
      code: "AJ_RUNTIME_RENDER_CRASH",
      errorName: "Error",
    });
    expect(JSON.stringify(reportError.mock.calls)).not.toContain("password");
    expect(JSON.stringify(reportError.mock.calls)).not.toContain(
      "secret.invalid",
    );
    expect(JSON.stringify(reportError.mock.calls)).not.toContain(
      "private-app-id",
    );

    consoleErrorSpy.mockRestore();
  });

  it("supports minimizing and expanding the fallback panel", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <AirJamErrorBoundary role="host" roomId="ABCD">
        <ThrowOnRender />
      </AirJamErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Minimize error panel/i }),
    );
    expect(screen.getByText(/AirJam · runtime error/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Expand error panel/i }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Expand error panel/i }),
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});

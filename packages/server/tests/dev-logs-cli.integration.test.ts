import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeDevLogsCli,
  formatDevLogsHelp,
} from "../src/logging/dev-logs-cli";

const FIXTURE_FILE = fileURLToPath(
  new URL("./fixtures/dev-logs-cli-sample.ndjson", import.meta.url),
);

describe("dev logs cli integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a real captured stream in signal view without framework noise", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const exitCode = await executeDevLogsCli([
      "--file",
      FIXTURE_FILE,
      "--view=signal",
      "--trace=host_ae32e1c2c011",
    ]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.flat().join("\n");

    expect(output).toContain("Host bootstrap verified");
    expect(output).toContain("Air Jam provider mounted");
    expect(output).not.toContain("Browser log batch received");
    expect(output).not.toContain("Browser log sink started");
    expect(output).not.toContain("query #1");
  });

  it("applies room and runtime filters against a real captured stream", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const exitCode = await executeDevLogsCli([
      "--file",
      FIXTURE_FILE,
      "--room=UWLU",
      "--runtime=arcade-host-runtime",
      "--epoch=2",
    ]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.flat().join("\n");

    expect(output).toContain("Embedded host bridge attached");
    expect(output).not.toContain("Host bootstrap verified");
    expect(output).not.toContain("Air Jam provider mounted");
  });

  it("shows workspace errors in signal view while hiding workspace info noise", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const exitCode = await executeDevLogsCli([
      "--file",
      FIXTURE_FILE,
      "--view=signal",
      "--source=workspace",
    ]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.flat().join("\n");

    expect(output).toContain('Failed to resolve import "react-icons/gi"');
    expect(output).not.toContain("ready in 310 ms");
    expect(output).not.toContain("Process platform started");
  });

  it("filters workspace entries by process name and keeps exit failures in signal view", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const exitCode = await executeDevLogsCli([
      "--file",
      FIXTURE_FILE,
      "--view=signal",
      "--source=workspace",
      "--process=platform",
    ]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.flat().join("\n");

    expect(output).toContain("Process platform exited with code 1");
    expect(output).not.toContain("Process platform started");
    expect(output).not.toContain('Failed to resolve import "react-icons/gi"');
  });

  it("documents process filtering in the help output", () => {
    const output = formatDevLogsHelp();

    expect(output).toContain("--process <name>");
    expect(output).toContain(
      "air-jam-server logs --source=workspace --process=platform --view=signal",
    );
  });
});

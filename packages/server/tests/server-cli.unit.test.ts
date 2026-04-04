import { describe, expect, it } from "vitest";
import { createServerCli, formatCliHelp, normalizeCliArgv } from "../src/cli";
import { coerceDevLogsCliOptions } from "../src/logging/dev-logs-cli";

describe("server cli", () => {
  it("registers start and logs commands", () => {
    const cli = createServerCli();
    expect(cli.commands.map((command: { name: () => string }) => command.name())).toEqual([
      "start",
      "logs",
    ]);
  });

  it("renders top-level help with logs command", () => {
    expect(formatCliHelp()).toContain("logs [options]");
    expect(formatCliHelp()).toContain("Read the canonical unified dev log stream");
  });

  it("describes the default start behavior in help output", () => {
    expect(formatCliHelp()).toContain("Start the Air Jam server");
  });

  it("normalizes pnpm double-dash forwarding for logs subcommand", () => {
    expect(
      normalizeCliArgv([
        "node",
        "dist/cli.js",
        "logs",
        "--",
        "--follow",
        "--trace=host_123",
      ]),
    ).toEqual([
      "node",
      "dist/cli.js",
      "logs",
      "--follow",
      "--trace=host_123",
    ]);
  });

  it("coerces commander log options into the canonical filter shape", () => {
    expect(
      coerceDevLogsCliOptions({
        follow: true,
        trace: "host_123",
        room: "ROOM1",
        controller: "ctrl_42",
        runtime: "arcade-host-runtime",
        epoch: 2,
        view: "signal",
      }),
    ).toMatchObject({
      follow: true,
      traceId: "host_123",
      roomId: "ROOM1",
      controllerId: "ctrl_42",
      runtimeKind: "arcade-host-runtime",
      runtimeEpoch: 2,
      view: "signal",
    });
  });
});

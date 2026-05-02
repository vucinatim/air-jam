import { describe, expect, it } from "vitest";
import {
  formatHelp,
  parseCliArgs,
  validateCliOptions,
} from "../scripts/runtime-usage-rebuild";

describe("runtime usage rebuild cli", () => {
  it("parses single-session rebuild arguments", () => {
    const options = parseCliArgs(["--session=runtime_123"]);

    expect(options).toEqual({
      help: false,
      rebuildAll: false,
      runtimeSessionId: "runtime_123",
    });
  });

  it("parses all-session rebuild arguments", () => {
    const options = parseCliArgs(["--all"]);

    expect(options).toEqual({
      help: false,
      rebuildAll: true,
    });
  });

  it("rejects ambiguous targets", () => {
    const validation = validateCliOptions(
      parseCliArgs(["--all", "--session=runtime_123"]),
    );

    expect(validation).toEqual({
      ok: false,
      message: "Choose either --all or --session=<runtimeSessionId>, not both.",
    });
  });

  it("rejects missing targets", () => {
    const validation = validateCliOptions(parseCliArgs([]));

    expect(validation).toEqual({
      ok: false,
      message: "Provide --all or --session=<runtimeSessionId>.",
    });
  });

  it("renders focused help text", () => {
    expect(formatHelp()).toContain("pnpm analytics:rebuild -- --all");
    expect(formatHelp()).toContain(
      "pnpm analytics:rebuild -- --session=runtime_123",
    );
  });
});

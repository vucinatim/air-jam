import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDevtoolsHelperArgs } from "../src/helper-scripts.js";

const candidate = fileURLToPath(new URL("../candidate", import.meta.url));

describe("devtools helper execution", () => {
  it("runs built JavaScript helpers directly without the tsx CLI", () => {
    for (const helperName of ["hold-runtime-host", "managed-dev-supervisor"]) {
      const helperPath = path.join(candidate, `dist/tooling/${helperName}.js`);
      expect(resolveDevtoolsHelperArgs(helperPath)).toEqual([helperPath]);
    }
  });

  it("loads project TypeScript for built helpers that import user config", () => {
    for (const helperName of [
      "agent-contract",
      "inspect-airjam-agent",
      "list-visual-scenarios",
      "run-visual-capture",
      "run-test-profile",
    ]) {
      const helperPath = path.join(candidate, `dist/tooling/${helperName}.js`);
      const args = resolveDevtoolsHelperArgs(helperPath);

      expect(args[0]).toBe("--import");
      expect(args[1]).toMatch(/tsx/);
      expect(args[2]).toBe(helperPath);
      expect(args).not.toContain("cli.mjs");
    }
  });

  it("loads authored TypeScript helpers without starting the tsx CLI IPC server", () => {
    const args = resolveDevtoolsHelperArgs(
      path.join(candidate, "src/tooling/helper.ts"),
    );

    expect(args[0]).toBe("--import");
    expect(args[1]).toMatch(/tsx/);
    expect(args[2]).toBe(path.join(candidate, "src/tooling/helper.ts"));
    expect(args).not.toContain("cli.mjs");
  });

  it("does not treat filenames that merely end in ts-like text as TypeScript", () => {
    expect(
      resolveDevtoolsHelperArgs(path.join(candidate, "helper.ts.backup")),
    ).toEqual([path.join(candidate, "helper.ts.backup")]);
  });
});

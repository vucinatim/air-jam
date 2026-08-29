import { describe, expect, it } from "vitest";
import { resolveDevtoolsHelperArgs } from "../src/helper-scripts.js";

describe("devtools helper execution", () => {
  it("runs built JavaScript helpers directly without the tsx CLI", () => {
    expect(
      resolveDevtoolsHelperArgs("/candidate/dist/tooling/helper.js"),
    ).toEqual(["/candidate/dist/tooling/helper.js"]);
  });

  it("loads authored TypeScript helpers without starting the tsx CLI IPC server", () => {
    const args = resolveDevtoolsHelperArgs("/candidate/src/tooling/helper.ts");

    expect(args[0]).toBe("--import");
    expect(args[1]).toMatch(/tsx/);
    expect(args[2]).toBe("/candidate/src/tooling/helper.ts");
    expect(args).not.toContain("cli.mjs");
  });
});

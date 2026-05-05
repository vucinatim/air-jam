import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const scriptPath = path.join(
  repoRoot,
  "apps",
  "platform",
  "scripts",
  "run-with-generated-prep.mjs",
);

describe("platform generated prep runner", () => {
  it("uses the dedicated generated-prep helper instead of the repo CLI", async () => {
    const source = await fs.readFile(scriptPath, "utf8");

    expect(source).toContain("preparePlatformGeneratedArtifacts");
    expect(source).not.toContain("scripts/repo/cli.mjs");
    expect(source).not.toContain('"platform", "generated", "prepare"');
  });
});

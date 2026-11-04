import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  canonicalRules,
  findCanonicalViolations,
} from "../commands/standards.mjs";

test("the canonical scanner preserves multiline matching and Git ignore boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-canonical-"));
  try {
    fs.writeFileSync(path.join(root, ".gitignore"), "ignored/\n");
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "src/example.ts"),
      'import {\n  AirJamProvider,\n} from "@air-jam/sdk";\n',
    );
    fs.mkdirSync(path.join(root, "ignored"));
    fs.writeFileSync(
      path.join(root, "ignored/example.ts"),
      'import { AirJamProvider } from "@air-jam/sdk";\n',
    );
    fs.writeFileSync(
      path.join(root, "src/binary.dat"),
      Buffer.from('import { AirJamProvider } from "@air-jam/sdk";\0binary'),
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", ".gitignore", "src"], { cwd: root });
    fs.renameSync(
      path.join(root, "src/binary.dat"),
      path.join(root, "ignored/binary.dat"),
    );

    assert.deepEqual(
      findCanonicalViolations({
        root,
        rules: [
          {
            label: "forbidden provider",
            pattern:
              "import\\s*{[^}]*\\bAirJamProvider\\b[^}]*}\\s*from\\s*[\"\\']@air-jam/sdk[\"\\']",
            paths: ["src"],
          },
        ],
      }),
      [
        {
          file: "src/example.ts",
          label: "forbidden provider",
          line: 1,
          excerpt: 'import { AirJamProvider, } from "@air-jam/sdk"',
        },
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the wildcard postMessage guard catches a target origin on any line", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-canonical-"));
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "src/example.ts"),
      [
        'window.parent.postMessage({ type: "single" }, "*");',
        "window.parent.postMessage(",
        "  { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: ack.ok },",
        '  "*",',
        ");",
        'frame.postMessage(message, { targetOrigin: "*" });',
        'parent.postMessage({ type: "declared", ok }, parent.origin);',
        'const all = "*";',
        "",
      ].join("\n"),
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "src"], { cwd: root });
    const rule = canonicalRules.find(
      ({ label }) => label === "wildcard postMessage targetOrigin usage",
    );

    assert.deepEqual(
      findCanonicalViolations({
        root,
        rules: [{ ...rule, paths: ["src"] }],
      }).map(({ line }) => line),
      [1, 2, 6],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

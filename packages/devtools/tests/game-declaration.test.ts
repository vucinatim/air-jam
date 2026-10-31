import { airJamGameDescriptionSchema } from "@air-jam/sdk/core";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runCommandResult } from "../src/commands.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "../src/helper-scripts.js";
import {
  defineAirJamTesting,
  describeAirJamTestProfiles,
} from "../src/testing.js";
import { importDeclaration } from "../src/tooling/declaration-hook.js";
import { loadAirJamGame, loadAirJamTesting } from "../src/tooling/load-game.js";
import {
  declarationSource,
  fixtureProfile,
} from "./game-declaration-fixture.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const describe = (configs: string[]) =>
  runCommandResult({
    command: process.execPath,
    cwd: root,
    args: [
      ...resolveDevtoolsHelperArgs(
        resolveDevtoolsHelperScript("describe-game.ts"),
      ),
      ...configs.flatMap((config) => ["--config", config]),
    ],
  });
it("describes all six games in one process against the scaffold catalog", () => {
  const ids = [
    "pong",
    "minimal",
    "the-office",
    "code-review",
    "air-capture",
    "last-band-standing",
  ];
  const result = describe(
    ids.map((id) => path.join(root, "games", id, "src/airjam.config.ts")),
  );
  expect(result.stderr).toBe("");
  expect(result.ok).toBe(true);
  const descriptions = airJamGameDescriptionSchema
    .array()
    .parse(JSON.parse(result.stdout));
  expect(descriptions.map((game) => game.metadata.slug)).toEqual(ids);
  const catalog = JSON.parse(
    readFileSync(
      path.join(
        root,
        "packages/create-airjam/scaffold-templates/manifest.json",
      ),
      "utf8",
    ),
  );
  for (const { manifest } of catalog.templates)
    expect(
      descriptions.some((game) => game.metadata.slug === manifest.id),
    ).toBe(true);
}, 60_000);
it("every first-party game offers a declared model player unless explicitly pending", async () => {
  const ids = [
    "pong",
    "minimal",
    "the-office",
    "code-review",
    "air-capture",
    "last-band-standing",
  ];
  for (const id of ids) {
    const config = path.join(root, "games", id, "src/airjam.config.ts");
    const game = await loadAirJamGame(config);
    const testing = await loadAirJamTesting(config, game);
    // Last Band Standing's stimulus is audio, which a text model cannot hear.
    if (id === "last-band-standing") {
      expect(testing?.player, id).toBeUndefined();
      continue;
    }
    expect(testing?.player, id).toBeDefined();
    const profiles = describeAirJamTestProfiles(testing?.profiles ?? {});
    expect(profiles.length, id).toBeGreaterThan(0);
    for (const profile of profiles)
      expect(
        profile.policies.some((policy) => policy.id === "model"),
        `${id}/${profile.id}`,
      ).toBe(true);
  }
}, 60_000);
it.each([
  "react",
  "react-dom/client",
  "@air-jam/sdk",
  "./view.tsx",
  "./style.css",
])("rejects %s in the declaration graph, naming the importer", (module) => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "airjam-framework-free-"),
  );
  try {
    const config = path.join(directory, "airjam.config.ts");
    writeFileSync(path.join(directory, "view.tsx"), "export const view = 1;\n");
    writeFileSync(path.join(directory, "style.css"), "body {}\n");
    writeFileSync(
      config,
      declarationSource({}, "", `import ${JSON.stringify(module)};`),
    );
    const result = describe([config]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("AJ_DECLARATION_NOT_FRAMEWORK_FREE");
    expect(result.stderr).toContain(config);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it.each([
  ["react", "import.meta.url"],
  ["./dependency.cjs", "import.meta.url"],
  ["react", "new URL('./package.json', import.meta.url)"],
])(
  "rejects createRequire dependencies reached through %s from %s",
  (specifier, base) => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), "airjam-framework-free-"),
    );
    try {
      symlinkSync(
        path.join(root, "games/pong/node_modules"),
        path.join(directory, "node_modules"),
        "junction",
      );
      const config = path.join(directory, "airjam.config.ts");
      const helper = path.join(directory, "helper.mjs");
      const dependency = path.join(directory, "dependency.cjs");
      writeFileSync(dependency, 'module.exports = require("react");');
      writeFileSync(
        helper,
        `import { createRequire } from "node:module"; const require = createRequire(${base}); require(${JSON.stringify(specifier)}).createElement("div");`,
      );
      writeFileSync(
        config,
        declarationSource({}, "", 'import "./helper.mjs";'),
      );
      const result = describe([config]);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain("AJ_DECLARATION_NOT_FRAMEWORK_FREE");
      expect(result.stderr).toContain(
        specifier !== "react"
          ? dependency
          : base === "import.meta.url"
            ? helper
            : path.join(directory, "package.json"),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
it("requires the branded named declaration without fallback exports", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "airjam-unbranded-"));
  try {
    const config = path.join(directory, "airjam.config.ts");
    writeFileSync(config, "export default {}; export const airjam = {}; ");
    const result = describe([config]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("must export airjam = defineAirJamGame");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it("offers a declared player in every profile and reserves the model policy name", () => {
  const player = { brief: "A counter game.", turn: () => null };
  const testing = defineAirJamTesting({
    player,
    profiles: { first: fixtureProfile, second: fixtureProfile },
  });
  expect(
    describeAirJamTestProfiles(testing.profiles).every((profile) =>
      profile.policies.some((policy) => policy.id === "model"),
    ),
  ).toBe(true);
  expect(() =>
    defineAirJamTesting({
      profiles: {
        bad: {
          ...fixtureProfile,
          policies: {
            model: {
              label: "Wrong",
              create: () => ({
                decide: () => ({ control: { kind: "release" } }),
              }),
            },
          },
        },
      },
    }),
  ).toThrow("AJ_TEST_POLICY_RESERVED");
});

it("serializes declaration imports and releases the boundary after failure", async () => {
  const events: string[] = [];
  const first = importDeclaration(async () => {
    events.push("first-start");
    await Promise.resolve();
    events.push("first-end");
    throw new Error("Failed declaration");
  });
  const second = importDeclaration(async () => {
    events.push("second");
    return "loaded";
  });
  expect(await Promise.allSettled([first, second])).toEqual([
    { status: "rejected", reason: new Error("Failed declaration") },
    { status: "fulfilled", value: "loaded" },
  ]);
  expect(events).toEqual(["first-start", "first-end", "second"]);
  const require = createRequire(path.join(root, "games/pong/package.json"));
  expect(() => require("react").createElement("div")).not.toThrow();
});

it("reports a missing declared image", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "airjam-assets-"));
  try {
    mkdirSync(path.join(directory, "src"));
    mkdirSync(path.join(directory, "public"));
    const config = path.join(directory, "src/airjam.config.ts");
    writeFileSync(
      config,
      declarationSource(
        {},
        'assets: { sounds: {}, images: { portrait: { src: "/portrait.png" } }, files: {} },',
      ),
    );
    const missing = describe([config]);
    expect(missing.ok).toBe(false);
    expect(missing.stderr).toContain("AJ_ASSET_MISSING");
    expect(missing.stderr).toContain("images.portrait");
    expect(missing.stderr).toContain("/portrait.png");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

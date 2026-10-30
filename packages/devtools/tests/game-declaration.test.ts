import { airJamGameDescriptionSchema } from "@air-jam/sdk/core";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

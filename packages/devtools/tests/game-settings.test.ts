import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepGameSettings } from "../src/game-settings.js";
import { inspectGame } from "../src/games.js";
vi.mock("../src/games.js", () => ({ inspectGame: vi.fn() }));
const roots: string[] = [];
const descriptors = {
  ballSpeed: {
    kind: "number",
    min: -500,
    max: 500,
    default: 360,
    step: 10,
    live: true,
  },
  enabled: { kind: "boolean", default: true, live: true },
  mode: {
    kind: "choice",
    default: "easy",
    options: ["easy", "hard"],
    live: true,
  },
};
async function fixture(
  body = "ballSpeed: setting.number({min: -500, max: 500, default: 360})",
  imported = false,
) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "keep-settings-"));
  roots.push(cwd);
  await mkdir(path.join(cwd, "src"));
  await mkdir(path.join(cwd, "node_modules"));
  const require = createRequire(import.meta.url);
  await symlink(
    path.dirname(require.resolve("typescript/package.json")),
    path.join(cwd, "node_modules/typescript"),
    "dir",
  );
  const declaration = `defineAirJamSettings({${body}})`;
  const file = imported ? "src/settings.ts" : "src/airjam.config.ts";
  await writeFile(
    path.join(cwd, file),
    imported
      ? `export const settings = ${declaration};\n`
      : `export const airjam = defineAirJamGame({ settings: ${declaration} });\n`,
  );
  if (imported)
    await writeFile(
      path.join(cwd, "src/airjam.config.ts"),
      "import {settings as tuning} from './settings.js';\nexport const airjam = defineAirJamGame({settings: tuning});\n",
    );
  vi.mocked(inspectGame).mockResolvedValue({
    declaration: { settings: descriptors },
  } as unknown as Awaited<ReturnType<typeof inspectGame>>);
  return { cwd, file, read: () => readFile(path.join(cwd, file), "utf8") };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
  vi.clearAllMocks();
});
const invalidCases: Record<string, number | boolean | string>[] = [
  { missing: 1 },
  { ballSpeed: 600 },
  { ballSpeed: true },
  { ballSpeed: 401 },
  { mode: "unknown" },
  { enabled: "true" },
];

describe("keeping declaration defaults", () => {
  it.each([false, true])(
    "changes only the literal (imported %s)",
    async (imported) => {
      const f = await fixture(
        "ballSpeed: setting.number({min: -500, max: 500, /* keep */ default: 360 /* units */})",
        imported,
      );
      const before = await f.read();
      expect(
        await keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
      ).toEqual({
        file: f.file,
        kept: [{ key: "ballSpeed", from: 360, to: 400 }],
      });
      expect(await f.read()).toBe(
        before.replace("default: 360", "default: 400"),
      );
    },
  );
  it("handles a same-file binding, negative number, boolean and choice", async () => {
    const f = await fixture(
      "ballSpeed: setting.number({ default: -360 }), enabled: setting.boolean({default: true}), mode: setting.choice({default: 'easy'})",
    );
    const original = await f.read();
    const expression = original.slice(
      original.indexOf("defineAirJamSettings"),
      original.lastIndexOf(" });"),
    );
    await writeFile(
      path.join(f.cwd, f.file),
      `const settings = ${expression};\nexport const airjam = defineAirJamGame({settings});`.replace(
        "{settings}",
        "{settings: settings}",
      ),
    );
    await keepGameSettings({
      cwd: f.cwd,
      values: { ballSpeed: -400, enabled: false, mode: "hard" },
    });
    expect(await f.read()).toContain("default: -400");
    expect(await f.read()).toContain("default: false");
    expect(await f.read()).toContain("default: 'hard'");
  });
  it("resolves a default import bound to the module's settings declaration", async () => {
    const f = await fixture(undefined, true);
    await writeFile(
      path.join(f.cwd, "src/settings.ts"),
      (await f.read()) + "\nexport default settings;\n",
    );
    await writeFile(
      path.join(f.cwd, "src/airjam.config.ts"),
      "import tuning from './settings.js';\nexport const airjam = defineAirJamGame({settings: tuning});\n",
    );
    expect(
      (await keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } })).file,
    ).toBe("src/settings.ts");
    expect(await f.read()).toContain("default: 400");
  });
  it("reports no-op without writing", async () => {
    const f = await fixture();
    const before = await stat(path.join(f.cwd, f.file));
    expect(
      (await keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 360 } }))
        .kept[0],
    ).toEqual({ key: "ballSpeed", from: 360, to: 360 });
    expect((await stat(path.join(f.cwd, f.file))).mtimeMs).toBe(before.mtimeMs);
  });
  it.each([
    "...shared, ballSpeed: setting.number({default: 360})",
    "ballSpeed",
    "[key]: setting.number({default: 360})",
    "ballSpeed: setting.number({default: shared})",
    "ballSpeed: setting.number({default: 180 * 2})",
    "ballSpeed: setting.number({...shared, default: 360})",
    "ballSpeed: setting.number({default: 360, default: 400})",
    "ballSpeed: setting.number({default: 360}), ballSpeed: setting.number({default: 360})",
    "ballSpeed: shared",
  ])("refuses unsafe declaration %s", async (body) => {
    const f = await fixture(body);
    const before = await f.read();
    await expect(
      keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
    ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
    expect(await f.read()).toBe(before);
  });
  it.each(invalidCases)(
    "validates %j before writing any key",
    async (invalid) => {
      const f = await fixture(
        'ballSpeed: setting.number({default: 360}), mode: setting.choice({default: "easy"}), enabled: setting.boolean({default: true})',
      );
      const before = await f.read();
      await expect(
        keepGameSettings({
          cwd: f.cwd,
          values: { ballSpeed: 400, ...invalid },
        }),
      ).rejects.toThrow(/AJ_SETTING_(UNKNOWN|INVALID)/);
      expect(await f.read()).toBe(before);
    },
  );
  it("refuses ambiguous game declarations", async () => {
    const f = await fixture();
    await writeFile(
      path.join(f.cwd, f.file),
      (await f.read()) + "\ndefineAirJamGame({settings: other});",
    );
    await expect(
      keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
    ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
  });
  it("requires the game's own TypeScript", async () => {
    const f = await fixture();
    await rm(path.join(f.cwd, "node_modules/typescript"));
    await expect(
      keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
    ).rejects.toMatchObject({ code: "AJ_SETTINGS_TYPESCRIPT_MISSING" });
  });
});

it.each(["named alias", "default identifier", "aliased re-export"])(
  "resolves the used %s declaration and leaves an unexported decoy untouched",
  async (shape) => {
    const f = await fixture(undefined, true);
    const used =
      "const actual = defineAirJamSettings({ballSpeed: setting.number({default: 360, min: 0, max: 500})});\n";
    const decoy =
      "const tuning = defineAirJamSettings({ballSpeed: setting.number({default: 300, min: 0, max: 500})});\n";
    const target =
      shape === "aliased re-export" ? "src/other.ts" : "src/settings.ts";
    const targetText =
      used +
      decoy +
      (shape === "default identifier"
        ? "export default actual;\n"
        : shape === "aliased re-export"
          ? "export {actual};\n"
          : "export {actual as tuning};\n");
    await writeFile(path.join(f.cwd, target), targetText);
    if (shape === "aliased re-export")
      await writeFile(
        path.join(f.cwd, "src/settings.ts"),
        "export {actual as tuning} from './other.js';\n",
      );
    await writeFile(
      path.join(f.cwd, "src/airjam.config.ts"),
      (shape === "default identifier"
        ? "import selected from './settings.js';"
        : "import {tuning as selected} from './settings.js';") +
        "\nexport const airjam = defineAirJamGame({settings: selected});\n",
    );
    const result = await keepGameSettings({
      cwd: f.cwd,
      values: { ballSpeed: 400 },
    });
    expect(result.file).toBe(target);
    const output = await readFile(path.join(f.cwd, target), "utf8");
    expect(output).toBe(targetText.replace("default: 360", "default: 400"));
    expect(output).toContain(decoy);
  },
);

it.each([
  "let settings = defineAirJamSettings({ballSpeed: setting.number({default: 360})}); settings = other;",
  "const settings = defineAirJamSettings({ballSpeed: setting.number({default: 360})}); settings = other;",
  "const {settings} = other;",
  "const actual = defineAirJamSettings({ballSpeed: setting.number({default: 360})}); const settings = actual;",
])(
  "refuses a mutable or indirect binding without touching source: %s",
  async (binding) => {
    const f = await fixture();
    const source =
      binding +
      "\nexport const airjam = defineAirJamGame({settings: settings});\n";
    await writeFile(path.join(f.cwd, f.file), source);
    await expect(
      keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
    ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
    expect(await f.read()).toBe(source);
  },
);

it("refuses an unresolved exported binding instead of editing an unexported namesake", async () => {
  const f = await fixture(undefined, true);
  const source =
    "const tuning = defineAirJamSettings({ballSpeed: setting.number({default: 360})}); export {};\n";
  await writeFile(path.join(f.cwd, f.file), source);
  await writeFile(
    path.join(f.cwd, "src/airjam.config.ts"),
    "import {tuning} from './settings.js'; export const airjam = defineAirJamGame({settings: tuning});\n",
  );
  await expect(
    keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
  ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
  expect(await f.read()).toBe(source);
});

it("never selects an unused game declaration instead of the exported game", async () => {
  const f = await fixture();
  const original =
    (await f.read()).replace("export const airjam =", "const unused =") +
    "\nexport const airjam = someOtherGame;\n";
  await writeFile(path.join(f.cwd, f.file), original);
  await expect(
    keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
  ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
  expect(await f.read()).toBe(original);
});

it("refuses ambiguous star exports rather than choosing the first declaration", async () => {
  const f = await fixture(undefined, true);
  const declaration =
    "export const tuning = defineAirJamSettings({ballSpeed: setting.number({default: 360})});\n";
  await writeFile(path.join(f.cwd, "src/first.ts"), declaration);
  await writeFile(path.join(f.cwd, "src/second.ts"), declaration);
  await writeFile(
    path.join(f.cwd, "src/settings.ts"),
    "export * from './first.js'; export * from './second.js';\n",
  );
  await expect(
    keepGameSettings({ cwd: f.cwd, values: { ballSpeed: 400 } }),
  ).rejects.toMatchObject({ code: "AJ_SETTINGS_DECLARATION" });
  expect(await readFile(path.join(f.cwd, "src/first.ts"), "utf8")).toBe(
    declaration,
  );
  expect(await readFile(path.join(f.cwd, "src/second.ts"), "utf8")).toBe(
    declaration,
  );
});

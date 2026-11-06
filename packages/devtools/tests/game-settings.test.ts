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

import { isAirJamGame, type AirJamGame } from "@air-jam/sdk/core";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register as registerTypescript } from "tsx/esm/api";
import { resolveDevtoolsHelperScript } from "../helper-scripts.js";
import type { defineAirJamTesting } from "../testing.js";

const registered = new Map<
  string,
  {
    import: (
      specifier: string,
      parent: string,
    ) => Promise<Record<string, unknown>>;
  }
>();
export async function loadAirJamGame(configPath: string): Promise<AirJamGame> {
  const configUrl = pathToFileURL(await realpath(configPath)).href;
  if (!registered.has(configUrl)) {
    const tsconfig = [
      path.join(path.dirname(configPath), "tsconfig.json"),
      path.resolve(path.dirname(configPath), "../tsconfig.json"),
    ].find(existsSync);
    const typescript = registerTypescript({
      namespace: configUrl,
      tsconfig: tsconfig ?? false,
    });
    register(
      pathToFileURL(resolveDevtoolsHelperScript("declaration-hook.ts")),
      { data: configUrl },
    );
    registered.set(configUrl, typescript);
  }
  const typescript = registered.get(configUrl);
  if (!typescript)
    throw new Error("Declaration TypeScript loader was not registered.");
  const loaded = await typescript.import(configUrl, import.meta.url);
  if (!isAirJamGame(loaded.airjam))
    throw new Error(
      `Air Jam config "${configPath}" must export airjam = defineAirJamGame(...) from @air-jam/sdk/core.`,
    );
  return loaded.airjam;
}

export async function loadAirJamTesting(
  configPath: string,
  game: AirJamGame,
): Promise<ReturnType<typeof defineAirJamTesting> | null> {
  if (!game.testing) return null;
  const root = await realpath(path.resolve(path.dirname(configPath), ".."));
  const modulePath = await realpath(
    path.resolve(path.dirname(configPath), game.testing),
  );
  const relative = path.relative(root, modulePath);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("Air Jam testing must live inside the game project.");
  const configUrl = pathToFileURL(await realpath(configPath)).href;
  const typescript = registered.get(configUrl);
  if (!typescript)
    throw new Error("Load the game declaration before its testing module.");
  const loaded = await typescript.import(
    pathToFileURL(modulePath).href,
    import.meta.url,
  );
  if (
    !loaded.testing ||
    typeof loaded.testing !== "object" ||
    !("profiles" in loaded.testing) ||
    !loaded.testing.profiles
  )
    throw new Error(
      `Testing module "${modulePath}" must export testing = defineAirJamTesting(...).`,
    );
  return loaded.testing as ReturnType<typeof defineAirJamTesting>;
}

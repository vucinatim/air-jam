import crossSpawn from "cross-spawn";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { detectProjectContext } from "../context.js";
import { installDependencies } from "../dependencies.js";
import { distributionFiles, materializeGameBuild } from "../game-build.js";
import { resolveDevtoolsHelperScript } from "../helper-scripts.js";
import { validateLocalRelease } from "../release.js";

const input = z
  .object({
    projectDir: z.string().min(1),
    configRelative: z
      .string()
      .min(1)
      .refine(
        (value) =>
          !path.isAbsolute(value) && !value.split(/[\\/]/).includes(".."),
      ),
  })
  .parse(JSON.parse(process.argv[2] ?? "null"));
async function command(command: string, args: string[], cwd: string) {
  const child = crossSpawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CI: "true" },
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > 1_000_000) output = output.slice(-1_000_000);
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0)
    throw new Error(
      `build_command_failed: ${command} ${args.join(" ")} (${code})\n${output}`,
    );
  return output.trim();
}
try {
  const context = await detectProjectContext({ cwd: input.projectDir });
  if (
    context.mode !== "standalone-game" ||
    context.packageManager !== "pnpm" ||
    context.rootDir !== input.projectDir
  )
    throw new Error(
      "pinned_build_unsupported: Built tests currently require a standalone game with a frozen pnpm lockfile.",
    );
  const directory = path.dirname(
    path.dirname(resolveDevtoolsHelperScript("seal-game-build.ts")),
  );
  const implementation = await distributionFiles(directory);
  const packageJson = JSON.parse(
    await readFile(path.join(directory, "../package.json"), "utf8"),
  );
  const result = await materializeGameBuild({
    ...input,
    toolchain: {
      node: process.version,
      pnpm: await command("pnpm", ["--version"], input.projectDir),
      devtools: z.string().parse(packageJson.version),
      platform: process.platform,
      architecture: process.arch,
      nodeAbi: process.versions.modules,
      projectRoot: input.projectDir,
      implementationHash: createHash("sha256")
        .update(JSON.stringify(implementation))
        .digest("hex"),
      environmentHash: createHash("sha256")
        .update(
          JSON.stringify(
            Object.entries(process.env)
              .filter(
                ([name]) =>
                  ![
                    "AIRJAM_PROCESS_SCOPE",
                    "PWD",
                    "OLDPWD",
                    "SHLVL",
                    "_",
                  ].includes(name),
              )
              .sort(([left], [right]) => left.localeCompare(right)),
          ),
        )
        .digest("hex"),
    },
    install: (rootDir) =>
      installDependencies(rootDir, { network: "prefer-offline" }),
    async build(rootDir) {
      const validation = await validateLocalRelease({ cwd: rootDir });
      if (!validation.ok)
        throw new Error(
          `build_validation_failed: ${validation.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => issue.message)
            .join("\n")}`,
        );
    },
  });
  process.send?.({ type: "air-jam-game-build/v1", ok: true, build: result });
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.send?.({
    type: "air-jam-game-build/v1",
    ok: false,
    error: (error instanceof Error ? error.message : String(error)).slice(
      0,
      4000,
    ),
  });
}

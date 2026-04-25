import path from "node:path";
import {
  findUp,
  firstExistingPath,
  pathExists,
  readPackageJson,
  resolveCandidatePath,
} from "./fs-utils.js";
import type {
  AirJamCapabilityGroup,
  AirJamPackageManager,
  AirJamProjectContext,
  AirJamProjectInspection,
  PackageJson,
} from "./types.js";

const hasDependency = (
  packageJson: PackageJson,
  packageName: string,
): boolean =>
  Boolean(
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    packageJson.peerDependencies?.[packageName],
  );

const detectPackageManager = async (
  rootDir: string,
): Promise<AirJamPackageManager> => {
  if (await pathExists(path.join(rootDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await pathExists(path.join(rootDir, "package-lock.json"))) {
    return "npm";
  }
  if (await pathExists(path.join(rootDir, "yarn.lock"))) {
    return "yarn";
  }
  if (
    (await pathExists(path.join(rootDir, "bun.lock"))) ||
    (await pathExists(path.join(rootDir, "bun.lockb")))
  ) {
    return "bun";
  }
  return "unknown";
};

const findPackageRoot = async (cwd: string): Promise<string> => {
  const packageJsonPath = await findUp(cwd, "package.json");
  return packageJsonPath ? path.dirname(packageJsonPath) : path.resolve(cwd);
};

const isMonorepoRoot = async (
  rootDir: string,
  packageJson: PackageJson | null,
): Promise<boolean> => {
  if (packageJson?.name !== "air-jam") {
    return false;
  }

  return (
    (await pathExists(path.join(rootDir, "scripts", "repo", "cli.mjs"))) &&
    (await pathExists(path.join(rootDir, "packages", "sdk"))) &&
    (await pathExists(path.join(rootDir, "packages", "create-airjam")))
  );
};

const isStandaloneGameRoot = async (
  rootDir: string,
  packageJson: PackageJson | null,
): Promise<boolean> => {
  if (!packageJson) {
    return false;
  }

  if (hasDependency(packageJson, "@air-jam/sdk")) {
    return true;
  }

  return Boolean(
    await resolveCandidatePath(rootDir, [
      "src/airjam.config.ts",
      "src/airjam.config.tsx",
      "src/airjam.config.js",
      "src/airjam.config.mjs",
      "airjam.config.ts",
      "airjam.config.tsx",
      "airjam.config.js",
      "airjam.config.mjs",
    ]),
  );
};

export const detectProjectContext = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamProjectContext> => {
  const rootDir = await findPackageRoot(cwd);
  const packageJsonResult = await readPackageJson(rootDir);
  const packageJson = packageJsonResult?.value ?? null;
  const reasons: string[] = [];

  let workspaceRoot: string | null = null;
  let mode: AirJamProjectContext["mode"] = "unknown";

  if (await isMonorepoRoot(rootDir, packageJson)) {
    mode = "monorepo";
    workspaceRoot = rootDir;
    reasons.push("Detected Air Jam monorepo root package and repo CLI.");
  } else if (await isStandaloneGameRoot(rootDir, packageJson)) {
    mode = "standalone-game";
    reasons.push("Detected Air Jam game package or airjam config.");
  } else {
    reasons.push("No Air Jam monorepo or standalone game markers found.");
  }

  return {
    rootDir,
    mode,
    packageManager: await detectPackageManager(rootDir),
    packageJsonPath: packageJsonResult?.path ?? null,
    packageJson,
    workspaceRoot,
    reasons,
  };
};

const collectAirJamPackages = (
  packageJson: PackageJson | null,
): Record<string, string> => {
  if (!packageJson) {
    return {};
  }

  return Object.fromEntries(
    Object.entries({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
      ...(packageJson.peerDependencies ?? {}),
    }).filter(
      ([name]) => name === "create-airjam" || name.startsWith("@air-jam/"),
    ),
  );
};

const collectCapabilities = (
  context: AirJamProjectContext,
): AirJamCapabilityGroup[] => {
  if (context.mode === "monorepo") {
    return [
      "project",
      "games",
      "logs",
      "runtime",
      "visual",
      "quality",
      "repo-workspace",
      "ai-pack",
    ];
  }

  if (context.mode === "standalone-game") {
    return [
      "project",
      "games",
      "logs",
      "runtime",
      "visual",
      "quality",
      "ai-pack",
    ];
  }

  return ["project"];
};

export const inspectProject = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamProjectInspection> => {
  const context = await detectProjectContext({ cwd });
  const rootDir = context.rootDir;

  return {
    context,
    capabilities: collectCapabilities(context),
    scripts: context.packageJson?.scripts ?? {},
    airJamPackages: collectAirJamPackages(context.packageJson),
    files: {
      agents: await firstExistingPath([path.join(rootDir, "AGENTS.md")]),
      plan: await firstExistingPath([path.join(rootDir, "plan.md")]),
      suggestions: await firstExistingPath([
        path.join(rootDir, "suggestions.md"),
        path.join(rootDir, "docs", "suggestions.md"),
      ]),
      docsIndex: await firstExistingPath([
        path.join(rootDir, "docs", "docs-index.md"),
      ]),
    },
  };
};

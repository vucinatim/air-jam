import fs from "fs-extra";
import JSON5 from "json5";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScaffoldTemplateCategory = "starter" | "reference" | string;

export interface ScaffoldTemplateManifest {
  id: string;
  name: string;
  description: string;
  category: ScaffoldTemplateCategory;
  scaffold: boolean;
  export?: {
    exclude?: string[];
  };
}

export interface ScaffoldTemplateSource {
  dir: string;
  manifest: ScaffoldTemplateManifest;
}

export interface ScaffoldPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
  [key: string]: unknown;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const scaffoldSourcesDir = path.resolve(__dirname, "..", "scaffold-sources");

const categoryOrder = new Map<string, number>([
  ["starter", 0],
  ["reference", 1],
]);

const manifestFileName = "airjam-template.json";

const readTemplateManifest = (filePath: string): ScaffoldTemplateManifest => {
  const manifest = fs.readJsonSync(filePath) as Partial<ScaffoldTemplateManifest>;

  if (
    typeof manifest.id !== "string" ||
    typeof manifest.name !== "string" ||
    typeof manifest.description !== "string" ||
    typeof manifest.category !== "string" ||
    manifest.scaffold !== true
  ) {
    throw new Error(`Invalid scaffold manifest at ${filePath}`);
  }

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    category: manifest.category,
    scaffold: true,
    export: manifest.export,
  };
};

export const loadAvailableScaffoldTemplates = (): ScaffoldTemplateSource[] => {
  if (!fs.existsSync(scaffoldSourcesDir)) {
    throw new Error(
      "Missing packaged scaffold sources. Rebuild create-airjam before scaffolding.",
    );
  }

  return fs
    .readdirSync(scaffoldSourcesDir)
    .map((entry) => path.join(scaffoldSourcesDir, entry))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .map((dir) => {
      const manifestPath = path.join(dir, manifestFileName);
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Missing scaffold manifest at ${manifestPath}`);
      }

      return {
        dir,
        manifest: readTemplateManifest(manifestPath),
      };
    })
    .sort((left, right) => {
      const leftOrder = categoryOrder.get(left.manifest.category) ?? 99;
      const rightOrder = categoryOrder.get(right.manifest.category) ?? 99;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.manifest.name.localeCompare(right.manifest.name);
    });
};

export const findScaffoldTemplate = (
  templates: ScaffoldTemplateSource[],
  templateId: string,
): ScaffoldTemplateSource | undefined =>
  templates.find((entry) => entry.manifest.id === templateId);

export const normalizeScaffoldPackageJson = ({
  pkg,
  serverVersion,
  createAirJamVersion,
}: {
  pkg: ScaffoldPackageJson;
  serverVersion?: string;
  createAirJamVersion: string;
}): ScaffoldPackageJson => {
  const existingScripts =
    typeof pkg.scripts === "object" && pkg.scripts
      ? { ...(pkg.scripts as Record<string, string>) }
      : {};

  for (const redundantScript of [
    "dev:server",
    "dev:secure",
    "logs",
    "ai-pack:status",
    "ai-pack:diff",
    "ai-pack:update",
    "release:bundle",
    "test:watch",
    "test:run",
    "lint",
  ]) {
    delete existingScripts[redundantScript];
  }

  const nextScripts = {
    ...existingScripts,
    dev: "create-airjam dev",
    "secure:init": "create-airjam secure:init",
  };

  const nextDevDependencies = {
    ...(typeof pkg.devDependencies === "object" && pkg.devDependencies
      ? (pkg.devDependencies as Record<string, string>)
      : {}),
    ...(serverVersion ? { "@air-jam/server": `^${serverVersion}` } : {}),
    "create-airjam": `^${createAirJamVersion}`,
  };

  return {
    ...pkg,
    scripts: nextScripts,
    devDependencies: nextDevDependencies,
  };
};

const normalizeStandaloneTsconfigFile = async (filePath: string) => {
  if (!(await fs.pathExists(filePath))) {
    return;
  }

  const source = await fs.readFile(filePath, "utf8");
  const config = JSON5.parse(source) as {
    extends?: string;
    compilerOptions?: {
      target?: string;
      lib?: string[];
      paths?: Record<string, string[]>;
    };
    include?: string[];
  };

  if (typeof config.extends === "string" && config.extends.startsWith("..")) {
    delete config.extends;
  }

  config.compilerOptions = config.compilerOptions ?? {};
  config.compilerOptions.target = config.compilerOptions.target ?? "ES2022";
  config.compilerOptions.lib = config.compilerOptions.lib ?? [
    "ES2022",
    "DOM",
    "DOM.Iterable",
  ];

  if (config.compilerOptions.paths) {
    config.compilerOptions.paths = Object.fromEntries(
      Object.entries(config.compilerOptions.paths).filter(
        ([, values]) => !values.some((value) => value.startsWith("..")),
      ),
    );

    if (Object.keys(config.compilerOptions.paths).length === 0) {
      delete config.compilerOptions.paths;
    }
  }

  if (config.include) {
    config.include = config.include.filter((entry) => !entry.startsWith(".."));
  }

  await fs.writeJson(filePath, config, { spaces: 2 });
};

const stripSdkAliasFromConfig = async (filePath: string) => {
  if (!(await fs.pathExists(filePath))) {
    return;
  }

  let source = await fs.readFile(filePath, "utf8");
  source = source.replace(
    /\n\s*"@air-jam\/sdk": path\.resolve\(__dirname, "\.\.\/\.\.\/packages\/sdk\/src"\),?/g,
    "",
  );
  source = source.replace(
    /\n\s*"@air-jam\/sdk": path\.resolve\(\s*import\.meta\.dirname,\s*"\.\.\/\.\.\/packages\/sdk\/src",\s*\),?/g,
    "",
  );

  await fs.writeFile(filePath, source, "utf8");
};

export const normalizeStandaloneProjectFiles = async (
  targetDir: string,
): Promise<void> => {
  await normalizeStandaloneTsconfigFile(path.join(targetDir, "tsconfig.json"));
  await normalizeStandaloneTsconfigFile(path.join(targetDir, "tsconfig.app.json"));
  await stripSdkAliasFromConfig(path.join(targetDir, "vite.config.ts"));
  await stripSdkAliasFromConfig(path.join(targetDir, "vitest.config.mjs"));
};

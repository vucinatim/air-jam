import fs from "fs-extra";
import JSON5 from "json5";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ScaffoldTemplateManifest {
  id: string;
  name: string;
  /**
   * Short, creator-facing one-liner shown in the interactive template picker.
   * Keep it under ~130 chars so the prompt stays readable in a terminal.
   * The description is the only complexity signal — say things like
   * "Basic 2D canvas starter" or "Advanced 3D arena" explicitly.
   */
  description: string;
  scaffold: boolean;
  /**
   * Marks this template as the pre-selected default in the interactive
   * picker. At most one packaged template may set this to `true`. Missing
   * from every template → picker defaults to the first entry after the
   * alphabetical sort.
   */
  default?: boolean;
  export?: {
    exclude?: string[];
  };
}

export interface ScaffoldTemplateSource {
  archivePath: string;
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

export const scaffoldTemplatesDir = path.resolve(
  __dirname,
  "..",
  "scaffold-templates",
);

const templateIndexFileName = "manifest.json";

const normalizeTemplateManifest = (
  value: unknown,
  sourceLabel: string,
): ScaffoldTemplateManifest => {
  const manifest = value as Partial<ScaffoldTemplateManifest> & {
    category?: unknown;
  };

  if (
    typeof manifest.id !== "string" ||
    typeof manifest.name !== "string" ||
    typeof manifest.description !== "string" ||
    manifest.scaffold !== true
  ) {
    throw new Error(`Invalid scaffold manifest at ${sourceLabel}`);
  }

  if (manifest.default !== undefined && typeof manifest.default !== "boolean") {
    throw new Error(
      `Invalid scaffold manifest at ${sourceLabel}: "default" must be boolean if set.`,
    );
  }

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    scaffold: true,
    default: manifest.default === true ? true : undefined,
    export: manifest.export,
  };
};

interface ScaffoldTemplateIndexEntry {
  archive: unknown;
  manifest: unknown;
}

interface ScaffoldTemplateIndex {
  schemaVersion?: unknown;
  templates?: unknown;
}

export const loadAvailableScaffoldTemplates = (): ScaffoldTemplateSource[] => {
  if (!fs.existsSync(scaffoldTemplatesDir)) {
    throw new Error(
      "Missing packaged scaffold templates. Rebuild create-airjam before scaffolding.",
    );
  }

  const indexPath = path.join(scaffoldTemplatesDir, templateIndexFileName);
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      "Missing packaged scaffold template manifest. Rebuild create-airjam before scaffolding.",
    );
  }

  const index = fs.readJsonSync(indexPath) as ScaffoldTemplateIndex;
  if (index.schemaVersion !== 1 || !Array.isArray(index.templates)) {
    throw new Error(`Invalid scaffold template manifest at ${indexPath}`);
  }

  const templates = (index.templates as ScaffoldTemplateIndexEntry[])
    .map((entry, index) => {
      if (typeof entry.archive !== "string" || entry.archive.trim() === "") {
        throw new Error(
          `Invalid scaffold template manifest at ${indexPath}: template ${index} is missing archive.`,
        );
      }
      const archivePath = path.join(scaffoldTemplatesDir, entry.archive);
      if (!fs.existsSync(archivePath)) {
        throw new Error(`Missing scaffold template archive at ${archivePath}`);
      }
      return {
        archivePath,
        manifest: normalizeTemplateManifest(
          entry.manifest,
          `${indexPath}#templates[${index}].manifest`,
        ),
      };
    })
    .sort((left, right) => {
      // Default template first, then alphabetical by name.
      if (left.manifest.default !== right.manifest.default) {
        return left.manifest.default ? -1 : 1;
      }
      return left.manifest.name.localeCompare(right.manifest.name);
    });

  const defaults = templates.filter((entry) => entry.manifest.default === true);
  if (defaults.length > 1) {
    throw new Error(
      `Multiple scaffold templates are marked default=true: ${defaults
        .map((entry) => entry.manifest.id)
        .join(", ")}. At most one template may be the default.`,
    );
  }

  return templates;
};

/**
 * Return the index of the template the interactive picker should pre-select.
 *
 * Prefers the template whose manifest sets `default: true`. Falls back to the
 * first entry in the sorted list if no template claims the default slot.
 */
export const resolveDefaultTemplateIndex = (
  templates: ScaffoldTemplateSource[],
): number => {
  const defaultIndex = templates.findIndex(
    (entry) => entry.manifest.default === true,
  );
  return defaultIndex >= 0 ? defaultIndex : 0;
};

export const findScaffoldTemplate = (
  templates: ScaffoldTemplateSource[],
  templateId: string,
): ScaffoldTemplateSource | undefined =>
  templates.find((entry) => entry.manifest.id === templateId);

export const normalizeScaffoldPackageJson = ({
  pkg,
  packageManager,
  cliVersion,
  serverVersion,
  mcpServerVersion,
}: {
  pkg: ScaffoldPackageJson;
  packageManager: string;
  cliVersion?: string;
  serverVersion?: string;
  mcpServerVersion?: string;
}): ScaffoldPackageJson => {
  const existingScripts =
    typeof pkg.scripts === "object" && pkg.scripts
      ? { ...(pkg.scripts as Record<string, string>) }
      : {};

  for (const redundantScript of [
    "dev:server",
    "dev:secure",
    "dev:preview",
    "logs",
    "ai-pack:status",
    "ai-pack:diff",
    "ai-pack:update",
    "release:bundle",
    "test:watch",
    "test:run",
  ]) {
    delete existingScripts[redundantScript];
  }

  const nextScripts = {
    ...existingScripts,
    dev: "pnpm exec airjam dev",
    topology: "pnpm exec airjam topology",
    "secure:init": "pnpm exec airjam secure:init",
    status: "pnpm exec airjam status",
    "reset:local": "pnpm exec airjam reset local",
    mcp: "pnpm exec airjam-mcp",
    lint: existingScripts.lint ?? "eslint .",
  };

  const nextDevDependencies = {
    ...(typeof pkg.devDependencies === "object" && pkg.devDependencies
      ? (pkg.devDependencies as Record<string, string>)
      : {}),
    ...(cliVersion ? { "@air-jam/cli": `^${cliVersion}` } : {}),
    ...(serverVersion ? { "@air-jam/server": `^${serverVersion}` } : {}),
    ...(mcpServerVersion
      ? { "@air-jam/mcp-server": `^${mcpServerVersion}` }
      : {}),
  };

  return {
    ...pkg,
    packageManager,
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
  await normalizeStandaloneTsconfigFile(
    path.join(targetDir, "tsconfig.app.json"),
  );
  await stripSdkAliasFromConfig(path.join(targetDir, "vite.config.ts"));
  await stripSdkAliasFromConfig(path.join(targetDir, "vitest.config.mjs"));
};

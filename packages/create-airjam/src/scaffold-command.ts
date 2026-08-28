import {
  AIRJAM_PROJECT_MCP_FILE,
  createProjectLocalMcpConfig,
  resolveAirJamBootstrapAssetsDir,
  resolveAirJamManagedAssetsDir,
} from "@air-jam/cli/scaffold";
import fs from "fs-extra";
import kleur from "kleur";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import {
  extractScaffoldTemplateArchive,
  findScaffoldTemplate,
  loadAvailableScaffoldTemplates,
  normalizeScaffoldPackageJson,
  normalizeStandaloneProjectFiles,
  resolveDefaultTemplateIndex,
  type ScaffoldPackageJson,
  type ScaffoldTemplateSource,
} from "./scaffold";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifestPath = path.join(packageRoot, "template-version-manifest.json");
const packageJsonPath = path.join(packageRoot, "package.json");

type TemplateVersionManifest = Record<string, string>;

const loadTemplateVersionManifest = (): TemplateVersionManifest => {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Missing template version manifest. Rebuild create-airjam before scaffolding.",
    );
  }
  return fs.readJsonSync(manifestPath) as TemplateVersionManifest;
};

const loadCreateAirJamPackageVersion = (): string => {
  const pkg = fs.readJsonSync(packageJsonPath) as { version?: string };
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("Invalid create-airjam package version");
  }
  return pkg.version;
};

const normalizeWorkspaceSpecs = (
  dependencies: Record<string, string> | undefined,
  manifest: TemplateVersionManifest,
): Record<string, string> | undefined => {
  if (!dependencies) return dependencies;

  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (!range.startsWith("workspace:")) return [name, range];
      const normalizedRange = range.replace(/^workspace:/, "");
      return [name, manifest[name] ? `^${manifest[name]}` : normalizedRange];
    }),
  );
};

const parseNamedSpecs = (values: string[] | undefined): Map<string, string> => {
  const namedSpecs = new Map<string, string>();
  for (const entry of values ?? []) {
    const separatorIndex = entry.indexOf("=");
    const name = entry.slice(0, separatorIndex).trim();
    const spec = entry.slice(separatorIndex + 1).trim();
    if (separatorIndex <= 0 || !name || !spec) {
      throw new Error(
        `Invalid spec override "${entry}". Expected NAME=SPEC format.`,
      );
    }
    namedSpecs.set(name, spec);
  }
  return namedSpecs;
};

const applyNamedSpecs = (
  pkg: ScaffoldPackageJson,
  dependencySpecs: Map<string, string>,
  overrideSpecs: Map<string, string>,
): void => {
  const dependencies = { ...(pkg.dependencies ?? {}) };
  const devDependencies = { ...(pkg.devDependencies ?? {}) };

  for (const [name, spec] of dependencySpecs.entries()) {
    if (Object.prototype.hasOwnProperty.call(dependencies, name)) {
      dependencies[name] = spec;
    } else if (Object.prototype.hasOwnProperty.call(devDependencies, name)) {
      devDependencies[name] = spec;
    } else {
      dependencies[name] = spec;
    }
  }

  pkg.dependencies = dependencies;
  pkg.devDependencies = devDependencies;
  if (overrideSpecs.size > 0) {
    pkg.pnpm = pkg.pnpm ?? {};
    pkg.pnpm.overrides = {
      ...(pkg.pnpm.overrides ?? {}),
      ...Object.fromEntries(overrideSpecs),
    };
  }
};

const recordScaffoldIdentity = async ({
  targetDir,
  templateName,
  createAirJamVersion,
}: {
  targetDir: string;
  templateName: string;
  createAirJamVersion: string;
}): Promise<void> => {
  const manifestFilePath = path.join(targetDir, ".airjam", "ai-pack.json");
  if (!fs.existsSync(manifestFilePath)) return;

  const manifest = await fs.readJson(manifestFilePath);
  manifest.scaffold = {
    ...(manifest.scaffold ?? {}),
    template: templateName,
    createAirjamVersion: createAirJamVersion,
  };
  await fs.writeJson(manifestFilePath, manifest, { spaces: 2 });
};

export type ScaffoldCommandOptions = {
  template?: string;
  skipInstall: boolean;
  depSpec: string[];
  overrideSpec: string[];
};

const selectTemplate = async ({
  requestedTemplate,
  templates,
}: {
  requestedTemplate?: string;
  templates: ScaffoldTemplateSource[];
}): Promise<ScaffoldTemplateSource | null> => {
  if (requestedTemplate) {
    const selected = findScaffoldTemplate(templates, requestedTemplate);
    if (!selected) {
      throw new Error(
        `Template "${requestedTemplate}" not found. Available templates: ${templates
          .map((entry) => entry.manifest.id)
          .join(", ")}`,
      );
    }
    return selected;
  }

  const response = await prompts({
    type: "select",
    name: "templateId",
    message: "Choose a template:",
    choices: templates.map((entry) => ({
      title: entry.manifest.name,
      description: entry.manifest.description,
      value: entry.manifest.id,
    })),
    initial: resolveDefaultTemplateIndex(templates),
  });
  return response.templateId
    ? (findScaffoldTemplate(templates, response.templateId) ?? null)
    : null;
};

export const runScaffoldCommand = async (
  projectName: string | undefined,
  options: ScaffoldCommandOptions,
): Promise<void> => {
  const manifest = loadTemplateVersionManifest();
  const createAirJamVersion = loadCreateAirJamPackageVersion();
  const dependencySpecs = parseNamedSpecs(options.depSpec);
  const overrideSpecs = parseNamedSpecs(options.overrideSpec);
  const templates = loadAvailableScaffoldTemplates();

  let projectInput = projectName;
  if (!projectInput) {
    const response = await prompts({
      type: "text",
      name: "projectName",
      message: "Project name:",
      initial: "my-airjam-game",
    });
    projectInput = response.projectName;
  }
  if (!projectInput) throw new Error("Project name is required");

  const targetDir = path.resolve(process.cwd(), projectInput);
  const selectedTemplate = await selectTemplate({
    requestedTemplate: options.template,
    templates,
  });
  if (!selectedTemplate) {
    console.log(kleur.yellow("Aborted"));
    return;
  }

  if (fs.existsSync(targetDir)) {
    const response = await prompts({
      type: "confirm",
      name: "overwrite",
      message: `Directory "${projectInput}" already exists. Overwrite?`,
      initial: false,
    });
    if (!response.overwrite) {
      console.log(kleur.yellow("Aborted"));
      return;
    }
    await fs.remove(targetDir);
  }

  console.log(kleur.cyan(`\nCreating project in ${targetDir}...\n`));
  await extractScaffoldTemplateArchive({
    archivePath: selectedTemplate.archivePath,
    targetDir,
  });

  const managedAssetsDir = resolveAirJamManagedAssetsDir();
  if (!fs.existsSync(managedAssetsDir)) {
    throw new Error("Missing @air-jam/cli managed project assets");
  }
  await fs.copy(managedAssetsDir, targetDir, { overwrite: true });
  const bootstrapAssetsDir = resolveAirJamBootstrapAssetsDir();
  if (!fs.existsSync(bootstrapAssetsDir)) {
    throw new Error("Missing @air-jam/cli bootstrap project assets");
  }
  await fs.copy(bootstrapAssetsDir, targetDir, {
    overwrite: false,
    errorOnExist: false,
  });
  await normalizeStandaloneProjectFiles(targetDir);

  const gitignorePlaceholderPath = path.join(targetDir, "_gitignore");
  if (fs.existsSync(gitignorePlaceholderPath)) {
    await fs.move(
      gitignorePlaceholderPath,
      path.join(targetDir, ".gitignore"),
      { overwrite: true },
    );
  }

  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const normalizedPkg = normalizeScaffoldPackageJson({
      pkg: await fs.readJson(pkgPath),
      cliVersion: manifest["@air-jam/cli"],
      serverVersion: manifest["@air-jam/server"],
      mcpServerVersion: manifest["@air-jam/mcp-server"],
    });
    normalizedPkg.name = path.basename(targetDir);
    normalizedPkg.dependencies = normalizeWorkspaceSpecs(
      normalizedPkg.dependencies,
      manifest,
    );
    normalizedPkg.devDependencies = normalizeWorkspaceSpecs(
      normalizedPkg.devDependencies,
      manifest,
    );
    applyNamedSpecs(normalizedPkg, dependencySpecs, overrideSpecs);
    await fs.writeJson(pkgPath, normalizedPkg, { spaces: 2 });
  }

  await fs.writeJson(
    path.join(targetDir, AIRJAM_PROJECT_MCP_FILE),
    createProjectLocalMcpConfig(),
    { spaces: 2 },
  );
  await recordScaffoldIdentity({
    targetDir,
    templateName: selectedTemplate.manifest.id,
    createAirJamVersion,
  });

  console.log(kleur.green("✓ Project created successfully!\n"));
  if (!options.skipInstall) {
    console.log(kleur.cyan("Installing dependencies...\n"));
    execSync("pnpm install", { cwd: targetDir, stdio: "inherit" });
  } else {
    console.log(kleur.yellow("Skipped dependency installation.\n"));
  }

  console.log("Next steps:\n");
  console.log(kleur.cyan(`  cd ${projectInput}`));
  console.log(kleur.cyan("  cp .env.example .env.local"));
  console.log(kleur.cyan("  pnpm run dev"));
  console.log(
    kleur.dim("Then open http://localhost:5173 and scan the QR code."),
  );
};

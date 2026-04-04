import { Command } from "commander";
import fs from "fs-extra";
import kleur from "kleur";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import yazl from "yazl";
import { runGameDevCli } from "../runtime/game-dev.mjs";
import { runSecureInitCli } from "../runtime/secure-dev.mjs";
import { runAiPackDiff, runAiPackStatus, runAiPackUpdate } from "./ai-pack";
import {
  findScaffoldTemplate,
  loadAvailableScaffoldTemplates,
  normalizeScaffoldPackageJson,
  normalizeStandaloneProjectFiles,
  type ScaffoldPackageJson,
  type ScaffoldTemplateSource,
} from "./scaffold";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, "..", "template-version-manifest.json");
const packageJsonPath = path.resolve(__dirname, "..", "package.json");
const templateAssetsBaseDir = path.resolve(
  __dirname,
  "..",
  "template-assets",
  "base",
);

type TemplateVersionManifest = Record<string, string>;
type SupportedPackageManager = "pnpm" | "npm" | "yarn" | "bun";

const HOSTED_RELEASE_MANIFEST_PATH = ".airjam/release-manifest.json" as const;
const HOSTED_RELEASE_ENTRY_PATH = "index.html" as const;
const HOSTED_RELEASE_HOST_PATH = "/" as const;
const HOSTED_RELEASE_CONTROLLER_PATH = "/controller" as const;

type HostedReleaseBundleManifest = {
  schemaVersion: 1;
  kind: "airjam-hosted-release";
  routes: {
    host: typeof HOSTED_RELEASE_HOST_PATH;
    controller: typeof HOSTED_RELEASE_CONTROLLER_PATH;
  };
};

const loadTemplateVersionManifest = (): TemplateVersionManifest => {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Missing template version manifest. Rebuild create-airjam before scaffolding.",
    );
  }

  return fs.readJsonSync(manifestPath) as TemplateVersionManifest;
};

const loadCreateAirJamPackageVersion = (): string => {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("Missing create-airjam package.json");
  }

  const pkg = fs.readJsonSync(packageJsonPath) as { version?: string };
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("Invalid create-airjam package version");
  }

  return pkg.version;
};

const createHostedReleaseBundleManifest = (): HostedReleaseBundleManifest => ({
  schemaVersion: 1,
  kind: "airjam-hosted-release",
  routes: {
    host: HOSTED_RELEASE_HOST_PATH,
    controller: HOSTED_RELEASE_CONTROLLER_PATH,
  },
});

const normalizeWorkspaceSpecs = (
  deps: Record<string, string> | undefined,
  manifest: TemplateVersionManifest,
): Record<string, string> | undefined => {
  if (!deps) return deps;

  return Object.fromEntries(
    Object.entries(deps).map(([name, range]) => {
      if (!range.startsWith("workspace:")) {
        return [name, range];
      }

      const normalizedRange = range.replace(/^workspace:/, "");
      if (manifest[name]) {
        return [name, `^${manifest[name]}`];
      }

      return [name, normalizedRange];
    }),
  );
};

const parseNamedSpecs = (values: string[] | undefined): Map<string, string> => {
  const entries = values ?? [];
  const namedSpecs = new Map<string, string>();

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(
        `Invalid spec override "${entry}". Expected NAME=SPEC format.`,
      );
    }

    const name = entry.slice(0, separatorIndex).trim();
    const spec = entry.slice(separatorIndex + 1).trim();

    if (!name || !spec) {
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
  depSpecs: Map<string, string>,
  overrideSpecs: Map<string, string>,
) => {
  const dependencies = { ...(pkg.dependencies ?? {}) };
  const devDependencies = { ...(pkg.devDependencies ?? {}) };

  for (const [name, spec] of depSpecs.entries()) {
    if (Object.prototype.hasOwnProperty.call(dependencies, name)) {
      dependencies[name] = spec;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(devDependencies, name)) {
      devDependencies[name] = spec;
      continue;
    }

    dependencies[name] = spec;
  }

  pkg.dependencies = dependencies;
  pkg.devDependencies = devDependencies;

  if (overrideSpecs.size === 0) {
    return;
  }

  pkg.pnpm = pkg.pnpm ?? {};
  pkg.pnpm.overrides = {
    ...(pkg.pnpm.overrides ?? {}),
    ...Object.fromEntries(overrideSpecs),
  };
};

const writeAiPackManifest = async ({
  targetDir,
  templateName,
  createAirJamVersion,
}: {
  targetDir: string;
  templateName: string;
  createAirJamVersion: string;
}): Promise<void> => {
  const manifestFilePath = path.join(targetDir, ".airjam", "ai-pack.json");
  if (!fs.existsSync(manifestFilePath)) {
    return;
  }

  const manifest = await fs.readJson(manifestFilePath);
  manifest.scaffold = {
    ...(manifest.scaffold ?? {}),
    template: templateName,
    createAirjamVersion: createAirJamVersion,
  };
  await fs.writeJson(manifestFilePath, manifest, { spaces: 2 });
};

const loadProjectPackageJson = async (
  targetDir: string,
): Promise<{
  name?: string;
  version?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
}> => {
  const targetPackageJsonPath = path.join(targetDir, "package.json");
  if (!(await fs.pathExists(targetPackageJsonPath))) {
    throw new Error(`Missing package.json in ${targetDir}`);
  }

  return fs.readJson(targetPackageJsonPath);
};

const detectPackageManager = async (
  targetDir: string,
  packageManagerField?: string,
): Promise<SupportedPackageManager> => {
  const configuredPackageManager = packageManagerField?.split("@")[0];
  if (
    configuredPackageManager === "pnpm" ||
    configuredPackageManager === "npm" ||
    configuredPackageManager === "yarn" ||
    configuredPackageManager === "bun"
  ) {
    return configuredPackageManager;
  }

  if (await fs.pathExists(path.join(targetDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (await fs.pathExists(path.join(targetDir, "bun.lockb"))) {
    return "bun";
  }

  if (await fs.pathExists(path.join(targetDir, "yarn.lock"))) {
    return "yarn";
  }

  return "npm";
};

const runBuildScript = ({
  targetDir,
  packageManager,
  scripts,
}: {
  targetDir: string;
  packageManager: SupportedPackageManager;
  scripts: Record<string, string> | undefined;
}) => {
  if (!scripts?.build) {
    throw new Error(
      `Project at ${targetDir} does not define a build script. Add one or pass --skip-build.`,
    );
  }

  const command =
    packageManager === "npm" ? "npm run build" : `${packageManager} build`;

  execSync(command, {
    cwd: targetDir,
    stdio: "inherit",
  });
};

const sanitizePathSegment = (value: string): string =>
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");

const getDefaultReleaseBundlePath = ({
  targetDir,
  packageName,
  packageVersion,
}: {
  targetDir: string;
  packageName?: string;
  packageVersion?: string;
}): string => {
  const normalizedReleaseLabel = sanitizePathSegment(packageVersion || "dev");
  const normalizedPackageName = sanitizePathSegment(packageName || "airjam-game");

  return path.join(
    targetDir,
    ".airjam",
    "releases",
    normalizedReleaseLabel,
    `${normalizedPackageName}-hosted-release.zip`,
  );
};

const readConfiguredControllerPath = async (
  targetDir: string,
): Promise<string | null> => {
  const configPath = path.join(targetDir, "src", "airjam.config.ts");
  if (!(await fs.pathExists(configPath))) {
    return null;
  }

  const source = await fs.readFile(configPath, "utf8");
  const match = source.match(/controllerPath\s*:\s*["'`](?<path>[^"'`]+)["'`]/);
  return match?.groups?.path?.trim() || null;
};

const assertHostedReleaseControllerPath = async (
  targetDir: string,
): Promise<void> => {
  const configuredControllerPath = await readConfiguredControllerPath(targetDir);
  if (
    configuredControllerPath &&
    configuredControllerPath !== HOSTED_RELEASE_CONTROLLER_PATH
  ) {
    throw new Error(
      `Hosted Air Jam bundles require controllerPath to be ${HOSTED_RELEASE_CONTROLLER_PATH}. This project is configured for ${configuredControllerPath}. Self-hosted mode can keep custom routes; the hosted dashboard lane cannot.`,
    );
  }
};

const normalizeRuntimeCliArgv = (argv: string[]) =>
  argv.filter((value) => value !== "--");

const resolveActionOptions = <T>(value: unknown): T => {
  if (
    value &&
    typeof value === "object" &&
    "opts" in value &&
    typeof (value as { opts?: unknown }).opts === "function"
  ) {
    return (value as Command).opts<T>();
  }

  return value as T;
};

const collectBundleFiles = async (sourceDir: string): Promise<string[]> => {
  const entries = await fs.readdir(sourceDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(sourceDir, entry);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      files.push(...(await collectBundleFiles(absolutePath)));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
};

const writeHostedReleaseBundle = async ({
  sourceDir,
  outputFile,
}: {
  sourceDir: string;
  outputFile: string;
}): Promise<void> => {
  const files = await collectBundleFiles(sourceDir);
  const zipFile = new yazl.ZipFile();

  await fs.ensureDir(path.dirname(outputFile));

  const output = fs.createWriteStream(outputFile);
  const closePromise = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    if (!relativePath || relativePath === HOSTED_RELEASE_MANIFEST_PATH) {
      continue;
    }

    zipFile.addFile(filePath, relativePath);
  }

  zipFile.addBuffer(
    Buffer.from(
      `${JSON.stringify(createHostedReleaseBundleManifest(), null, 2)}\n`,
      "utf8",
    ),
    HOSTED_RELEASE_MANIFEST_PATH,
  );
  zipFile.end();

  await closePromise;
};

const runReleaseBundleCommand = async ({
  dir,
  distDir: configuredDistDir,
  out,
  skipBuild = false,
}: {
  dir?: string;
  distDir?: string;
  out?: string;
  skipBuild?: boolean;
}) => {
  const targetDir = path.resolve(dir || process.cwd());
  const distDir = path.resolve(targetDir, configuredDistDir || "dist");
  const outputOverride = out;

  const projectPackageJson = await loadProjectPackageJson(targetDir);
  const packageManager = await detectPackageManager(
    targetDir,
    projectPackageJson.packageManager,
  );

  await assertHostedReleaseControllerPath(targetDir);

  if (!skipBuild) {
    console.log(kleur.cyan(`Building project in ${targetDir}...\n`));
    runBuildScript({
      targetDir,
      packageManager,
      scripts: projectPackageJson.scripts,
    });
  }

  if (!(await fs.pathExists(distDir))) {
    throw new Error(
      `Build output directory not found at ${distDir}. Run the build first or pass --dist-dir.`,
    );
  }

  if (!(await fs.pathExists(path.join(distDir, HOSTED_RELEASE_ENTRY_PATH)))) {
    throw new Error(
      `Hosted bundle build output must contain ${HOSTED_RELEASE_ENTRY_PATH} at ${distDir}.`,
    );
  }

  const outputFile = outputOverride
    ? path.resolve(targetDir, outputOverride)
    : getDefaultReleaseBundlePath({
        targetDir,
        packageName: projectPackageJson.name,
        packageVersion: projectPackageJson.version,
      });

  await writeHostedReleaseBundle({
    sourceDir: distDir,
    outputFile,
  });

  console.log(kleur.green("\n✓ Hosted release bundle created\n"));
  console.log(`Artifact: ${kleur.cyan(outputFile)}`);
  console.log(
    kleur.dim(
      `Hosted contract: ${HOSTED_RELEASE_HOST_PATH} (host), ${HOSTED_RELEASE_CONTROLLER_PATH} (controller), ${HOSTED_RELEASE_MANIFEST_PATH} manifest`,
    ),
  );
};

type ScaffoldCommandOptions = {
  template?: string;
  skipInstall: boolean;
  depSpec: string[];
  overrideSpec: string[];
};

const runScaffoldCommand = async (
  projectName: string | undefined,
  options: ScaffoldCommandOptions,
) => {
  const manifest = loadTemplateVersionManifest();
  const createAirJamVersion = loadCreateAirJamPackageVersion();
  const depSpecs = parseNamedSpecs(options.depSpec);
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
    if (!projectInput) {
      console.log(kleur.red("Project name is required"));
      process.exit(1);
    }
  }

  const targetDir = path.resolve(process.cwd(), projectInput);
  const packageName = path.basename(targetDir);
  let selectedTemplate: ScaffoldTemplateSource | undefined;

  if (options.template) {
    selectedTemplate = findScaffoldTemplate(templates, options.template);
    if (!selectedTemplate) {
      console.log(kleur.red(`Template "${options.template}" not found`));
      console.log(
        kleur.dim(
          `Available templates: ${templates.map((entry) => entry.manifest.id).join(", ")}`,
        ),
      );
      process.exit(1);
    }
  } else {
    const response = await prompts({
      type: "select",
      name: "templateId",
      message: "Choose a template:",
      choices: templates.map((entry) => ({
        title: `${entry.manifest.name} (${entry.manifest.category})`,
        description: entry.manifest.description,
        value: entry.manifest.id,
      })),
      initial: 0,
    });

    if (!response.templateId) {
      console.log(kleur.yellow("Aborted"));
      process.exit(0);
    }

    selectedTemplate = findScaffoldTemplate(templates, response.templateId);
  }

  if (!selectedTemplate) {
    throw new Error("Unable to resolve scaffold template.");
  }

  const templateDir = selectedTemplate.dir;

  if (fs.existsSync(targetDir)) {
    const response = await prompts({
      type: "confirm",
      name: "overwrite",
      message: `Directory "${projectInput}" already exists. Overwrite?`,
      initial: false,
    });
    if (!response.overwrite) {
      console.log(kleur.yellow("Aborted"));
      process.exit(0);
    }
    await fs.remove(targetDir);
  }

  console.log(kleur.cyan(`\nCreating project in ${targetDir}...\n`));

  // Copy the packaged scaffold source. Repo-only artifacts were already stripped
  // during the create-airjam build step that generated these snapshots.
  await fs.copy(templateDir, targetDir, {
    filter: (src) => {
      const relativePath = path.relative(templateDir, src);
      const basename = path.basename(src);
      const normalizedPath = relativePath.replace(/\\/g, "/"); // Normalize path separators

      // Exclude node_modules
      if (normalizedPath.includes("node_modules")) {
        return false;
      }

      // Exclude build output directories (check if first path segment is dist or dist-ssr)
      const firstSegment = normalizedPath.split("/")[0];
      if (firstSegment === "dist" || firstSegment === "dist-ssr") {
        return false;
      }

      // Exclude lock files and npm config
      if (
        relativePath.endsWith("pnpm-lock.yaml") ||
        relativePath.endsWith("package-lock.json") ||
        relativePath.endsWith("yarn.lock") ||
        relativePath.endsWith(".npmrc")
      ) {
        return false;
      }

      // Exclude .env files except .env.example
      if (basename.startsWith(".env") && basename !== ".env.example") {
        return false;
      }

      // Exclude *.local files (like .env.local, config.local.json, etc.)
      if (basename.endsWith(".local")) {
        return false;
      }

      // Exclude editor and OS files
      if (
        basename === ".DS_Store" ||
        normalizedPath.includes(".vscode/") ||
        normalizedPath.includes(".idea/")
      ) {
        return false;
      }

      return true;
    },
  });

  if (!fs.existsSync(templateAssetsBaseDir)) {
    throw new Error("Missing create-airjam base template assets");
  }

  await fs.copy(templateAssetsBaseDir, targetDir, { overwrite: true });
  await normalizeStandaloneProjectFiles(targetDir);

  // npm packaging can strip/transform template dotfiles like .gitignore.
  // Keep publish-safe filenames in templates and restore real dotfiles here.
  const gitignorePlaceholderPath = path.join(targetDir, "_gitignore");
  const gitignorePath = path.join(targetDir, ".gitignore");
  if (fs.existsSync(gitignorePlaceholderPath)) {
    await fs.move(gitignorePlaceholderPath, gitignorePath, { overwrite: true });
  }

  // Update package.json name
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    const normalizedPkg = normalizeScaffoldPackageJson({
      pkg,
      serverVersion: manifest["@air-jam/server"],
      createAirJamVersion,
    });
    normalizedPkg.name = packageName;
    normalizedPkg.dependencies = normalizeWorkspaceSpecs(
      normalizedPkg.dependencies,
      manifest,
    );
    normalizedPkg.devDependencies = normalizeWorkspaceSpecs(
      normalizedPkg.devDependencies,
      manifest,
    );
    applyNamedSpecs(normalizedPkg, depSpecs, overrideSpecs);
    await fs.writeJson(pkgPath, normalizedPkg, { spaces: 2 });
  }

  await writeAiPackManifest({
    targetDir,
    templateName: selectedTemplate.manifest.id,
    createAirJamVersion,
  });

  console.log(kleur.green("✓ Project created successfully!\n"));

  if (!options.skipInstall) {
    // Install dependencies
    console.log(kleur.cyan("Installing dependencies...\n"));
    try {
      execSync("pnpm install", {
        cwd: targetDir,
        stdio: "inherit",
      });
      console.log(kleur.green("\n✓ Dependencies installed successfully!\n"));
    } catch (error) {
      console.error(error);
      console.log(
        kleur.yellow(
          "\n⚠ Failed to install dependencies automatically. Please run 'pnpm install' manually.\n",
        ),
      );
    }
  } else {
    console.log(kleur.yellow("Skipped dependency installation (--skip-install).\n"));
  }

  console.log("Next steps:\n");
  console.log(kleur.cyan(`  cd ${projectInput}`));
  console.log(kleur.cyan("  cp .env.example .env.local"));
  console.log(
    kleur.cyan("  pnpm run dev         # Recommended: start server + game"),
  );
  console.log(
    kleur.cyan("  pnpm run dev -- --web-only  # Optional: official backend only"),
  );
  console.log(
    kleur.cyan(
      "  # Optional HTTPS mode (needed for gyro/camera testing on phones)",
    ),
  );
  console.log(
    kleur.cyan(
      "  pnpm run secure:init",
    ),
  );
  console.log(
    kleur.cyan("  pnpm run dev -- --secure"),
  );
  console.log(
    kleur.cyan(
      "  # Optional Cloudflare fallback: pnpm run secure:init -- --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev",
    ),
  );
  console.log("");
  console.log(
    kleur.dim(
      "Then open http://localhost:5173 (or https://localhost:5173 in secure mode) and scan the QR code with your phone!",
    ),
  );
};

const buildProgram = () => {
  const program = new Command();

  program
    .name("airjam")
    .description("Scaffold and manage Air Jam game projects")
    .argument("[project-name]", "Name of the project directory")
    .option("-t, --template <template>", "Template to use")
    .option("--skip-install", "Skip dependency installation", false)
    .option(
      "--dep-spec <name=spec>",
      "Override a scaffold dependency spec (advanced/internal)",
      (value, previous: string[] = []) => [...previous, value],
      [],
    )
    .option(
      "--override-spec <name=spec>",
      "Add a pnpm override to the scaffolded project (advanced/internal)",
      (value, previous: string[] = []) => [...previous, value],
      [],
    )
    .action(async (projectName: string | undefined, options: unknown) => {
      await runScaffoldCommand(
        projectName,
        resolveActionOptions<ScaffoldCommandOptions>(options),
      );
    });

  const aiPackCommand = program
    .command("ai-pack")
    .description("Inspect or update hosted AI pack assets");

  aiPackCommand
    .command("status")
    .description("Show AI pack status for a project")
    .option("--dir <path>", "Project directory to inspect")
    .option("--manifest-url <url>", "Override the hosted AI pack root manifest URL")
    .option("--manifest-file <path>", "Read the AI pack root manifest from a local file")
    .action(async (options: unknown) => {
      await runAiPackStatus(
        resolveActionOptions<{ dir?: string; manifestUrl?: string; manifestFile?: string }>(
          options,
        ),
      );
    });

  aiPackCommand
    .command("diff")
    .description("Show AI pack file differences for a project")
    .option("--dir <path>", "Project directory to inspect")
    .option("--manifest-url <url>", "Override the hosted AI pack root manifest URL")
    .option("--manifest-file <path>", "Read the AI pack root manifest from a local file")
    .action(async (options: unknown) => {
      await runAiPackDiff(
        resolveActionOptions<{ dir?: string; manifestUrl?: string; manifestFile?: string }>(
          options,
        ),
      );
    });

  aiPackCommand
    .command("update")
    .description("Update managed AI pack assets for a project")
    .option("--dir <path>", "Project directory to inspect")
    .option("--manifest-url <url>", "Override the hosted AI pack root manifest URL")
    .option("--manifest-file <path>", "Read the AI pack root manifest from a local file")
    .option("--force", "Overwrite same-version managed file drift during update", false)
    .action(async (options: unknown) => {
      await runAiPackUpdate(
        resolveActionOptions<{
          dir?: string;
          manifestUrl?: string;
          manifestFile?: string;
          force?: boolean;
        }>(options),
      );
    });

  aiPackCommand.action(() => {
    aiPackCommand.outputHelp();
  });

  const releaseCommand = program
    .command("release")
    .description("Work with hosted release bundles");

  releaseCommand
    .command("bundle")
    .description("Create a hosted release zip from a built game project")
    .option("--dir <path>", "Project directory to bundle")
    .option("--dist-dir <path>", "Built static output directory")
    .option("--out <path>", "Output zip file path")
    .option("--skip-build", "Reuse the existing dist directory without building", false)
    .action(async (options: unknown) => {
      await runReleaseBundleCommand(
        resolveActionOptions<{
          dir?: string;
          distDir?: string;
          out?: string;
          skipBuild?: boolean;
        }>(options),
      );
    });

  releaseCommand.action(() => {
    releaseCommand.outputHelp();
  });

  program
    .command("dev")
    .description("Run project-local Air Jam game development")
    .argument("[passthrough...]", "Additional runtime flags")
    .allowExcessArguments(true)
    .allowUnknownOption(false)
    .option("--secure", "Start secure local game dev", false)
    .option(
      "--secure-mode <mode>",
      "Secure mode to use when --secure is enabled (local or tunnel)",
    )
    .option("--web-only", "Start only the game app", false)
    .option("--server-only", "Start only the local Air Jam server", false)
    .option(
      "--allow-existing-game",
      "Reuse an already-running Vite server on the game port",
      false,
    )
    .action(async () => {
      await runGameDevCli({
        argv: normalizeRuntimeCliArgv(process.argv.slice(3)),
      });
    });

  program
    .command("secure:init")
    .description("Initialize local secure Air Jam game development")
    .argument("[passthrough...]", "Additional runtime flags")
    .allowExcessArguments(true)
    .allowUnknownOption(false)
    .option("--mode <mode>", "Secure mode to configure (local or tunnel)")
    .option("--hostname <hostname>", "Tunnel hostname for secure tunnel mode")
    .option("--tunnel <name>", "Cloudflare tunnel name for secure tunnel mode")
    .action(async () => {
      await runSecureInitCli({
        argv: normalizeRuntimeCliArgv(process.argv.slice(3)),
      });
    });

  return program;
};

async function main() {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(kleur.red("Error:"), err);
  process.exit(1);
});

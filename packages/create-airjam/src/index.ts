import { program } from "commander";
import fs from "fs-extra";
import kleur from "kleur";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import { runAiPackDiff, runAiPackStatus, runAiPackUpdate } from "./ai-pack";

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
  pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    pnpm?: {
      overrides?: Record<string, string>;
    };
  },
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

const getOptionValue = (argv: string[], optionName: string): string | undefined => {
  const flagIndex = argv.indexOf(optionName);
  if (flagIndex !== -1) {
    return argv[flagIndex + 1];
  }

  const inlineArg = argv.find((value) => value.startsWith(`${optionName}=`));
  return inlineArg ? inlineArg.slice(optionName.length + 1) : undefined;
};

const printAiPackHelp = () => {
  console.log("Usage: create-airjam ai-pack <status|diff|update> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --dir <path>            Project directory to inspect (default: current working directory)");
  console.log("  --manifest-url <url>    Override the hosted AI pack root manifest URL");
  console.log("  --manifest-file <path>  Read the AI pack root manifest from a local file");
  console.log("  --force                 Overwrite same-version managed file drift during update");
};

const runAiPackCommand = async (argv: string[]) => {
  const subcommand = argv[3];
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printAiPackHelp();
    return;
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    printAiPackHelp();
    return;
  }

  const dir = getOptionValue(argv, "--dir");
  const manifestUrl = getOptionValue(argv, "--manifest-url");
  const manifestFile = getOptionValue(argv, "--manifest-file");
  const force = argv.includes("--force");

  if (subcommand === "status") {
    await runAiPackStatus({ dir, manifestUrl, manifestFile });
    return;
  }

  if (subcommand === "diff") {
    await runAiPackDiff({ dir, manifestUrl, manifestFile });
    return;
  }

  if (subcommand === "update") {
    await runAiPackUpdate({ dir, manifestUrl, manifestFile, force });
    return;
  }

  printAiPackHelp();
  process.exitCode = 1;
};

async function runScaffoldCli() {
  program
    .name("create-airjam")
    .description("Scaffold a new Air Jam game project")
    .argument("[project-name]", "Name of the project directory")
    .option("-t, --template <template>", "Template to use", "pong")
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
    .parse();

  const args = program.args;
  const options = program.opts<{
    template: string;
    skipInstall: boolean;
    depSpec: string[];
    overrideSpec: string[];
  }>();
  const manifest = loadTemplateVersionManifest();
  const createAirJamVersion = loadCreateAirJamPackageVersion();
  const depSpecs = parseNamedSpecs(options.depSpec);
  const overrideSpecs = parseNamedSpecs(options.overrideSpec);

  let projectInput = args[0];

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
  const templateDir = path.resolve(
    __dirname,
    "..",
    "templates",
    options.template,
  );

  if (!fs.existsSync(templateDir)) {
    console.log(kleur.red(`Template "${options.template}" not found`));
    process.exit(1);
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
      process.exit(0);
    }
    await fs.remove(targetDir);
  }

  console.log(kleur.cyan(`\nCreating project in ${targetDir}...\n`));

  // Copy template, excluding development files and gitignored files
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
    pkg.name = packageName;
    pkg.dependencies = normalizeWorkspaceSpecs(pkg.dependencies, manifest);
    pkg.devDependencies = normalizeWorkspaceSpecs(pkg.devDependencies, manifest);
    applyNamedSpecs(pkg, depSpecs, overrideSpecs);
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  await writeAiPackManifest({
    targetDir,
    templateName: options.template,
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
      "  pnpm run secure:init -- --hostname my-game-dev.example.com --tunnel my-game-dev",
    ),
  );
  console.log(
    kleur.cyan("  pnpm run dev -- --secure  # Optional HTTPS mode for sensors"),
  );
  console.log("");
  console.log(
    kleur.dim(
      "Then open http://localhost:5173 and scan the QR code with your phone!",
    ),
  );
}

async function main() {
  if (process.argv[2] === "ai-pack") {
    await runAiPackCommand(process.argv);
    return;
  }

  await runScaffoldCli();
}

main().catch((err) => {
  console.error(kleur.red("Error:"), err);
  process.exit(1);
});

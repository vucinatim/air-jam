import {
  bundleLocalRelease,
  getPlatformAuthStoragePath,
  getPlatformMachineProfile,
  inspectLocalRelease,
  inspectPlatformRelease,
  listPlatformReleaseTargets,
  listPlatformReleases,
  loginPlatformWithDeviceFlow,
  logoutPlatformMachineSession,
  publishPlatformRelease,
  readStoredPlatformMachineSession,
  submitPlatformRelease,
  validateLocalRelease,
  type AirJamLocalReleaseIssue,
} from "@air-jam/devtools-core";
import { formatEnvValidationError, isEnvValidationError } from "@air-jam/env";
import {
  AIRJAM_PROJECT_MCP_FILE,
  createProjectLocalMcpConfig,
} from "@air-jam/mcp-server";
import { Command, type OptionValues } from "commander";
import fs from "fs-extra";
import kleur from "kleur";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import { runGameDevCli } from "../runtime/game-dev.mjs";
import { runSecureInitCli } from "../runtime/secure-dev.mjs";
import { runProjectTopologyCli } from "../runtime/topology.mjs";
import { runAiPackDiff, runAiPackStatus, runAiPackUpdate } from "./ai-pack";
import { runMcpConfig, runMcpDoctor, runMcpInit } from "./mcp";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(
  __dirname,
  "..",
  "template-version-manifest.json",
);
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

const normalizeRuntimeCliArgv = (argv: string[]) =>
  argv.filter((value) => value !== "--");

const resolveActionOptions = <T extends OptionValues>(value: unknown): T => {
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

const printReleaseIssues = (issues: AirJamLocalReleaseIssue[]) => {
  for (const issue of issues) {
    const color = issue.severity === "error" ? kleur.red : kleur.yellow;
    const prefix = issue.severity === "error" ? "error" : "warning";
    console.log(color(`- ${prefix}: ${issue.message}`));
    if (issue.path) {
      console.log(kleur.dim(`  path: ${issue.path}`));
    }
  }
};

const printReleaseDoctor = async ({
  dir,
  distDir,
}: {
  dir?: string;
  distDir?: string;
}) => {
  const doctor = await inspectLocalRelease({
    cwd: path.resolve(dir || process.cwd()),
    distDir,
  });

  console.log(
    doctor.canBundle
      ? kleur.green("\n✓ Hosted release doctor passed\n")
      : kleur.red("\n✗ Hosted release doctor failed\n"),
  );
  console.log(`Project: ${kleur.cyan(doctor.projectDir)}`);
  console.log(`Dist: ${kleur.cyan(doctor.distDir)}`);
  console.log(
    `Build script: ${doctor.buildScript ? kleur.cyan("present") : kleur.red("missing")}`,
  );
  console.log(
    `Metadata export: ${doctor.metadataExportLikely ? kleur.cyan("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `Hosted contract: ${kleur.dim(
      `${doctor.hostedContract.hostPath} (host), ${doctor.hostedContract.controllerPath} (controller), ${doctor.hostedContract.manifestPath} manifest`,
    )}`,
  );

  if (doctor.issues.length > 0) {
    console.log("");
    printReleaseIssues(doctor.issues);
  }

  if (!doctor.canBundle) {
    process.exitCode = 1;
  }
};

const runReleaseBundleCommand = async ({
  dir,
  distDir,
  out,
  skipBuild = false,
}: {
  dir?: string;
  distDir?: string;
  out?: string;
  skipBuild?: boolean;
}) => {
  const result = await bundleLocalRelease({
    cwd: path.resolve(dir || process.cwd()),
    distDir,
    out,
    skipBuild,
  });

  if (result.buildResult?.stdout.trim()) {
    console.log(result.buildResult.stdout.trimEnd());
  }
  if (result.buildResult?.stderr.trim()) {
    console.error(result.buildResult.stderr.trimEnd());
  }

  console.log(kleur.green("\n✓ Hosted release bundle created\n"));
  console.log(`Artifact: ${kleur.cyan(result.outputFile)}`);
  console.log(
    kleur.dim(
      `Hosted contract: / (host), /controller (controller), .airjam/release-manifest.json manifest`,
    ),
  );
  console.log(
    kleur.dim(
      `Validated ${result.validation.fileCount} files (${result.validation.extractedSizeBytes} bytes extracted)`,
    ),
  );
};

const runReleaseValidateCommand = async ({
  dir,
  distDir,
  bundle,
  skipBuild = false,
}: {
  dir?: string;
  distDir?: string;
  bundle?: string;
  skipBuild?: boolean;
}) => {
  const validation = await validateLocalRelease({
    cwd: path.resolve(dir || process.cwd()),
    distDir,
    bundlePath: bundle,
    skipBuild,
  });

  console.log(
    validation.ok
      ? kleur.green("\n✓ Hosted release validation passed\n")
      : kleur.red("\n✗ Hosted release validation failed\n"),
  );

  if (validation.source.kind === "bundle") {
    console.log(`Bundle: ${kleur.cyan(validation.source.bundlePath)}`);
  } else {
    console.log(`Project: ${kleur.cyan(validation.source.projectDir)}`);
    console.log(`Dist: ${kleur.cyan(validation.source.distDir)}`);
  }

  console.log(
    kleur.dim(
      `Validated ${validation.fileCount} files (${validation.extractedSizeBytes} bytes extracted)`,
    ),
  );

  if (validation.issues.length > 0) {
    console.log("");
    printReleaseIssues(validation.issues);
  }

  if (!validation.ok) {
    process.exitCode = 1;
  }
};

const runReleaseListCommand = async ({
  platformUrl,
  game,
}: {
  platformUrl?: string;
  game?: string;
}) => {
  if (game?.trim()) {
    const result = await listPlatformReleases({
      platformUrl,
      slugOrId: game.trim(),
    });

    console.log(
      kleur.green(
        `\n✓ Hosted releases for ${result.game.name}${result.game.slug ? ` (${result.game.slug})` : ""}\n`,
      ),
    );

    if (result.releases.length === 0) {
      console.log(kleur.dim("No hosted releases found."));
      return;
    }

    for (const release of result.releases) {
      console.log(
        `${kleur.cyan(release.id)}  ${kleur.yellow(release.status)}  ${release.versionLabel ?? "(untitled)"}  ${kleur.dim(release.createdAt)}`,
      );
    }

    return;
  }

  const result = await listPlatformReleaseTargets({ platformUrl });
  console.log(kleur.green("\n✓ Hosted release targets\n"));

  if (result.games.length === 0) {
    console.log(kleur.dim("No owned hosted games found."));
    return;
  }

  for (const ownedGame of result.games) {
    console.log(
      `${kleur.cyan(ownedGame.id)}  ${ownedGame.slug ? kleur.yellow(ownedGame.slug) : kleur.dim("(no slug)")}  ${ownedGame.name}`,
    );
  }
};

const runReleaseInspectCommand = async ({
  platformUrl,
  releaseId,
}: {
  platformUrl?: string;
  releaseId: string;
}) => {
  const result = await inspectPlatformRelease({
    platformUrl,
    releaseId,
  });
  const release = result.release;

  console.log(kleur.green("\n✓ Hosted release\n"));
  console.log(`Release: ${kleur.cyan(release.id)}`);
  console.log(`Game: ${kleur.cyan(release.game.name)}`);
  console.log(`Status: ${kleur.cyan(release.status)}`);
  console.log(`Version: ${kleur.cyan(release.versionLabel ?? "(untitled)")}`);
  console.log(`Created: ${kleur.cyan(release.createdAt)}`);
  if (release.hostUrl) {
    console.log(`Host URL: ${kleur.cyan(release.hostUrl)}`);
  }
  if (release.controllerUrl) {
    console.log(`Controller URL: ${kleur.cyan(release.controllerUrl)}`);
  }
  if (release.artifact) {
    console.log(
      `Artifact: ${kleur.cyan(release.artifact.originalFilename)} (${release.artifact.sizeBytes} bytes)`,
    );
  }
  if (release.checks.length > 0) {
    console.log("");
    console.log(kleur.dim("Checks:"));
    for (const check of release.checks) {
      console.log(
        `- ${check.kind}: ${check.status}${check.summary ? ` (${check.summary})` : ""}`,
      );
    }
  }
};

const runReleaseSubmitCommand = async ({
  platformUrl,
  game,
  versionLabel,
  dir,
  distDir,
  bundle,
  skipBuild = false,
  publish = false,
}: {
  platformUrl?: string;
  game: string;
  versionLabel?: string;
  dir?: string;
  distDir?: string;
  bundle?: string;
  skipBuild?: boolean;
  publish?: boolean;
}) => {
  const result = await submitPlatformRelease({
    platformUrl,
    slugOrId: game,
    versionLabel,
    cwd: path.resolve(dir || process.cwd()),
    distDir,
    bundlePath: bundle,
    skipBuild,
    publish,
  });

  console.log(kleur.green("\n✓ Hosted release submitted\n"));
  console.log(`Bundle: ${kleur.cyan(result.bundlePath)}`);
  console.log(`Draft: ${kleur.cyan(result.createdRelease.id)}`);
  console.log(
    `Finalized: ${kleur.cyan(result.finalizedRelease.id)} (${kleur.yellow(result.finalizedRelease.status)})`,
  );
  if (result.publishedRelease) {
    console.log(
      `Published: ${kleur.cyan(result.publishedRelease.id)} (${kleur.yellow(result.publishedRelease.status)})`,
    );
  }
};

const runReleasePublishCommand = async ({
  platformUrl,
  releaseId,
}: {
  platformUrl?: string;
  releaseId: string;
}) => {
  const result = await publishPlatformRelease({
    platformUrl,
    releaseId,
  });

  console.log(kleur.green("\n✓ Hosted release published\n"));
  console.log(`Release: ${kleur.cyan(result.release.id)}`);
  console.log(`Status: ${kleur.cyan(result.release.status)}`);
  if (result.release.hostUrl) {
    console.log(`Host URL: ${kleur.cyan(result.release.hostUrl)}`);
  }
};

const runAuthLoginCommand = async ({
  platformUrl,
  clientName,
}: {
  platformUrl?: string;
  clientName?: string;
}) => {
  console.log(kleur.cyan("\nStarting Air Jam platform login...\n"));

  const result = await loginPlatformWithDeviceFlow({
    platformUrl,
    clientName,
    onPrompt: async (authorization) => {
      console.log(
        `Verification URL: ${kleur.cyan(authorization.verificationUrl)}`,
      );
      console.log(`Approval code: ${kleur.cyan(authorization.userCode)}`);
      console.log(
        kleur.dim(
          "Sign in on the dashboard, approve the CLI request, and this command will finish automatically.\n",
        ),
      );
    },
  });

  console.log(kleur.green("\n✓ Logged in to the Air Jam platform\n"));
  console.log(`Platform: ${kleur.cyan(result.authenticated.platformBaseUrl)}`);
  console.log(`User: ${kleur.cyan(result.authenticated.user.name)}`);
  console.log(`Email: ${kleur.cyan(result.authenticated.user.email)}`);
  console.log(`Session file: ${kleur.dim(getPlatformAuthStoragePath())}`);
};

const runAuthWhoAmICommand = async ({
  platformUrl,
}: {
  platformUrl?: string;
}) => {
  const storedSession = await readStoredPlatformMachineSession();
  if (!storedSession) {
    console.log(kleur.red("No stored Air Jam platform session was found."));
    console.log(kleur.dim(`Expected at ${getPlatformAuthStoragePath()}`));
    process.exitCode = 1;
    return;
  }

  const profile = await getPlatformMachineProfile({ platformUrl });

  console.log(kleur.green("\n✓ Air Jam platform session is valid\n"));
  console.log(`Platform: ${kleur.cyan(profile.platformBaseUrl)}`);
  console.log(`User: ${kleur.cyan(profile.user.name)}`);
  console.log(`Email: ${kleur.cyan(profile.user.email)}`);
  console.log(`Role: ${kleur.cyan(profile.user.role)}`);
  console.log(`Expires: ${kleur.cyan(profile.session.expiresAt)}`);
  console.log(`Session file: ${kleur.dim(getPlatformAuthStoragePath())}`);
};

const runAuthLogoutCommand = async ({
  platformUrl,
}: {
  platformUrl?: string;
}) => {
  const storedSession = await readStoredPlatformMachineSession();
  if (!storedSession) {
    console.log(kleur.yellow("No stored Air Jam platform session was found."));
    return;
  }

  await logoutPlatformMachineSession({ platformUrl });
  console.log(kleur.green("\n✓ Logged out of the Air Jam platform\n"));
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
        title: entry.manifest.name,
        description: entry.manifest.description,
        value: entry.manifest.id,
      })),
      initial: resolveDefaultTemplateIndex(templates),
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

  const templateArchivePath = selectedTemplate.archivePath;

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

  // Extract the packaged scaffold archive. Repo-only artifacts were already
  // stripped during the create-airjam build step that generated these archives.
  await extractScaffoldTemplateArchive({
    archivePath: templateArchivePath,
    targetDir,
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
      mcpServerVersion: manifest["@air-jam/mcp-server"],
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

  await fs.writeJson(
    path.join(targetDir, AIRJAM_PROJECT_MCP_FILE),
    createProjectLocalMcpConfig(),
    { spaces: 2 },
  );

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
    console.log(
      kleur.yellow("Skipped dependency installation (--skip-install).\n"),
    );
  }

  console.log("Next steps:\n");
  console.log(kleur.cyan(`  cd ${projectInput}`));
  console.log(kleur.cyan("  cp .env.example .env.local"));
  console.log(
    kleur.cyan("  pnpm run dev         # Recommended: start server + game"),
  );
  console.log(
    kleur.cyan(
      "  pnpm run dev -- --web-only  # Optional: official backend only",
    ),
  );
  console.log(
    kleur.cyan(
      "  # Optional HTTPS mode (needed for gyro/camera testing on phones)",
    ),
  );
  console.log(kleur.cyan("  pnpm run secure:init"));
  console.log(kleur.cyan("  pnpm run dev -- --secure"));
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
    .option(
      "--manifest-url <url>",
      "Override the hosted AI pack root manifest URL",
    )
    .option(
      "--manifest-file <path>",
      "Read the AI pack root manifest from a local file",
    )
    .action(async (options: unknown) => {
      await runAiPackStatus(
        resolveActionOptions<{
          dir?: string;
          manifestUrl?: string;
          manifestFile?: string;
        }>(options),
      );
    });

  aiPackCommand
    .command("diff")
    .description("Show AI pack file differences for a project")
    .option("--dir <path>", "Project directory to inspect")
    .option(
      "--manifest-url <url>",
      "Override the hosted AI pack root manifest URL",
    )
    .option(
      "--manifest-file <path>",
      "Read the AI pack root manifest from a local file",
    )
    .action(async (options: unknown) => {
      await runAiPackDiff(
        resolveActionOptions<{
          dir?: string;
          manifestUrl?: string;
          manifestFile?: string;
        }>(options),
      );
    });

  aiPackCommand
    .command("update")
    .description("Update managed AI pack assets for a project")
    .option("--dir <path>", "Project directory to inspect")
    .option(
      "--manifest-url <url>",
      "Override the hosted AI pack root manifest URL",
    )
    .option(
      "--manifest-file <path>",
      "Read the AI pack root manifest from a local file",
    )
    .option(
      "--force",
      "Overwrite same-version managed file drift during update",
      false,
    )
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
    .command("doctor")
    .description(
      "Inspect whether a project is ready for hosted release bundling",
    )
    .option("--dir <path>", "Project directory to inspect")
    .option("--dist-dir <path>", "Built static output directory")
    .action(async (options: unknown) => {
      await printReleaseDoctor(
        resolveActionOptions<{
          dir?: string;
          distDir?: string;
        }>(options),
      );
    });

  releaseCommand
    .command("bundle")
    .description("Create a hosted release zip from a built game project")
    .option("--dir <path>", "Project directory to bundle")
    .option("--dist-dir <path>", "Built static output directory")
    .option("--out <path>", "Output zip file path")
    .option(
      "--skip-build",
      "Reuse the existing dist directory without building",
      false,
    )
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

  releaseCommand
    .command("validate")
    .description(
      "Validate hosted release inputs or an existing hosted release zip",
    )
    .option("--dir <path>", "Project directory to inspect")
    .option("--dist-dir <path>", "Built static output directory")
    .option("--bundle <path>", "Existing hosted release zip to validate")
    .option(
      "--skip-build",
      "Reuse the existing dist directory without building",
      false,
    )
    .action(async (options: unknown) => {
      await runReleaseValidateCommand(
        resolveActionOptions<{
          dir?: string;
          distDir?: string;
          bundle?: string;
          skipBuild?: boolean;
        }>(options),
      );
    });

  releaseCommand
    .command("list")
    .description("List owned hosted games or releases for one hosted game")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--game <slug-or-id>", "List releases for one owned hosted game")
    .action(async (options: unknown) => {
      await runReleaseListCommand(
        resolveActionOptions<{
          platformUrl?: string;
          game?: string;
        }>(options),
      );
    });

  releaseCommand
    .command("inspect")
    .description("Inspect one hosted release from the Air Jam platform")
    .requiredOption("--release <id>", "Hosted release ID to inspect")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .action(async (options: unknown) => {
      const resolved = resolveActionOptions<{
        platformUrl?: string;
        release: string;
      }>(options);
      await runReleaseInspectCommand({
        platformUrl: resolved.platformUrl,
        releaseId: resolved.release,
      });
    });

  releaseCommand
    .command("submit")
    .description("Bundle a game and submit it as a hosted release draft")
    .requiredOption("--game <slug-or-id>", "Owned hosted game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--version-label <label>", "Optional hosted release version label")
    .option("--dir <path>", "Project directory to bundle")
    .option("--dist-dir <path>", "Built static output directory")
    .option("--bundle <path>", "Existing hosted release zip to submit")
    .option(
      "--skip-build",
      "Reuse the existing dist directory without building",
      false,
    )
    .option("--publish", "Publish immediately after successful finalize", false)
    .action(async (options: unknown) => {
      const resolved = resolveActionOptions<{
        platformUrl?: string;
        game: string;
        versionLabel?: string;
        dir?: string;
        distDir?: string;
        bundle?: string;
        skipBuild?: boolean;
        publish?: boolean;
      }>(options);

      await runReleaseSubmitCommand({
        platformUrl: resolved.platformUrl,
        game: resolved.game,
        versionLabel: resolved.versionLabel,
        dir: resolved.dir,
        distDir: resolved.distDir,
        bundle: resolved.bundle,
        skipBuild: resolved.skipBuild,
        publish: resolved.publish,
      });
    });

  releaseCommand
    .command("publish")
    .description("Publish one ready hosted release")
    .requiredOption("--release <id>", "Hosted release ID to publish")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .action(async (options: unknown) => {
      const resolved = resolveActionOptions<{
        platformUrl?: string;
        release: string;
      }>(options);
      await runReleasePublishCommand({
        platformUrl: resolved.platformUrl,
        releaseId: resolved.release,
      });
    });

  releaseCommand.action(() => {
    releaseCommand.outputHelp();
  });

  const authCommand = program
    .command("auth")
    .description("Authenticate the local Air Jam CLI with the hosted platform");

  authCommand
    .command("login")
    .description("Start browser-assisted Air Jam CLI login")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--client-name <name>", "Optional machine-readable client label")
    .action(async (options: unknown) => {
      await runAuthLoginCommand(
        resolveActionOptions<{
          platformUrl?: string;
          clientName?: string;
        }>(options),
      );
    });

  authCommand
    .command("whoami")
    .description("Inspect the current stored Air Jam platform session")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .action(async (options: unknown) => {
      await runAuthWhoAmICommand(
        resolveActionOptions<{
          platformUrl?: string;
        }>(options),
      );
    });

  authCommand
    .command("logout")
    .description("Revoke the current stored Air Jam platform session")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .action(async (options: unknown) => {
      await runAuthLogoutCommand(
        resolveActionOptions<{
          platformUrl?: string;
        }>(options),
      );
    });

  authCommand.action(() => {
    authCommand.outputHelp();
  });

  const mcpCommand = program
    .command("mcp")
    .description("Inspect or initialize project-local Air Jam MCP setup");

  mcpCommand
    .command("doctor")
    .description("Inspect the current project's Air Jam MCP setup")
    .option("--dir <path>", "Project directory to inspect")
    .action(async (options: unknown) => {
      await runMcpDoctor(
        resolveActionOptions<{
          dir?: string;
        }>(options),
      );
    });

  mcpCommand
    .command("init")
    .description(`Write ${AIRJAM_PROJECT_MCP_FILE} for the current project`)
    .option("--dir <path>", "Project directory to inspect")
    .option("--force", "Overwrite an existing project-local MCP config", false)
    .action(async (options: unknown) => {
      await runMcpInit(
        resolveActionOptions<{
          dir?: string;
          force?: boolean;
        }>(options),
      );
    });

  mcpCommand
    .command("config")
    .description("Print the recommended project-local MCP config JSON")
    .option("--dir <path>", "Project directory to inspect")
    .action(async (options: unknown) => {
      await runMcpConfig(
        resolveActionOptions<{
          dir?: string;
        }>(options),
      );
    });

  mcpCommand.action(() => {
    mcpCommand.outputHelp();
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

  program
    .command("topology")
    .description(
      "Print the resolved project runtime topology for the current game",
    )
    .allowUnknownOption(false)
    .requiredOption(
      "--mode <mode>",
      "Topology mode to inspect (standalone-dev, self-hosted-production, hosted-release)",
    )
    .option(
      "--secure",
      "Resolve standalone local topology using trusted local HTTPS",
      false,
    )
    .action(async () => {
      await runProjectTopologyCli({
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
  if (isEnvValidationError(err)) {
    console.error(
      formatEnvValidationError(err, {
        docsHint:
          "Fix the listed env values in .env.local (or CI/deployment env) and retry.",
      }),
    );
    process.exit(1);
    return;
  }

  console.error(kleur.red("Error:"), err);
  process.exit(1);
});

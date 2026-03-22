import { program } from "commander";
import fs from "fs-extra";
import kleur from "kleur";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizeWorkspaceSpecs = (
  deps: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!deps) return deps;

  return Object.fromEntries(
    Object.entries(deps).map(([name, range]) => {
      if (!range.startsWith("workspace:")) {
        return [name, range];
      }
      return [name, range.replace(/^workspace:/, "")];
    }),
  );
};

async function main() {
  program
    .name("create-airjam")
    .description("Scaffold a new Air Jam game project")
    .argument("[project-name]", "Name of the project directory")
    .option("-t, --template <template>", "Template to use", "pong")
    .option("--skip-install", "Skip dependency installation", false)
    .parse();

  const args = program.args;
  const options = program.opts<{ template: string; skipInstall: boolean }>();

  let projectName = args[0];

  if (!projectName) {
    const response = await prompts({
      type: "text",
      name: "projectName",
      message: "Project name:",
      initial: "my-airjam-game",
    });
    projectName = response.projectName;
    if (!projectName) {
      console.log(kleur.red("Project name is required"));
      process.exit(1);
    }
  }

  const targetDir = path.resolve(process.cwd(), projectName);
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
      message: `Directory "${projectName}" already exists. Overwrite?`,
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
    pkg.name = projectName;
    pkg.dependencies = normalizeWorkspaceSpecs(pkg.dependencies);
    pkg.devDependencies = normalizeWorkspaceSpecs(pkg.devDependencies);
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

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
  console.log(kleur.cyan(`  cd ${projectName}`));
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

main().catch((err) => {
  console.error(kleur.red("Error:"), err);
  process.exit(1);
});

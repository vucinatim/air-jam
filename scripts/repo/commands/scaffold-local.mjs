import {
  buildLocalScaffoldPackageSet,
  getLocalScaffoldExactZodVersion,
  listLocalScaffoldDirectDependencyNames,
  listLocalScaffoldOverrideDependencyNames,
  packLocalScaffoldPackageSet,
  resolveLocalScaffoldWorkspaceSpecs,
} from "../lib/local-scaffold-packages.mjs";
import { createAirjamCliEntry } from "../lib/paths.mjs";
import { runCommand } from "../lib/shell.mjs";

export const runRepoScaffoldLocalCommand = ({
  projectName,
  source = "tarball",
  template = "pong",
  cwd = process.cwd(),
} = {}) => {
  if (!projectName) {
    throw new Error(
      "Usage: pnpm run repo -- scaffold local <project-name> [--source <tarball|workspace|registry>] [--template <id>]",
    );
  }

  if (!["tarball", "workspace", "registry"].includes(source)) {
    throw new Error(`Unsupported --source value "${source}"`);
  }

  const commandArgs = [
    createAirjamCliEntry,
    projectName,
    "--template",
    template,
  ];

  if (source === "registry") {
    runCommand("pnpm", ["--filter", "create-airjam", "build"]);
  } else {
    buildLocalScaffoldPackageSet();
  }

  if (source === "tarball") {
    const { setDir, setId, tarballs } = packLocalScaffoldPackageSet();

    console.log("");
    console.log(`Using immutable local tarball set ${setId}:`);
    console.log(`- ${setDir}`);

    for (const packageName of listLocalScaffoldDirectDependencyNames()) {
      const spec = tarballs.get(packageName);
      if (!spec) {
        throw new Error(`Missing local scaffold tarball for "${packageName}"`);
      }
      commandArgs.push("--dep-spec", `${packageName}=file:${spec}`);
    }

    for (const packageName of listLocalScaffoldOverrideDependencyNames()) {
      const spec = tarballs.get(packageName);
      if (!spec) {
        throw new Error(`Missing local scaffold tarball for "${packageName}"`);
      }
      commandArgs.push("--override-spec", `${packageName}=file:${spec}`);
    }
  } else if (source === "workspace") {
    const workspaceSpecs = resolveLocalScaffoldWorkspaceSpecs();

    for (const packageName of listLocalScaffoldDirectDependencyNames()) {
      const spec = workspaceSpecs.get(packageName);
      if (!spec) {
        throw new Error(
          `Missing local scaffold workspace spec for "${packageName}"`,
        );
      }
      commandArgs.push("--dep-spec", `${packageName}=${spec}`);
    }

    const zodVersion = getLocalScaffoldExactZodVersion();
    if (zodVersion) {
      commandArgs.push("--dep-spec", `zod=${zodVersion}`);
    }

    for (const packageName of listLocalScaffoldOverrideDependencyNames()) {
      const spec = workspaceSpecs.get(packageName);
      if (!spec) {
        throw new Error(
          `Missing local scaffold workspace spec for "${packageName}"`,
        );
      }
      commandArgs.push("--override-spec", `${packageName}=${spec}`);
    }
  }

  runCommand("node", commandArgs, { cwd });
};

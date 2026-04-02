import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const cliEntry = path.join(repoRoot, "packages", "create-airjam", "dist", "index.js");
const tarballDir = path.join(repoRoot, ".airjam", "tarballs");

const args = process.argv.slice(2).filter((value) => value !== "--");
const sourceArg = args.find((value) => value.startsWith("--source="));
const templateArg = args.find((value) => value.startsWith("--template="));
const source = sourceArg ? sourceArg.split("=")[1] : "tarball";
const template = templateArg ? templateArg.split("=")[1] : "pong";
const forwardedArgs = args.filter(
  (value) => !value.startsWith("--source=") && !value.startsWith("--template="),
);

const projectName = forwardedArgs[0];

if (!projectName) {
  console.error(
    "Usage: pnpm scaffold:tarball -- <project-name> [--template=<id>]",
  );
  process.exit(1);
}

if (!["tarball", "workspace", "registry"].includes(source)) {
  console.error(`Unsupported --source value "${source}"`);
  process.exit(1);
}

const run = (command, cwd = repoRoot) => {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
  });
};

const toTarballBaseName = (packageName) =>
  packageName.replace(/^@/, "").replace(/\//g, "-");

const packWorkspacePackage = (packageDir) => {
  fs.mkdirSync(tarballDir, { recursive: true });
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );
  const expectedTarball = `${toTarballBaseName(packageJson.name)}-${packageJson.version}.tgz`;
  const tarballPath = path.join(tarballDir, expectedTarball);

  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  run(`pnpm pack --pack-destination ${JSON.stringify(tarballDir)}`, packageDir);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return tarballPath;
};

const quoted = (value) => JSON.stringify(value);

const main = () => {
  run("pnpm --filter create-airjam build");

  const command = [
    "node",
    quoted(cliEntry),
    quoted(projectName),
    "--template",
    quoted(template),
  ];

  if (source === "tarball") {
    run("pnpm --filter sdk build");
    run("pnpm --filter server build");

    const sdkTarball = packWorkspacePackage(path.join(repoRoot, "packages", "sdk"));
    const serverTarball = packWorkspacePackage(
      path.join(repoRoot, "packages", "server"),
    );

    command.push("--dep-spec", quoted(`@air-jam/sdk=file:${sdkTarball}`));
    command.push("--dep-spec", quoted(`@air-jam/server=file:${serverTarball}`));
    command.push("--override-spec", quoted(`@air-jam/sdk=file:${sdkTarball}`));
  } else if (source === "workspace") {
    run("pnpm --filter sdk build");
    run("pnpm --filter server build");

    const sdkPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "packages", "sdk", "package.json"),
        "utf-8",
      ),
    );

    command.push(
      "--dep-spec",
      quoted(`@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`),
    );
    command.push(
      "--dep-spec",
      quoted(`@air-jam/server=link:${path.join(repoRoot, "packages", "server")}`),
    );
    command.push(
      "--dep-spec",
      quoted(`zod=${String(sdkPackageJson.dependencies?.zod ?? "").replace(/^[~^]/, "")}`),
    );
    command.push(
      "--override-spec",
      quoted(`@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`),
    );
  }

  run(command.join(" "), process.cwd());
};

main();

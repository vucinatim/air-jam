import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PUBLIC_PACKAGE_DEFINITIONS } from "../../release/public-packages.mjs";
import { repoRoot } from "./paths.mjs";
import { runCommandCaptured } from "./shell.mjs";

const scenarios = {
  server: {
    packageIds: ["sdk", "server"],
    fixtures: [
      ["server-package-consumer.mts", "consumer.mts"],
      ["server-package-runtime.mjs", "verify.mjs"],
    ],
    dependencies: ["socket.io-client@4.8.3"],
    typecheckFiles: ["consumer.mts"],
    runtimeArguments: ["verify.mjs"],
  },
  libraries: {
    packageIds: PUBLIC_PACKAGE_DEFINITIONS.filter(
      (entry) => !["server", "create-airjam"].includes(entry.id),
    ).map((entry) => entry.id),
    fixtures: [
      ["foundation-library-consumer.mts", "consumer.mts"],
      ["foundation-library-config.ts", "src/airjam.config.ts"],
      ["foundation-library-scenarios.ts", "src/visual-scenarios.ts"],
    ],
    dependencies: ["@types/react@19.2.5"],
    typecheckFiles: [
      "consumer.mts",
      "src/airjam.config.ts",
      "src/visual-scenarios.ts",
    ],
    runtimeArguments: ["--import", "tsx", "consumer.mts"],
  },
};

export const verifyPackageScenario = async (setDir, scenarioId) => {
  const scenario = scenarios[scenarioId];
  if (!scenario)
    throw new Error(`Unknown package proof scenario: ${scenarioId}`);
  const root = path.resolve(setDir);
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "manifest.json"), "utf8"),
  );
  const artifacts = [];
  for (const packageId of scenario.packageIds) {
    const definition = PUBLIC_PACKAGE_DEFINITIONS.find(
      (entry) => entry.id === packageId,
    );
    if (!definition) throw new Error(`Unknown public package: ${packageId}`);
    const packageName = definition.packageName;
    const filename = manifest.packages?.[packageName];
    if (
      typeof filename !== "string" ||
      path.basename(filename) !== filename ||
      !filename.endsWith(".tgz")
    ) {
      throw new Error(`Candidate set requires a tarball for ${packageName}`);
    }
    const tarball = path.join(root, filename);
    artifacts.push({
      packageName,
      tarball,
      sha256: createHash("sha256")
        .update(await fs.readFile(tarball))
        .digest("hex"),
    });
  }
  const consumerRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `airjam-package-proof-${scenarioId}-`),
  );
  try {
    for (const [source, destination] of scenario.fixtures) {
      const target = path.join(consumerRoot, destination);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(
        path.join(repoRoot, "scripts/repo/fixtures", source),
        target,
      );
    }
    const run = (command, argumentsList) =>
      runCommandCaptured(command, argumentsList, { cwd: consumerRoot });
    await run("npm", ["init", "--yes"]);
    await run("npm", ["pkg", "set", "type=module"]);
    await run("npm", [
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      ...artifacts.map((artifact) => artifact.tarball),
      "typescript@5.9.3",
      "@types/node@24.10.1",
      ...scenario.dependencies,
    ]);
    await run("npx", [
      "--no-install",
      "tsc",
      "--noEmit",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "--strict",
      ...scenario.typecheckFiles,
    ]);
    const runtime = await run(process.execPath, scenario.runtimeArguments);
    return {
      contractVersion: 1,
      setId: manifest.setId,
      artifacts,
      checks: { typedConsumer: true, ...JSON.parse(runtime.stdout) },
    };
  } finally {
    await fs.rm(consumerRoot, { recursive: true, force: true });
  }
};

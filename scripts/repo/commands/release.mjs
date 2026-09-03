import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  resolvePublicPackages,
  resolveUnifiedPublicVersion,
} from "../../release/public-packages.mjs";
import {
  aggregatePublicInstallMatrixEvidence,
  defaultPublicInstallMatrixPath,
  readPublicInstallMatrix,
  runPublicInstallMatrixCell,
  summarizePublicInstallMatrix,
  writeJsonAtomically,
} from "../lib/public-install-matrix.mjs";

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const assertChannel = (channel) => {
  if (channel !== "latest" && channel !== "next") {
    throw new Error(`Unsupported release channel "${channel}".`);
  }
};

const buildReleaseTag = ({ channel, version }) => {
  return channel === "next"
    ? `release/public-next-v${version}`
    : `release/public-v${version}`;
};

const runRepoReleaseTriggerCommand = ({ channel, packageSelection }) => {
  assertChannel(channel);
  resolvePublicPackages(packageSelection);

  runCommand("gh", [
    "workflow",
    "run",
    "publish-packages.yml",
    "-f",
    `package=${packageSelection}`,
    "-f",
    `channel=${channel}`,
  ]);
};

const runRepoReleaseTagCommand = ({ channel }) => {
  assertChannel(channel);

  const releaseVersion = resolveUnifiedPublicVersion();
  const tag = buildReleaseTag({ channel, version: releaseVersion });

  runCommand("git", ["tag", tag]);
  runCommand("git", ["push", "origin", tag]);
};

export const registerReleaseCommands = (program) => {
  const releaseCommand = program
    .command("release")
    .description("Public npm release helpers");

  const installMatrixCommand = releaseCommand
    .command("install-matrix")
    .description(
      "Define, execute, and aggregate the clean public installation matrix",
    );

  installMatrixCommand
    .command("spec")
    .description("Inspect the canonical public installation support matrix")
    .option("--json", "Print stable JSON")
    .action((options) => {
      const result = summarizePublicInstallMatrix(
        readPublicInstallMatrix(defaultPublicInstallMatrixPath),
      );
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      console.log(
        `${result.id}: ${result.cells.length} cells, ${result.packages.length} public packages.`,
      );
    });

  installMatrixCommand
    .command("verify")
    .description(
      "Run the current operating-system and Node.js cell through exact candidate packages",
    )
    .option("--expected-os <id>", "Fail unless the observed support OS matches")
    .option(
      "--expected-node <major>",
      "Fail unless the observed Node.js major matches",
      (value) => Number.parseInt(value, 10),
    )
    .option("--output <path>", "Atomically write the JSON evidence document")
    .option("--json", "Print stable JSON")
    .action(async (options) => {
      const result = await runPublicInstallMatrixCell({
        expectedOperatingSystem: options.expectedOs,
        expectedNodeMajor: options.expectedNode,
        onProgress: (stage) => {
          process.stderr.write(`[release install-matrix] ${stage}\n`);
        },
      });
      if (options.output) writeJsonAtomically(options.output, result);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      console.log(`Public install matrix cell ${result.cell.id} passed.`);
      if (options.output)
        console.log(`Evidence: ${path.resolve(options.output)}`);
    });

  installMatrixCommand
    .command("aggregate")
    .description(
      "Validate and combine one exact evidence document per support cell",
    )
    .requiredOption(
      "--evidence-root <path>",
      "Directory containing downloaded matrix-cell JSON evidence",
    )
    .option("--output <path>", "Atomically write the aggregate JSON document")
    .option("--json", "Print stable JSON")
    .action((options) => {
      const result = aggregatePublicInstallMatrixEvidence({
        evidenceRoot: options.evidenceRoot,
      });
      if (options.output) writeJsonAtomically(options.output, result);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      console.log(
        `Public install matrix passed for ${result.cells.length} cells at ${result.commit}.`,
      );
      if (options.output)
        console.log(`Evidence: ${path.resolve(options.output)}`);
    });

  installMatrixCommand.action(() => {
    installMatrixCommand.outputHelp();
  });

  releaseCommand
    .command("trigger")
    .description(
      "Trigger the Publish Packages GitHub Actions workflow through gh",
    )
    .option(
      "--package <packageSelection>",
      "Public package selection to publish",
      "all-public",
    )
    .option("--channel <channel>", "npm dist-tag to publish under", "latest")
    .action((options) => {
      runRepoReleaseTriggerCommand({
        channel: options.channel,
        packageSelection: options.package,
      });
    });

  releaseCommand
    .command("tag")
    .description(
      "Create and push the canonical public release tag for automated GitHub publishing",
    )
    .option("--channel <channel>", "npm dist-tag to publish under", "latest")
    .action((options) => {
      runRepoReleaseTagCommand({
        channel: options.channel,
      });
    });

  return releaseCommand;
};

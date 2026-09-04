import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  aggregatePublicInstallMatrixEvidence,
  defaultPublicInstallMatrixPath,
  readPublicInstallMatrix,
  runPublicInstallMatrixCell,
  summarizePublicInstallMatrix,
  writeJsonAtomically,
} from "../lib/public-install-matrix.mjs";
import {
  createPublicReleaseCandidate,
  publishPublicReleaseCandidate,
  validatePublicReleaseCandidate,
} from "../lib/public-release-candidate.mjs";

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

const normalizeEmergencyReason = (reason) => {
  if (!reason) return null;
  const normalized = reason.trim();
  if (normalized.length < 12) {
    throw new Error("Emergency reason must contain at least 12 characters.");
  }
  return normalized;
};

const runRepoReleaseTriggerCommand = ({ channel, emergencyReason }) => {
  assertChannel(channel);
  const normalizedEmergencyReason = normalizeEmergencyReason(emergencyReason);
  const args = [
    "workflow",
    "run",
    "publish-packages.yml",
    "--ref",
    "main",
    "-f",
    `channel=${channel}`,
  ];
  if (normalizedEmergencyReason) {
    args.push("-f", `emergency_reason=${normalizedEmergencyReason}`);
  }
  runCommand("gh", args);
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
    .requiredOption(
      "--candidate <path>",
      "Immutable public release candidate directory to verify",
    )
    .option(
      "--expected-node <major>",
      "Fail unless the observed Node.js major matches",
      (value) => Number.parseInt(value, 10),
    )
    .option("--output <path>", "Atomically write the JSON evidence document")
    .option("--json", "Print stable JSON")
    .action(async (options) => {
      const result = await runPublicInstallMatrixCell({
        candidateDirectory: options.candidate,
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

  const candidateCommand = releaseCommand
    .command("candidate")
    .description("Create and verify one immutable public package candidate");

  candidateCommand
    .command("create")
    .description(
      "Validate, build, inventory, audit, and pack the public graph once",
    )
    .requiredOption("--output <path>", "New candidate directory")
    .option("--json", "Print stable JSON")
    .action((options) => {
      const result = createPublicReleaseCandidate({
        outputDirectory: options.output,
        onProgress: (stage) => {
          process.stderr.write(`[release candidate] ${stage}\n`);
        },
      });
      const summary = {
        ok: true,
        contract: result.manifest.contract,
        root: result.root,
        commit: result.manifest.source.commit,
        version: result.manifest.version,
        candidateDigest: result.candidateDigest,
        packages: result.manifest.packages.map((entry) => ({
          name: entry.name,
          file: entry.file,
          bytes: entry.bytes,
          sha256: entry.sha256,
          integrity: entry.integrity,
        })),
      };
      if (options.json)
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      else
        console.log(
          `Created public release candidate ${result.candidateDigest}.`,
        );
    });

  candidateCommand
    .command("verify")
    .description(
      "Verify candidate structure, identity, and every retained digest",
    )
    .requiredOption("--candidate <path>", "Candidate directory to verify")
    .option("--expected-commit <sha>", "Require one exact source commit")
    .option("--json", "Print stable JSON")
    .action((options) => {
      const result = validatePublicReleaseCandidate(options.candidate, {
        expectedCommit: options.expectedCommit,
      });
      const summary = {
        ok: true,
        contract: result.manifest.contract,
        root: result.root,
        commit: result.manifest.source.commit,
        version: result.manifest.version,
        candidateDigest: result.candidateDigest,
        packages: result.manifest.packages,
      };
      if (options.json)
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      else
        console.log(
          `Verified public release candidate ${result.candidateDigest}.`,
        );
    });

  candidateCommand.action(() => candidateCommand.outputHelp());

  releaseCommand
    .command("publish")
    .description(
      "Preview exact-candidate npm publication; apply is GitHub OIDC-only",
    )
    .requiredOption("--candidate <path>", "Immutable candidate directory")
    .requiredOption("--channel <channel>", "npm dist-tag: latest or next")
    .requiredOption("--expected-commit <sha>", "Exact source commit")
    .option("--emergency-reason <reason>", "Retained emergency-release reason")
    .option("--output <path>", "Write publication evidence")
    .option("--json", "Print stable JSON")
    .action((options) => {
      const result = publishPublicReleaseCandidate({
        candidateDirectory: options.candidate,
        channel: options.channel,
        expectedCommit: options.expectedCommit,
        emergencyReason: options.emergencyReason,
        outputPath: options.output,
        apply: false,
        onProgress: (stage) =>
          process.stderr.write(`[release publish] ${stage}\n`),
      });
      if (options.json)
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else
        console.log(
          `${result.mode} verified for candidate ${result.candidateDigest}.`,
        );
    });

  releaseCommand
    .command("trigger")
    .description(
      "Trigger the Publish Packages GitHub Actions workflow through gh",
    )
    .option("--channel <channel>", "npm dist-tag to publish under", "latest")
    .option(
      "--emergency-reason <reason>",
      "Retain an incident reason without bypassing release proof",
    )
    .action((options) => {
      runRepoReleaseTriggerCommand({
        channel: options.channel,
        emergencyReason: options.emergencyReason,
      });
    });

  return releaseCommand;
};

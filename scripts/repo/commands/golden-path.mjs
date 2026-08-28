import path from "node:path";

import { runGoldenPathBootstrap } from "../lib/golden-path-bootstrap.mjs";
import { runGoldenPathPrimary } from "../lib/golden-path-primary-run.mjs";
import {
  defaultGoldenPathManifestPath,
  readGoldenPathProgram,
  summarizeGoldenPathProgram,
  validateGoldenPathProgram,
} from "../lib/golden-path-program.mjs";
import { repoRoot } from "../lib/paths.mjs";

const resolveManifestPath = (value) => {
  if (!value) return defaultGoldenPathManifestPath;
  const resolved = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--manifest must resolve inside the repository.");
  }
  return resolved;
};

const printJson = (value) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const addManifestOption = (command) =>
  command.option("--manifest <path>", "Repo-relative scenario manifest path");

export const registerGoldenPathCommands = (program) => {
  const goldenPathCommand = program
    .command("golden-path")
    .description(
      "Inspect and validate the external-agent golden-path contract",
    );

  addManifestOption(
    goldenPathCommand
      .command("spec")
      .description("Print the canonical replayable scenario specification")
      .option("--json", "Print stable JSON"),
  ).action((options) => {
    const spec = summarizeGoldenPathProgram(
      readGoldenPathProgram(resolveManifestPath(options.manifest)),
    );
    if (options.json) {
      printJson(spec);
      return;
    }
    console.log(`${spec.title} (${spec.id})`);
    console.log(
      `Clients: ${spec.clients.primary.profile} primary, ${spec.clients.secondary.profile} secondary`,
    );
    console.log(`Stages: ${spec.stages.map((stage) => stage.id).join(" -> ")}`);
    console.log(`Evidence: ${spec.evidenceBundle.format}`);
    console.log(`Contract: ${spec.contract}`);
  });

  addManifestOption(
    goldenPathCommand
      .command("validate")
      .description("Validate scenario structure and referenced contract files")
      .option("--json", "Print stable JSON"),
  ).action((options) => {
    const manifestPath = resolveManifestPath(options.manifest);
    const programState = readGoldenPathProgram(manifestPath);
    validateGoldenPathProgram(programState);
    const result = {
      ok: true,
      id: programState.id,
      manifest: path.relative(repoRoot, manifestPath),
      stages: programState.stages.length,
      evidenceFormat: programState.evidenceBundle.format,
    };
    if (options.json) printJson(result);
    else {
      console.log(
        `Golden-path program is valid: ${result.stages} stages, ${result.evidenceFormat}.`,
      );
    }
  });

  goldenPathCommand
    .command("bootstrap")
    .description(
      "Prove candidate package installation and MCP discovery through an isolated registry",
    )
    .option("--template <id>", "Scaffold template to prove", "minimal")
    .option("--keep-workspace", "Retain the run-owned temporary workspace")
    .option("--json", "Print stable JSON")
    .action(async (options) => {
      const result = await runGoldenPathBootstrap({
        template: options.template,
        keepWorkspace: options.keepWorkspace === true,
        onProgress: (stage) => {
          process.stderr.write(`[golden-path bootstrap] ${stage}\n`);
        },
      });
      if (options.json) {
        printJson(result);
        return;
      }
      console.log(
        `Golden-path bootstrap passed for ${result.project.name} with ${result.discovery.mcpTools.length} MCP tools.`,
      );
      if (result.retainedWorkspace) {
        console.log(`Retained workspace: ${result.retainedWorkspace}`);
      }
    });

  goldenPathCommand
    .command("run-primary")
    .description(
      "Run the canonical clean-room lifecycle through an external Codex process",
    )
    .requiredOption(
      "--staging-url <url>",
      "Isolated hidden-staging platform URL",
    )
    .option("--run-id <id>", "Stable run identity")
    .option("--evidence-dir <path>", "Run-owned evidence directory")
    .option("--model <model>", "Codex model override")
    .option(
      "--discard-workspace",
      "Remove the workspace after indexing evidence",
    )
    .option("--json", "Print stable JSON")
    .action(async (options) => {
      const result = await runGoldenPathPrimary({
        runId: options.runId,
        stagingUrl: options.stagingUrl,
        evidenceDirectory: options.evidenceDir,
        keepWorkspace: options.discardWorkspace !== true,
        model: options.model,
        onProgress: (stage) => {
          process.stderr.write(`[golden-path primary] ${stage}\n`);
        },
      });
      if (options.json) printJson(result);
      else {
        console.log(
          `Golden-path primary run ${result.runId}: ${result.result}.`,
        );
        console.log(`Evidence: ${result.evidenceDirectory}`);
      }
      if (!result.ok) process.exitCode = 1;
    });
};

import path from "node:path";

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
};

#!/usr/bin/env node

import { publishPublicReleaseCandidate } from "../repo/lib/public-release-candidate.mjs";

const readOption = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const candidateDirectory = readOption("--candidate");
const channel = readOption("--channel");
const expectedCommit = readOption("--expected-commit");
const emergencyReason = readOption("--emergency-reason")?.trim() || null;
const outputPath = readOption("--output");
const apply = process.argv.includes("--apply");

if (!candidateDirectory || !channel || !expectedCommit) {
  throw new Error(
    "Usage: publish-public-candidate.mjs --candidate <path> --channel <latest|next> --expected-commit <sha> [--emergency-reason <reason>] [--output <path>] [--apply]",
  );
}

const result = publishPublicReleaseCandidate({
  candidateDirectory,
  channel,
  expectedCommit,
  emergencyReason,
  outputPath,
  apply,
  onProgress: (stage) => process.stderr.write(`[release publish] ${stage}\n`),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

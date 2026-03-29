import { generatePlatformAiPackArtifacts } from "./lib/platform-ai-pack-artifacts.mjs";

const result = await generatePlatformAiPackArtifacts();

console.log(
  `✓ Generated hosted AI pack artifacts for ${result.channel}@${result.packVersion} (${result.fileCount} files)`,
);

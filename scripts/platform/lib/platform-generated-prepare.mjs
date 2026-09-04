import { generateBaseDocsPack } from "../../../packages/cli/scripts/base-docs-pack.mjs";
import { writeGeneratedContentBlogSource } from "../../content/lib/content-blog-source-generator.mjs";
import { writeGeneratedContentDocsSource } from "../../content/lib/content-docs-source-generator.mjs";
import { generatePlatformAiPackArtifacts } from "./platform-ai-pack-artifacts.mjs";
import { generatePlatformSchemaHead } from "./platform-schema-head-generator.mjs";

export async function preparePlatformGeneratedArtifacts() {
  await Promise.all([
    writeGeneratedContentDocsSource(),
    writeGeneratedContentBlogSource(),
    generateBaseDocsPack(),
    generatePlatformSchemaHead(),
  ]);

  const result = await generatePlatformAiPackArtifacts();

  return {
    channel: result.channel,
    packVersion: result.packVersion,
    fileCount: result.fileCount,
  };
}

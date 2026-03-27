import { writeGeneratedContentDocsSource } from "./lib/content-docs-source-generator.mjs";

writeGeneratedContentDocsSource().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

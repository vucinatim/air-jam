import { assertGeneratedContentDocsSourceIsFresh } from "./lib/content-docs-source-generator.mjs";

assertGeneratedContentDocsSourceIsFresh().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { assertGeneratedContentBlogSourceIsFresh } from "./lib/content-blog-source-generator.mjs";
import { assertGeneratedContentDocsSourceIsFresh } from "./lib/content-docs-source-generator.mjs";

Promise.all([
  assertGeneratedContentDocsSourceIsFresh(),
  assertGeneratedContentBlogSourceIsFresh(),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

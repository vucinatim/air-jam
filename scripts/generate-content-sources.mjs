import { writeGeneratedContentBlogSource } from "./lib/content-blog-source-generator.mjs";
import { writeGeneratedContentDocsSource } from "./lib/content-docs-source-generator.mjs";

Promise.all([
  writeGeneratedContentDocsSource(),
  writeGeneratedContentBlogSource(),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

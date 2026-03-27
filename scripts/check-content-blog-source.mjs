import { assertGeneratedContentBlogSourceIsFresh } from "./lib/content-blog-source-generator.mjs";

assertGeneratedContentBlogSourceIsFresh().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

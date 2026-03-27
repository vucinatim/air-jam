import { writeGeneratedContentBlogSource } from "./lib/content-blog-source-generator.mjs";

writeGeneratedContentBlogSource().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

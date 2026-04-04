import {
  assertGeneratedContentBlogSourceIsFresh,
  writeGeneratedContentBlogSource,
} from "../../content/lib/content-blog-source-generator.mjs";
import {
  assertGeneratedContentDocsSourceIsFresh,
  writeGeneratedContentDocsSource,
} from "../../content/lib/content-docs-source-generator.mjs";

const writeAllContentSources = async () => {
  await Promise.all([
    writeGeneratedContentDocsSource(),
    writeGeneratedContentBlogSource(),
  ]);

  console.log("✓ Generated platform content sources");
};

const assertAllContentSourcesAreFresh = async () => {
  await Promise.all([
    assertGeneratedContentDocsSourceIsFresh(),
    assertGeneratedContentBlogSourceIsFresh(),
  ]);

  console.log("✓ Platform content sources are fresh");
};

export const registerContentCommands = (program) => {
  const contentCommand = program
    .command("content")
    .description("Docs and blog content generation/checks");

  contentCommand
    .command("generate")
    .description("Generate both docs and blog platform content sources")
    .action(writeAllContentSources);

  contentCommand
    .command("check")
    .description("Verify both docs and blog platform content sources are fresh")
    .action(assertAllContentSourcesAreFresh);

  const docsCommand = contentCommand
    .command("docs")
    .description("Docs content generation/checks");

  docsCommand
    .command("generate")
    .description("Generate platform docs content source")
    .action(async () => {
      await writeGeneratedContentDocsSource();
      console.log("✓ Generated platform docs content source");
    });

  docsCommand
    .command("check")
    .description("Verify platform docs content source is fresh")
    .action(async () => {
      await assertGeneratedContentDocsSourceIsFresh();
      console.log("✓ Platform docs content source is fresh");
    });

  const blogCommand = contentCommand
    .command("blog")
    .description("Blog content generation/checks");

  blogCommand
    .command("generate")
    .description("Generate platform blog content source")
    .action(async () => {
      await writeGeneratedContentBlogSource();
      console.log("✓ Generated platform blog content source");
    });

  blogCommand
    .command("check")
    .description("Verify platform blog content source is fresh")
    .action(async () => {
      await assertGeneratedContentBlogSourceIsFresh();
      console.log("✓ Platform blog content source is fresh");
    });

  return contentCommand;
};

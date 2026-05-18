import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertGeneratedContentBlogSourceIsFresh,
  writeGeneratedContentBlogSource,
} from "../../content/lib/content-blog-source-generator.mjs";
import {
  assertGeneratedContentDocsSourceIsFresh,
  writeGeneratedContentDocsSource,
} from "../../content/lib/content-docs-source-generator.mjs";
import {
  assertBlogAssetsExist,
  assertDevtoExportsRun,
} from "../../content/lib/blog-validation.mjs";
import { scaffoldBlogPost } from "../../content/lib/blog-scaffold.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const devtoExportScript = path.join(
  repoRoot,
  "scripts",
  "content",
  "devto-export.ts",
);

const runDevtoExport = (slug) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "tsx", devtoExportScript, slug],
      { stdio: "inherit", cwd: repoRoot },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`devto-export exited with code ${code}`));
      }
    });
  });

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
  await assertBlogAssetsExist();
  await assertDevtoExportsRun();

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
    .description(
      "Verify platform blog content source is fresh and articles are well-formed",
    )
    .action(async () => {
      await assertGeneratedContentBlogSourceIsFresh();
      await assertBlogAssetsExist();
      await assertDevtoExportsRun();
      console.log("✓ Platform blog content is healthy");
    });

  blogCommand
    .command("export-devto <slug>")
    .description(
      "Generate dev-to.md from a blog post's post.mdx + devto.config.ts",
    )
    .action(async (slug) => {
      await runDevtoExport(slug);
    });

  blogCommand
    .command("new <slug>")
    .description("Scaffold a new blog post (post.mdx, post.meta.ts, assets dir)")
    .option("--title <title>", "Article title", "Untitled draft")
    .option("--author <author>", "Article author", "Air Jam Team")
    .option("--devto", "Also scaffold devto.config.ts for cross-posting", false)
    .action(async (slug, options) => {
      const result = await scaffoldBlogPost({
        slug,
        title: options.title,
        author: options.author,
        withDevto: Boolean(options.devto),
      });
      console.log(`✓ Scaffolded blog post "${result.slug}"`);
      console.log(`  post:   ${path.relative(repoRoot, result.postDir)}`);
      console.log(`  assets: ${path.relative(repoRoot, result.publicAssetsDir)}`);
      if (result.withDevto) {
        console.log(`  devto:  devto.config.ts created`);
      }
      console.log("");
      console.log("Next steps:");
      console.log("  1. Write your article in post.mdx");
      console.log(`  2. Add images to ${path.relative(repoRoot, result.publicAssetsDir)}/`);
      console.log("  3. Run: pnpm run repo -- content blog generate");
      console.log(
        "  4. Preview drafts: PLATFORM_INCLUDE_DRAFTS=1 pnpm --filter platform dev",
      );
    });

  blogCommand
    .command("open <slug>")
    .description("Open the rendered blog post in your default browser")
    .option(
      "--base <url>",
      "Base URL (default http://localhost:3000)",
      "http://localhost:3000",
    )
    .action(async (slug, options) => {
      const url = `${options.base.replace(/\/$/, "")}/blog/${slug}`;
      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      const child = spawn(opener, [url], { stdio: "ignore", detached: true });
      child.unref();
      console.log(`✓ Opening ${url}`);
    });

  return contentCommand;
};

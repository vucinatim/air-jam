/**
 * Scaffold a new blog post.
 *
 * Creates content/blog/<slug>/{post.mdx, post.meta.ts} and the public asset
 * directory at apps/platform/public/blog-assets/<slug>/. Optionally creates
 * devto.config.ts if --devto is passed.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugToExportName(slug) {
  const camel = slug.replace(/-([a-z0-9])/g, (_, character) =>
    character.toUpperCase(),
  );
  return `${camel}BlogPost`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderPostMdx() {
  return `import { metadata } from "./post.meta";

export { metadata };

Start writing the article body here. Use plain Markdown — keep MDX-only syntax
out of cross-posted articles so the dev.to exporter produces clean output.

## A heading

Body paragraph.

![Alt text describing the image](/blog-assets/${"<slug>"}/example.png)
`;
}

function renderPostMeta({ exportName, title, author }) {
  const safeTitle = title.replace(/"/g, '\\"');
  return `import { defineBlogPost } from "@/features/blog/metadata";

export const ${exportName} = defineBlogPost({
  title: "${safeTitle}",
  summary: "One-sentence summary that shows in the blog index and as social description.",
  publishedAt: "${new Date().toISOString()}",
  author: "${author.replace(/"/g, '\\"')}",
  tags: ["airjam"],
  // Flip to true when ready to publish. Drafts can be previewed locally with
  // PLATFORM_INCLUDE_DRAFTS=1 pnpm --filter platform dev.
  published: false,
});

export const metadata = ${exportName};
`;
}

function renderDevtoConfig({ title }) {
  const safeTitle = title.replace(/"/g, '\\"');
  return `// Dev.to syndication config. Consumed by the export-devto command.
// Plain object on purpose: no TS annotations, no imports, so the content-dir
// ESLint parser is happy and the exporter can load it from outside the
// platform's tsconfig scope. The platform-side type definition at
// apps/platform/src/features/blog/devto-config.ts documents the shape.

export const devtoConfig = {
  title: "${safeTitle}",
  description: "One-sentence description for dev.to's article card and meta description.",
  // Lowercase alphanumeric, max 4. Dev.to convention.
  tags: ["airjam"],
  // Path under /blog-assets/<slug>/ or an absolute https URL. Dev.to displays this at ~1000x420.
  // coverImage: "/blog-assets/<slug>/cover.png",
  published: false,
};
`;
}

export async function scaffoldBlogPost({ slug, title, author, withDevto }) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}". Use lowercase letters, digits, and dashes (e.g. "my-new-post").`,
    );
  }

  const slugDir = path.join(repoRoot, "content", "blog", slug);
  if (await pathExists(slugDir)) {
    throw new Error(`Article already exists at ${path.relative(repoRoot, slugDir)}`);
  }

  const publicAssetsDir = path.join(
    repoRoot,
    "apps",
    "platform",
    "public",
    "blog-assets",
    slug,
  );

  const exportName = slugToExportName(slug);

  await fs.mkdir(slugDir, { recursive: true });
  await fs.mkdir(publicAssetsDir, { recursive: true });

  await fs.writeFile(
    path.join(slugDir, "post.mdx"),
    renderPostMdx().replaceAll("<slug>", slug),
    "utf8",
  );
  await fs.writeFile(
    path.join(slugDir, "post.meta.ts"),
    renderPostMeta({ exportName, title, author }),
    "utf8",
  );

  if (withDevto) {
    await fs.writeFile(
      path.join(slugDir, "devto.config.ts"),
      renderDevtoConfig({ title }),
      "utf8",
    );
  }

  // .gitkeep so the empty assets directory is preserved when other agents clone.
  await fs.writeFile(
    path.join(publicAssetsDir, ".gitkeep"),
    "",
    "utf8",
  );

  return {
    slug,
    postDir: slugDir,
    publicAssetsDir,
    withDevto: Boolean(withDevto),
  };
}

/**
 * Validation checks for blog content. Wired into `pnpm run repo -- content blog check`.
 *
 * - assertBlogAssetsExist: every `/blog-assets/...` referenced from a post.mdx
 *   must exist on disk under `apps/platform/public/blog-assets/`.
 * - assertDevtoExportsRun: every article with a devto.config.ts must produce
 *   a non-trivial dev-to.md when run through the exporter.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const contentBlogRoot = path.join(repoRoot, "content", "blog");
const publicAssetsRoot = path.join(
  repoRoot,
  "apps",
  "platform",
  "public",
  "blog-assets",
);

const ASSET_REFERENCE_PATTERN = /\/blog-assets\/([A-Za-z0-9._\-/]+)/g;

async function listSlugs() {
  const entries = await fs.readdir(contentBlogRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function readMaybe(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function assertBlogAssetsExist() {
  const slugs = await listSlugs();
  const problems = [];

  for (const slug of slugs) {
    const postPath = path.join(contentBlogRoot, slug, "post.mdx");
    const body = await readMaybe(postPath);
    if (body === null) continue;

    const references = new Set();
    for (const match of body.matchAll(ASSET_REFERENCE_PATTERN)) {
      references.add(match[1]);
    }

    for (const reference of references) {
      const assetPath = path.join(publicAssetsRoot, reference);
      if (!(await fileExists(assetPath))) {
        problems.push(
          `[${slug}] post.mdx references /blog-assets/${reference} but ${path.relative(repoRoot, assetPath)} does not exist`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Blog asset references are broken:\n  - ${problems.join("\n  - ")}`,
    );
  }

  console.log("✓ Blog post asset references resolve to existing files");
}

function runDevtoExportFor(slug) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "tsx",
        path.join(repoRoot, "scripts", "content", "devto-export.ts"),
        slug,
      ],
      { stdio: ["ignore", "pipe", "pipe"], cwd: repoRoot },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `devto-export ${slug} exited with code ${code}\n${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

const MIN_DEVTO_BYTES = 500;

export async function assertDevtoExportsRun() {
  const slugs = await listSlugs();
  const articlesWithConfig = [];
  for (const slug of slugs) {
    const configPath = path.join(contentBlogRoot, slug, "devto.config.ts");
    if (await fileExists(configPath)) {
      articlesWithConfig.push(slug);
    }
  }

  if (articlesWithConfig.length === 0) {
    console.log("✓ No articles configured for dev.to cross-posting (skipping)");
    return;
  }

  const failures = [];
  for (const slug of articlesWithConfig) {
    try {
      await runDevtoExportFor(slug);
      const outputPath = path.join(contentBlogRoot, slug, "dev-to.md");
      const stats = await fs.stat(outputPath);
      if (stats.size < MIN_DEVTO_BYTES) {
        failures.push(
          `[${slug}] dev-to.md is suspiciously small (${stats.size} bytes; expected >= ${MIN_DEVTO_BYTES})`,
        );
      }
    } catch (error) {
      failures.push(`[${slug}] ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Dev.to export check failed:\n  - ${failures.join("\n  - ")}`);
  }

  console.log(
    `✓ Dev.to export runs cleanly for ${articlesWithConfig.length} article${articlesWithConfig.length === 1 ? "" : "s"}`,
  );
}

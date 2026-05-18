/**
 * Generate `content/blog/<slug>/dev-to.md` from the canonical
 * `content/blog/<slug>/post.mdx` + `content/blog/<slug>/devto.config.ts`.
 *
 * The generated file is a build artifact (gitignored). Edit post.mdx, then
 * regenerate. Cross-posts paste straight from the generated file.
 *
 * Usage:
 *   pnpm run repo -- content blog export-devto <slug>
 *   pnpm exec tsx ./scripts/content/devto-export.ts <slug>
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_SITE_URL = "https://airjam.io";
const ASSET_PATH_PREFIX = "/blog-assets/";
const DEVTO_TAG_PATTERN = /^[a-z0-9]+$/;

interface DevtoConfig {
  title: string;
  description: string;
  tags: string[];
  coverImage?: string;
  published?: boolean;
}

interface ExportResult {
  slug: string;
  outputPath: string;
  bytesWritten: number;
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: devto-export <slug>");
    process.exit(1);
  }

  try {
    const result = await exportArticle(slug);
    console.log(
      `✓ Wrote ${path.relative(repoRoot, result.outputPath)} (${result.bytesWritten} bytes)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Export failed: ${message}`);
    process.exit(1);
  }
}

export async function exportArticle(slug: string): Promise<ExportResult> {
  const slugDir = path.join(repoRoot, "content", "blog", slug);
  const postMdxPath = path.join(slugDir, "post.mdx");
  const devtoConfigPath = path.join(slugDir, "devto.config.ts");
  const outputPath = path.join(slugDir, "dev-to.md");

  await assertExists(postMdxPath, `post.mdx not found at ${postMdxPath}`);
  await assertExists(
    devtoConfigPath,
    `devto.config.ts not found at ${devtoConfigPath}. This article is not configured for dev.to cross-posting.`,
  );

  const rawConfig = await loadDevtoConfig(devtoConfigPath);
  const config = validateDevtoConfig(rawConfig, devtoConfigPath);

  const mdxBody = await fs.readFile(postMdxPath, "utf8");
  const portableBody = stripMdxHeader(mdxBody);
  const siteUrl = (process.env.PLATFORM_PUBLIC_URL ?? DEFAULT_SITE_URL).replace(
    /\/$/,
    "",
  );
  const rewrittenBody = rewriteAssetUrls(portableBody, siteUrl);
  const frontmatter = renderDevtoFrontmatter({
    config,
    canonicalUrl: `${siteUrl}/blog/${slug}`,
    siteUrl,
  });

  const finalContent = `${frontmatter}\n\n${rewrittenBody.trimStart()}`;
  await fs.writeFile(outputPath, finalContent, "utf8");

  return {
    slug,
    outputPath,
    bytesWritten: Buffer.byteLength(finalContent, "utf8"),
  };
}

async function assertExists(filePath: string, message: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}

async function loadDevtoConfig(filePath: string): Promise<unknown> {
  const moduleUrl = pathToFileURL(filePath).href;
  const imported = (await import(moduleUrl)) as {
    devtoConfig?: unknown;
    default?: unknown;
  };
  const config = imported.devtoConfig ?? imported.default;
  if (!config) {
    throw new Error(
      `devto.config.ts at ${filePath} must export a 'devtoConfig' (or default) value.`,
    );
  }
  return config;
}

function validateDevtoConfig(value: unknown, filePath: string): DevtoConfig {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid devto config at ${filePath}: expected an object.`);
  }
  const candidate = value as Record<string, unknown>;
  const title = requireString(candidate.title, "title", filePath);
  const description = requireString(
    candidate.description,
    "description",
    filePath,
  );
  const tagsValue = candidate.tags;
  if (
    !Array.isArray(tagsValue) ||
    tagsValue.length === 0 ||
    tagsValue.length > 4
  ) {
    throw new Error(
      `Invalid devto config at ${filePath}: 'tags' must be an array of 1-4 strings.`,
    );
  }
  const tags = tagsValue.map((tag, index) => {
    if (typeof tag !== "string" || !DEVTO_TAG_PATTERN.test(tag)) {
      throw new Error(
        `Invalid devto config at ${filePath}: tags[${index}] must be lowercase alphanumeric.`,
      );
    }
    return tag;
  });

  const coverImage =
    typeof candidate.coverImage === "string" ? candidate.coverImage : undefined;
  const published =
    typeof candidate.published === "boolean" ? candidate.published : false;

  return { title, description, tags, coverImage, published };
}

function requireString(
  value: unknown,
  field: string,
  filePath: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Invalid devto config at ${filePath}: '${field}' must be a non-empty string.`,
    );
  }
  return value;
}

/**
 * Drop the canonical MDX header (the `import { metadata }` + `export { metadata }`
 * pair and any blank lines immediately after) so what remains is portable
 * markdown that any other renderer can consume.
 */
function stripMdxHeader(source: string): string {
  const lines = source.split("\n");
  let firstContentIndex = 0;
  let sawHeader = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "") {
      if (sawHeader) {
        firstContentIndex = index + 1;
        continue;
      }
      firstContentIndex = index + 1;
      continue;
    }
    if (line.startsWith("import ") || line.startsWith("export ")) {
      sawHeader = true;
      firstContentIndex = index + 1;
      continue;
    }
    break;
  }

  return lines.slice(firstContentIndex).join("\n");
}

/**
 * Rewrite root-relative `/blog-assets/...` paths to absolute URLs anchored at
 * the public site. Dev.to needs absolute URLs to fetch external images.
 */
function rewriteAssetUrls(body: string, siteUrl: string): string {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(ASSET_PATH_PREFIX)}`, "g");
  return body.replace(pattern, `${siteUrl}${ASSET_PATH_PREFIX}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface RenderFrontmatterArgs {
  config: DevtoConfig;
  canonicalUrl: string;
  siteUrl: string;
}

function renderDevtoFrontmatter({
  config,
  canonicalUrl,
  siteUrl,
}: RenderFrontmatterArgs): string {
  const lines: string[] = ["---"];
  lines.push(`title: ${escapeYamlScalar(config.title)}`);
  lines.push(`published: ${config.published === true ? "true" : "false"}`);
  lines.push(`description: ${quoteYaml(config.description)}`);
  lines.push(`canonical_url: ${canonicalUrl}`);
  lines.push(`tags: ${config.tags.join(", ")}`);
  if (config.coverImage) {
    const coverUrl = config.coverImage.startsWith("http")
      ? config.coverImage
      : `${siteUrl}${config.coverImage.startsWith("/") ? "" : "/"}${config.coverImage}`;
    lines.push(`cover_image: ${coverUrl}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function escapeYamlScalar(value: string): string {
  if (/[:#"'\\]|^\s|\s$/.test(value)) {
    return quoteYaml(value);
  }
  return value;
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

void main();

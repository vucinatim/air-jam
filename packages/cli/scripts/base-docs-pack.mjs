import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const cliRoot = path.resolve(__dirname, "..");
export const repoRoot = path.resolve(cliRoot, "..", "..");
export const canonicalDocsRoot = path.join(repoRoot, "content", "docs");
export const outputDocsRoot = path.join(
  cliRoot,
  "template-assets",
  "managed",
  "docs",
  "airjam",
  "generated",
);

const catalog = JSON.parse(
  await fs.readFile(path.join(canonicalDocsRoot, "catalog.json"), "utf8"),
);
export const exportedDocs = catalog.map(({ source, output, page }) => ({
  slug: page.href.replace(/^\/docs\//, ""),
  source,
  output,
  title: page.title,
}));

const localDocPathBySlug = new Map(
  exportedDocs.map((entry) => [entry.slug, entry.output]),
);

const hostedDocUrl = (slug) => `https://airjam.io/docs/${slug}`;

const transformMdxToLocalMarkdown = (value) => {
  const lines = value.split(/\r?\n/);
  const output = [];
  let inCodeFence = false;
  let strippedElementDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    if (
      trimmed.startsWith("import ") ||
      trimmed === "export { metadata };" ||
      trimmed === "export { metadata };"
    ) {
      continue;
    }

    if (/^<\/[^>]+>$/.test(trimmed)) {
      strippedElementDepth = Math.max(0, strippedElementDepth - 1);
      continue;
    }

    if (/^<[^>]+>$/.test(trimmed)) {
      if (!trimmed.endsWith("/>")) {
        strippedElementDepth += 1;
      }
      continue;
    }

    output.push(
      strippedElementDepth > 0 && line.startsWith("  ") ? line.slice(2) : line,
    );
  }

  return output.join("\n");
};

const toLocalLink = (fromOutputFile, targetOutputFile) => {
  const relativePath = path.relative(
    path.dirname(fromOutputFile),
    targetOutputFile,
  );
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};

const rewriteDocLinks = (value, currentOutputFile) =>
  value
    .replace(/\]\((\/docs\/([^)]+))\)/g, (_match, _href, slug) => {
      const localOutputFile = localDocPathBySlug.get(slug);
      return localOutputFile
        ? `](${toLocalLink(currentOutputFile, localOutputFile)})`
        : `](${hostedDocUrl(slug)})`;
    })
    .replace(
      /\]\((\/(llms\.txt|sitemap\.xml|robots\.txt))\)/g,
      (_match, href) => {
        return `](https://airjam.io${href})`;
      },
    );

const stripExcessBlankLines = (value) =>
  value
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");

const removeEmptyHeadings = (value) => {
  const lines = value.split(/\r?\n/);
  const kept = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!/^#{1,6}\s+/.test(trimmed)) {
      kept.push(line);
      continue;
    }

    let probe = index + 1;
    while (probe < lines.length && lines[probe].trim() === "") {
      probe += 1;
    }

    const nextNonBlank = probe < lines.length ? lines[probe].trim() : "";
    if (!nextNonBlank || /^#{1,6}\s+/.test(nextNonBlank)) {
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
};

const renderExportedDoc = (entry, body) =>
  [
    `<!-- Generated from content/docs/${entry.source}. Do not edit directly. -->`,
    `<!-- Canonical public doc: ${hostedDocUrl(entry.slug)} -->`,
    "",
    body,
  ].join("\n");

export const generateBaseDocsPack = async (targetRoot = outputDocsRoot) => {
  await fs.mkdir(targetRoot, { recursive: true });

  for (const entry of exportedDocs) {
    const sourcePath = path.join(canonicalDocsRoot, entry.source);
    const targetPath = path.join(targetRoot, entry.output);
    const source = await fs.readFile(sourcePath, "utf8");
    const transformed = stripExcessBlankLines(
      rewriteDocLinks(
        removeEmptyHeadings(transformMdxToLocalMarkdown(source)),
        entry.output,
      ),
    );
    await fs.writeFile(
      targetPath,
      renderExportedDoc(entry, transformed),
      "utf8",
    );
  }
};

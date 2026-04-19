import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createAirjamRoot = path.resolve(__dirname, "..");
export const repoRoot = path.resolve(createAirjamRoot, "..", "..");
export const canonicalDocsRoot = path.join(repoRoot, "content", "docs");
export const outputDocsRoot = path.join(
  createAirjamRoot,
  "template-assets",
  "base",
  "docs",
  "generated",
);

export const exportedDocs = [
  {
    slug: "for-agents",
    source: "for-agents/page.mdx",
    output: "for-agents.md",
    title: "For Agents",
  },
  {
    slug: "for-agents/project-structure",
    source: "for-agents/project-structure/page.mdx",
    output: "project-structure.md",
    title: "Project Structure",
  },
  {
    slug: "for-agents/controller-ui",
    source: "for-agents/controller-ui/page.mdx",
    output: "controller-ui.md",
    title: "Controller UI",
  },
  {
    slug: "for-agents/state-and-rendering",
    source: "for-agents/state-and-rendering/page.mdx",
    output: "state-and-rendering.md",
    title: "State and Rendering",
  },
  {
    slug: "getting-started/introduction",
    source: "getting-started/introduction/page.mdx",
    output: "introduction.md",
    title: "Introduction",
  },
  {
    slug: "getting-started/quick-start",
    source: "getting-started/quick-start/page.mdx",
    output: "quick-start.md",
    title: "Quick Start",
  },
  {
    slug: "getting-started/debugging",
    source: "getting-started/debugging/page.mdx",
    output: "debugging-and-logs.md",
    title: "Debugging and Logs",
  },
  {
    slug: "getting-started/dev-logs",
    source: "getting-started/dev-logs/page.mdx",
    output: "unified-dev-logs.md",
    title: "Unified Dev Logs",
  },
  {
    slug: "how-it-works/architecture",
    source: "how-it-works/architecture/page.mdx",
    output: "architecture.md",
    title: "Architecture",
  },
  {
    slug: "how-it-works/host-system",
    source: "how-it-works/host-system/page.mdx",
    output: "host-system.md",
    title: "Host System",
  },
  {
    slug: "sdk/hooks",
    source: "sdk/hooks/page.mdx",
    output: "sdk-hooks.md",
    title: "SDK Hooks",
  },
  {
    slug: "sdk/input-system",
    source: "sdk/input-system/page.mdx",
    output: "input-system.md",
    title: "Input System",
  },
  {
    slug: "sdk/networked-state",
    source: "sdk/networked-state/page.mdx",
    output: "networked-state.md",
    title: "Networked State",
  },
];

const localDocPathBySlug = new Map(
  exportedDocs.map((entry) => [entry.slug, entry.output]),
);

const hostedDocUrl = (slug) => `https://air-jam.app/docs/${slug}`;

const transformMdxToLocalMarkdown = (value) => {
  const lines = value.split(/\r?\n/);
  const output = [];
  let inCodeFence = false;

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

    if (/^<[^>]+>$/.test(trimmed) || /^<\/[^>]+>$/.test(trimmed)) {
      continue;
    }

    output.push(line);
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
        return `](https://air-jam.app${href})`;
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

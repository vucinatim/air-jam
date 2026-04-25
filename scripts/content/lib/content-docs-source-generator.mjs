import GithubSlugger from "github-slugger";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "..", "..", "..");
export const contentDocsRoot = path.join(repoRoot, "content", "docs");
export const outputFile = path.join(
  repoRoot,
  "apps",
  "platform",
  "src",
  "features",
  "docs",
  "generated",
  "content-docs.generated.ts",
);

const sectionOrder = new Map([
  ["getting-started", 0],
  ["how-it-works", 1],
  ["sdk", 2],
  ["for-agents", 3],
]);

export async function generateContentDocsSource() {
  const docsEntries = await collectDocsEntries(contentDocsRoot);
  const source = renderGeneratedSource(docsEntries);
  const prettierOptions = await prettier.resolveConfig(outputFile);

  return prettier.format(source, {
    ...prettierOptions,
    filepath: outputFile,
  });
}

export async function writeGeneratedContentDocsSource() {
  const source = await generateContentDocsSource();

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, source, "utf8");
}

export async function assertGeneratedContentDocsSourceIsFresh() {
  const expectedSource = await generateContentDocsSource();
  const currentSource = await fs.readFile(outputFile, "utf8");

  if (currentSource !== expectedSource) {
    throw new Error(
      `Generated docs source is stale at ${path.relative(
        repoRoot,
        outputFile,
      )}. Run "pnpm run repo -- content docs generate" and commit the result.`,
    );
  }
}

async function collectDocsEntries(rootDir) {
  const docsFiles = await findDocsFiles(rootDir);
  const entries = [];

  for (const docsFile of docsFiles) {
    const relativeDocsFile = path.relative(rootDir, docsFile);
    const relativeDir = path
      .dirname(relativeDocsFile)
      .replaceAll(path.sep, "/");
    const sourcePath = `content/docs/${relativeDir}/page.mdx`;
    const docsModulePath = `@content/docs/${relativeDir}/page.docs`;
    const mdxModulePath = `@content/docs/${relativeDir}/page.mdx`;
    const docsFileContents = await fs.readFile(docsFile, "utf8");
    const mdxFile = path.join(path.dirname(docsFile), "page.mdx");
    const mdxFileContents = await fs.readFile(mdxFile, "utf8");
    const pageExportName = extractPageExportName(docsFileContents, docsFile);
    const metadataExportName = `${pageExportName.replace(/DocsPage$/, "")}Metadata`;
    const pageOrder = extractPageOrder(docsFileContents, docsFile);
    const headings = extractHeadings(mdxFileContents);

    entries.push({
      docsModulePath,
      mdxModulePath,
      sourcePath,
      pageExportName,
      metadataExportName,
      headings,
      sortKey: buildSortKey(relativeDir, pageOrder),
    });
  }

  return entries.sort((left, right) =>
    left.sortKey.localeCompare(right.sortKey),
  );
}

async function findDocsFiles(dir) {
  const dirEntries = await fs.readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    dirEntries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findDocsFiles(entryPath);
      }

      if (entry.isFile() && entry.name === "page.docs.ts") {
        return [entryPath];
      }

      return [];
    }),
  );

  return nestedFiles.flat();
}

function extractPageExportName(fileContents, filename) {
  const match = fileContents.match(/export const (\w+DocsPage)\s*=/);

  if (!match) {
    throw new Error(
      `Could not find exported '*DocsPage' constant in ${filename}.`,
    );
  }

  return match[1];
}

function buildSortKey(relativeDir, pageOrder) {
  const section = relativeDir.split("/")[0];
  const rank = sectionOrder.get(section) ?? 99;
  return `${String(rank).padStart(2, "0")}:${String(pageOrder).padStart(
    2,
    "0",
  )}:${relativeDir}`;
}

function extractPageOrder(fileContents, filename) {
  const match = fileContents.match(/order:\s*(\d+)/);

  if (!match) {
    throw new Error(`Could not find numeric 'order' in ${filename}.`);
  }

  return Number(match[1]);
}

function extractHeadings(fileContents) {
  const slugger = new GithubSlugger();
  const lines = fileContents.split(/\r?\n/);
  let inCodeFence = false;
  const headings = [];

  for (const [index, line] of lines.entries()) {
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);

    if (!match) {
      continue;
    }

    const title = normalizeHeadingText(match[2]);

    if (!title) {
      continue;
    }

    headings.push({
      title,
      depth: match[1].length,
      slug: slugger.slug(title),
      lineIndex: index,
    });
  }

  return headings.map((heading, index) => ({
    title: heading.title,
    depth: heading.depth,
    slug: heading.slug,
    excerpt: extractHeadingExcerpt(
      lines.slice(
        heading.lineIndex + 1,
        findSectionEndIndex(headings, index, lines.length),
      ),
    ),
  }));
}

function normalizeHeadingText(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .trim();
}

function findSectionEndIndex(headings, headingIndex, totalLines) {
  const currentHeading = headings[headingIndex];

  for (let index = headingIndex + 1; index < headings.length; index += 1) {
    if (headings[index].depth <= currentHeading.depth) {
      return headings[index].lineIndex;
    }
  }

  return totalLines;
}

function extractHeadingExcerpt(lines) {
  const excerptSegments = [];
  const codeSegments = [];
  let inCodeFence = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!trimmedLine) {
      continue;
    }

    if (inCodeFence) {
      const normalizedCodeLine = normalizeCodeExcerptLine(trimmedLine);

      if (normalizedCodeLine) {
        codeSegments.push(normalizedCodeLine);
      }

      continue;
    }

    const normalizedLine = normalizeExcerptLine(trimmedLine);

    if (!normalizedLine) {
      continue;
    }

    excerptSegments.push(normalizedLine);

    if (excerptSegments.join(" ").length >= 240) {
      break;
    }
  }

  return (
    truncateExcerpt(excerptSegments.join(" ")) ||
    truncateExcerpt(codeSegments.join(" ")) ||
    undefined
  );
}

function normalizeExcerptLine(line) {
  if (
    line.startsWith("import ") ||
    line.startsWith("export ") ||
    /^[-*_]{3,}$/.test(line) ||
    /^<!--.*-->$/.test(line) ||
    /^<\/?[A-Z][^>]*\/?>$/.test(line) ||
    /^<\/?[a-z][^>]*>$/.test(line)
  ) {
    return "";
  }

  if (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line)) {
    return "";
  }

  const normalizedTableLine = line.startsWith("|")
    ? line
        .split("|")
        .map((cell) => normalizeInlineText(cell))
        .filter(Boolean)
        .join(" ")
    : normalizeInlineText(line);

  return normalizedTableLine
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

function normalizeInlineText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCodeExcerptLine(value) {
  const normalizedLine = value
    .replace(/\/\/.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedLine || /^[{}[\]();,]+$/.test(normalizedLine)) {
    return "";
  }

  return normalizedLine;
}

function truncateExcerpt(value, maxLength = 220) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  if (lastSpaceIndex <= maxLength * 0.6) {
    return `${truncated.trim()}…`;
  }

  return `${truncated.slice(0, lastSpaceIndex).trim()}…`;
}

function renderGeneratedSource(entries) {
  const importBlocks = entries
    .map(
      (entry) =>
        `import {\n  ${entry.pageExportName},\n  metadata as ${entry.metadataExportName},\n} from "${entry.docsModulePath}";`,
    )
    .join("\n");

  const documents = entries
    .map(
      (entry) => `  {
    page: ${entry.pageExportName},
    metadata: ${entry.metadataExportName},
    sourcePath: ${JSON.stringify(entry.sourcePath)},
    headings: [
${entry.headings
  .map(
    (heading) => `      {
        title: ${JSON.stringify(heading.title)},
        slug: ${JSON.stringify(heading.slug)},
        depth: ${heading.depth},
        excerpt: ${JSON.stringify(heading.excerpt)},
      },`,
  )
  .join("\n")}
    ],
    loadComponent: () => import("${entry.mdxModulePath}"),
  },`,
    )
    .join("\n");

  return `// This file is generated by scripts/repo/cli.mjs content docs generate.
// Do not edit it manually.

${importBlocks}

import type { DocsSource } from "../source";

const generatedContentDocsDocuments = [
${documents}
];

export const generatedContentDocsSource: DocsSource = {
  name: "content-docs",
  loadDocuments() {
    return generatedContentDocsDocuments;
  },
};
`;
}

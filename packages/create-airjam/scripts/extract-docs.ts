import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts MDX content to Markdown by removing React imports and JSX components
 */
function convertMdxToMarkdown(content: string): string {
  let markdown = content;

  // Remove import statements (but keep them if they're inside code blocks)
  // We'll process line by line, tracking if we're inside a code block
  const lines = markdown.split("\n");
  const processedLines: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code block state
    const codeBlockMatch = line.match(/^```/);
    if (codeBlockMatch) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }

    // If we're inside a code block, keep everything as-is
    if (inCodeBlock) {
      processedLines.push(line);
      continue;
    }

    // Remove import statements (outside code blocks)
    if (/^import\s+.*from\s+["'].*["'];?\s*$/.test(line.trim())) {
      continue; // Skip this line
    }

    // Remove JSX self-closing component tags (outside code blocks)
    // Match patterns like <ComponentName /> or <ComponentName/>
    if (/^<[A-Z]\w+\s*\/>$/.test(line.trim())) {
      continue; // Skip this line
    }

    // Remove JSX opening/closing tags for multi-line components
    // This is a simple heuristic - might need refinement
    // For now, we'll just remove lines that are standalone JSX tags
    if (/^<\/?[A-Z]\w+(\s+[^>]*)?>$/.test(line.trim())) {
      continue; // Skip this line
    }

    // Keep everything else
    processedLines.push(line);
  }

  markdown = processedLines.join("\n");

  // Clean up excessive blank lines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Trim the result
  return markdown.trim();
}

/**
 * Recursively finds all .mdx files in a directory
 */
async function findMdxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findMdxFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main extraction function
 */
async function extractDocs() {
  const repoRoot = path.resolve(__dirname, "../../..");
  const docsSourceDir = path.join(repoRoot, "apps/platform/src/app/docs");
  const docsTargetDir = path.join(__dirname, "../templates/pong/airjam-docs");

  console.log(`Extracting docs from: ${docsSourceDir}`);
  console.log(`Target directory: ${docsTargetDir}`);

  // Find all MDX files
  const mdxFiles = await findMdxFiles(docsSourceDir);

  if (mdxFiles.length === 0) {
    console.warn("No MDX files found in source directory");
    return;
  }

  console.log(`Found ${mdxFiles.length} MDX file(s)`);

  // Ensure target directory exists
  await fs.ensureDir(docsTargetDir);

  // Process each MDX file
  for (const mdxFile of mdxFiles) {
    // Calculate relative path from docs source directory
    const relativePath = path.relative(docsSourceDir, mdxFile);

    // Change extension from .mdx to .md and update directory structure
    const targetPath = path.join(
      docsTargetDir,
      relativePath.replace(/\.mdx$/, ".md"),
    );

    // Ensure target directory exists
    await fs.ensureDir(path.dirname(targetPath));

    // Read MDX content
    const mdxContent = await fs.readFile(mdxFile, "utf-8");

    // Convert to markdown
    const markdownContent = convertMdxToMarkdown(mdxContent);

    // Write markdown file
    await fs.writeFile(targetPath, markdownContent, "utf-8");

    console.log(
      `  ✓ ${relativePath} → ${path.relative(docsTargetDir, targetPath)}`,
    );
  }

  console.log(
    `\n✓ Successfully extracted ${mdxFiles.length} documentation file(s)`,
  );
}

// Run the extraction
extractDocs().catch((err) => {
  console.error("Error extracting docs:", err);
  process.exit(1);
});

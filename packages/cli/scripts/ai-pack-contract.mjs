import path from "node:path";
import { cliRoot, exportedDocs, outputDocsRoot } from "./base-docs-pack.mjs";

export const basePackRoot = path.join(cliRoot, "template-assets", "managed");
export const bootstrapPackRoot = path.join(
  cliRoot,
  "template-assets",
  "bootstrap",
);

export const requiredBasePackPaths = [
  ".airjam/ai-pack.json",
  "docs/airjam/debug-and-testing.md",
  "docs/airjam/development-loop.md",
  "docs/airjam/agent-gold-path.md",
  "docs/airjam/agent-mcp.md",
  "docs/airjam/docs-index.md",
  "docs/airjam/iconography.md",
];

export const requiredBootstrapPackPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "_gitignore",
  ".claude/launch.json",
  "skills/airjam-mcp/SKILL.md",
  "skills/index.md",
];

export const requiredGeneratedDocPaths = exportedDocs.map((entry) =>
  path.join("docs", "airjam", "generated", entry.output).replace(/\\/g, "/"),
);

export const requiredScaffoldPaths = [
  ...requiredBasePackPaths,
  ...requiredBootstrapPackPaths.filter(
    (relativePath) => relativePath !== "_gitignore",
  ),
  ".gitignore",
  ...requiredGeneratedDocPaths,
];

export { exportedDocs, outputDocsRoot };

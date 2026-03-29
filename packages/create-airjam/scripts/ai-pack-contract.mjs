import path from "node:path";
import { createAirjamRoot, exportedDocs, outputDocsRoot } from "./base-docs-pack.mjs";

export const basePackRoot = path.join(createAirjamRoot, "template-assets", "base");

export const requiredBasePackPaths = [
  "AGENTS.md",
  "plan.md",
  "suggestions.md",
  ".airjam/ai-pack.json",
  "docs/debug-and-testing.md",
  "docs/development-loop.md",
  "docs/docs-index.md",
  "docs/iconography.md",
  "skills/index.md",
  "skills/plan-ledger/SKILL.md",
  "skills/airjam-docs-workflow/SKILL.md",
  "skills/game-architecture/SKILL.md",
  "skills/game-state-and-rendering/SKILL.md",
  "skills/controller-ui/SKILL.md",
  "skills/debug-and-test/SKILL.md",
];

export const requiredGeneratedDocPaths = exportedDocs.map((entry) =>
  path.join("docs", "generated", entry.output).replace(/\\/g, "/"),
);

export const requiredScaffoldPaths = [
  ...requiredBasePackPaths,
  ...requiredGeneratedDocPaths,
];

export { exportedDocs, outputDocsRoot };

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";

// Real processes, sockets, built-package consumers and durable filesystem fixtures.
const slowTests = {
  repo: [
    "ai-pack-manifest-generation",
    "docker-workspace-manifest-contract",
    "fast-check-cli-contract",
    "golden-path-bootstrap-hardening",
    "package-proof",
    "public-install-matrix-contract",
    "public-package-boundaries",
    "public-release-candidate-contract",
    "sdk-watch",
    "semantic-agent-contracts",
    "workspace-bin-contract",
    "workspace-dev-readiness",
  ],
  cli: ["ai-pack-api", "cli", "documentation", "secure-dev"],
  "create-airjam": ["scaffold-resource-budgets", "scaffold-template-archive"],
  devtools: [
    "built-game-runtime",
    "controller-isolated-handoff",
    "current-room-host",
    "dependencies",
    "devtools",
    "game-build-source-evidence",
    "game-build",
    "game-declaration",
    "game-run-owner",
    "game-run-record",
    "game-session-broker-authority",
    "game-session-broker",
    "game-session-owner-lifecycle",
    "headless-run",
    "managed-process-preparation",
    "managed-process-scope",
    "platform-auth",
    "platform-game-media",
    "platform-games",
    "player-contract",
    "policy-artifacts",
    "process-scope",
    "release",
    "seal-game-build",
    "source-tree",
    "test-profile-process",
    "visual-runtime",
    "windows-process-scopes",
    "harness/prefab-runner",
    "harness/visual-runner",
  ],
  "mcp-server": ["mcp-server"],
  server: [
    "load-workspace-env.unit",
    "log-paths.unit",
    "server-cli.unit",
    "server-logging.unit",
  ],
  sdk: ["export-surface.behavior"],
};

const testFiles = (directory, recursive) =>
  readdirSync(path.join(repoRoot, directory), { recursive })
    .filter((file) => /\.test\.(?:mjs|ts|tsx)$/.test(file))
    .map((file) => file.split(path.sep).join("/"))
    .sort();

export const testProjects = () => [
  { id: "repo", directory: ".", tests: "scripts/repo/runtime", runner: "node" },
  ...[
    "env",
    "devtools",
    "mcp-server",
    "cli",
    "server",
    "sdk",
    "create-airjam",
  ].map((id) => ({
    id,
    directory: `packages/${id}`,
    tests:
      id === "env"
        ? "."
        : ["cli", "create-airjam"].includes(id)
          ? "runtime"
          : "tests",
    runner: ["env", "cli", "create-airjam"].includes(id) ? "node" : "vitest",
  })),
  ...readdirSync(path.join(repoRoot, "games")).flatMap((id) => {
    const directory = `games/${id}`;
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, directory, "package.json"), "utf8"),
    );
    return manifest.scripts?.test
      ? [{ id, directory, tests: "tests", runner: "vitest" }]
      : [];
  }),
];

export const buildTestPlan = ({ tier = "fast", projects = [] } = {}) => {
  if (!["fast", "slow"].includes(tier))
    throw new Error(`Unknown test tier: ${tier}`);
  const available = testProjects();
  for (const project of projects) {
    if (!available.some(({ id }) => id === project))
      throw new Error(`Unknown test project: ${project}`);
  }
  return available
    .filter(({ id }) => projects.length === 0 || projects.includes(id))
    .map((project) => ({
      ...project,
      files: testFiles(
        `${project.directory}/${project.tests}`,
        project.id !== "env",
      )
        .filter((file) => {
          const slow =
            file.includes(".slow.test.") ||
            (project.id === "server" && file.includes(".integration.test.")) ||
            (slowTests[project.id] ?? []).some(
              (name) => file.replace(/\.test\.(?:mjs|ts|tsx)$/, "") === name,
            );
          return slow === (tier === "slow");
        })
        .map((file) => `${project.tests}/${file}`),
    }))
    .filter(({ files }) => files.length > 0);
};

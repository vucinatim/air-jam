import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";

const canonicalRules = [
  {
    pattern:
      "import\\s*{[^}]*\\bAirJamProvider\\b[^}]*}\\s*from\\s*[\"\\']@air-jam/sdk[\"\\']",
    label: "unscoped AirJamProvider imports in runtime code",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern: "\\bstate\\.actions\\.",
    label: "non-canonical state.actions dispatch usage",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern: "\\bonChildClose\\s*:",
    label: "deprecated onChildClose host option usage",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern: "\\bisChildMode\\b",
    label: "deprecated isChildMode usage",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern: "\\bforceConnect\\s*:",
    label: "deprecated forceConnect option usage",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern:
      "<HostSessionProvider[^>]*(serverUrl|appId|maxPlayers|publicHost|input)\\s*=",
    label:
      "inline HostSessionProvider runtime config props (use canonical session-config module)",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern:
      "<ControllerSessionProvider[^>]*(serverUrl|appId|maxPlayers|publicHost|input)\\s*=",
    label:
      "inline ControllerSessionProvider runtime config props (use canonical session-config module)",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
    ],
  },
  {
    pattern: "postMessage\\([^,]+,\\s*[\"\\']\\*[\"\\']",
    label: "wildcard postMessage targetOrigin usage",
    paths: ["apps/platform/src/components/arcade", "packages/sdk/src"],
  },
  {
    pattern: "\\bsendInput\\s*\\(",
    label: "raw sendInput usage (use useInputWriter + useControllerTick)",
    paths: [
      "apps/platform/src/app/arcade",
      "apps/platform/src/app/controller",
      "apps/platform/src/app/play",
      "apps/platform/src/components/arcade",
      "games/air-capture/src",
      "games/pong/src",
      "apps/platform/src/app/docs",
      "apps/platform/src/components/docs",
      "games/pong",
      "packages/sdk/README.md",
      "games/pong/README.md",
    ],
  },
  {
    pattern:
      "VITE_AIR_JAM_API_KEY|NEXT_PUBLIC_AIR_JAM_API_KEY|AJ_CONFIG_LEGACY_API_KEY_ENV",
    label:
      "legacy API key env names/diagnostics must not appear in canonical code/docs after the appId rename",
    paths: [
      "packages/sdk/src",
      "apps/platform/src/app/docs",
      "apps/platform/src/components/docs",
      "games/pong",
      "packages/sdk/README.md",
      "games/pong/README.md",
      "README.md",
    ],
  },
  {
    pattern: "\\bactorRole\\b",
    label: "non-canonical action context key actorRole (use ctx.role)",
    paths: [
      "packages/sdk/src",
      "apps/platform/src/app/docs",
      "apps/platform/src/components/docs",
      "games/pong",
      "packages/sdk/README.md",
      "games/pong/README.md",
    ],
  },
  {
    pattern:
      "actions\\.[A-Za-z0-9_]+\\(\\s*\\{[^)]*\\b(vector|direction|action|ability|timestamp)\\s*:",
    label:
      "input-like payload dispatched through state actions in docs/examples",
    paths: [
      "apps/platform/src/app/docs",
      "apps/platform/src/components/docs",
      "games/pong",
      "packages/sdk/README.md",
      "games/pong/README.md",
    ],
  },
];

const resolveRuleFiles = (root, paths) => {
  for (const relativePath of paths) {
    if (!existsSync(path.join(root, relativePath))) {
      throw new Error(`Canonical guard path does not exist: ${relativePath}`);
    }
  }

  const output = execFileSync(
    "git",
    [
      "-C",
      root,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...paths,
    ],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean).sort();
};

const lineNumberAt = (source, index) =>
  source.slice(0, index).split("\n").length;

const readTextFile = (root, relativePath) => {
  const contents = readFileSync(path.join(root, relativePath));
  if (contents.subarray(0, 8_000).includes(0)) {
    return null;
  }
  return contents.toString("utf8");
};

export const findCanonicalViolations = ({
  root = repoRoot,
  rules = canonicalRules,
} = {}) =>
  rules.flatMap((rule) => {
    const pattern = new RegExp(rule.pattern, "gm");
    return resolveRuleFiles(root, rule.paths).flatMap((relativePath) => {
      const source = readTextFile(root, relativePath);
      if (source === null) {
        return [];
      }
      return [...source.matchAll(pattern)].map((match) => ({
        file: relativePath,
        label: rule.label,
        line: lineNumberAt(source, match.index ?? 0),
        excerpt: match[0].replace(/\s+/gu, " ").trim().slice(0, 160),
      }));
    });
  });

const runCanonicalGuard = () => {
  const violations = findCanonicalViolations();

  for (const violation of violations) {
    console.log(`Forbidden pattern detected: ${violation.label}`);
    console.log(`${violation.file}:${violation.line}: ${violation.excerpt}`);
    console.log("");
  }

  if (violations.length > 0) {
    throw new Error("Canonical guard failed.");
  }

  console.log("Canonical guard passed.");
};

export const registerStandardsCommands = (program) => {
  const standardsCommand = program
    .command("standards")
    .description("Repo standards and canonical contract checks");

  standardsCommand
    .command("canonical")
    .description("Verify the repo stays within the canonical Air Jam patterns")
    .action(runCanonicalGuard);

  return standardsCommand;
};

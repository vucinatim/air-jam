import { runCommandResult } from "../lib/shell.mjs";

const canonicalRules = [
  {
    pattern:
      'import\\s*{[^}]*\\bAirJamProvider\\b[^}]*}\\s*from\\s*["\\\']@air-jam/sdk["\\\']',
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
    pattern: "<HostSessionProvider[^>]*(serverUrl|appId|maxPlayers|publicHost|input)\\s*=",
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
    pattern: 'postMessage\\([^,]+,\\s*["\\\']\\*["\\\']',
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
    label: "input-like payload dispatched through state actions in docs/examples",
    paths: [
      "apps/platform/src/app/docs",
      "apps/platform/src/components/docs",
      "games/pong",
      "packages/sdk/README.md",
      "games/pong/README.md",
    ],
  },
];

const runCanonicalGuard = () => {
  const rgCheck = runCommandResult("rg", ["--version"], {
    stdio: "pipe",
  });
  if (rgCheck.status !== 0) {
    throw new Error("guard:canonical requires ripgrep (rg) to be installed.");
  }

  let failures = 0;

  for (const rule of canonicalRules) {
    const result = runCommandResult(
      "rg",
      ["-n", "-U", "--pcre2", rule.pattern, ...rule.paths],
      {
        stdio: "pipe",
      },
    );

    if (result.status !== 0 || !result.stdout?.trim()) {
      continue;
    }

    console.log(`Forbidden pattern detected: ${rule.label}`);
    process.stdout.write(result.stdout);
    console.log("");
    failures += 1;
  }

  if (failures > 0) {
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

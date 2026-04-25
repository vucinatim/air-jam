import { describeVisualHarnessActions } from "@air-jam/harness";
import { resolveVisualScenarioModulePathFromConfig } from "./airjam-machine.js";
import { loadVisualScenarioPackFromModuleOrConfig } from "./visual-pack.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const modulePath = getFlagValue("--module-path");
const configPath = getFlagValue("--config");
if (!modulePath && !configPath) {
  throw new Error("Missing required --config or --module-path.");
}

if (configPath) {
  if (!(await resolveVisualScenarioModulePathFromConfig(configPath))) {
    process.stdout.write(
      `${JSON.stringify(
        {
          hasVisualHarness: false,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(0);
  }
}

const scenarioPack = await loadVisualScenarioPackFromModuleOrConfig({
  modulePath,
  configPath,
});

process.stdout.write(
  `${JSON.stringify(
    {
      hasVisualHarness: true,
      gameId: scenarioPack.gameId,
      bridgeActions: Object.keys(scenarioPack.bridge.actions ?? {}),
      actionMetadata: describeVisualHarnessActions(
        scenarioPack.bridge.actions ?? {},
      ),
      hasBridgeActions:
        Object.keys(scenarioPack.bridge.actions ?? {}).length > 0,
      scenarios: scenarioPack.scenarios.map(
        (scenario: { id: string; description?: string }) => ({
          scenarioId: scenario.id,
          description: scenario.description ?? null,
          supportedModes: ["standalone-dev", "arcade-test"],
        }),
      ),
    },
    null,
    2,
  )}\n`,
);

import { runVisualHarness } from "@air-jam/harness";
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
const artifactRoot = getFlagValue("--artifact-root");
const hostUrl = getFlagValue("--host-url");
const appOrigin = getFlagValue("--app-origin");
const controllerBaseUrl = getFlagValue("--controller-base-url");
const publicHost = getFlagValue("--public-host");
const localBuildUrl = getFlagValue("--local-build-url");
const browserBuildUrl = getFlagValue("--browser-build-url");
const scenarioId = getFlagValue("--scenario-id");
const requestedMode = getFlagValue("--mode") ?? "standalone-dev";
const secure = process.argv.includes("--secure");

if (
  (!modulePath && !configPath) ||
  !artifactRoot ||
  !hostUrl ||
  !appOrigin ||
  !controllerBaseUrl ||
  !publicHost
) {
  throw new Error(
    "Missing required visual capture inputs. Expected module path, artifact root, and resolved topology URLs.",
  );
}

const scenarioPack = await loadVisualScenarioPackFromModuleOrConfig({
  modulePath,
  configPath,
});
const mode =
  requestedMode === "arcade-test" ? "arcade-built" : "standalone-dev";

const summary = await runVisualHarness({
  gameId: scenarioPack.gameId,
  scenarioId: scenarioId ?? null,
  mode,
  secure,
  artifactRoot,
  loadScenarioPack: async () => scenarioPack,
  startStack: async () => ({
    urls: {
      appOrigin,
      hostUrl,
      controllerBaseUrl,
      publicHost,
      localBuildUrl,
      browserBuildUrl,
    },
    shutdown: async () => {},
  }),
});

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

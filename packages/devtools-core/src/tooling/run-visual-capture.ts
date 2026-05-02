import type {
  AnyAirJamAgentContract,
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioAgent,
  VisualScenarioAgentInvocation,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import { runVisualHarness } from "@air-jam/harness/visual";
import {
  closeGameSession,
  invokeGameSessionAction,
  openGameSession,
  readGameSession,
} from "../game-session.js";
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
const gameId = getFlagValue("--game-id");
const secure = process.argv.includes("--secure");

if (
  (!modulePath && !configPath) ||
  !artifactRoot ||
  !hostUrl ||
  !appOrigin ||
  !controllerBaseUrl ||
  !publicHost ||
  !gameId
) {
  throw new Error(
    "Missing required visual capture inputs. Expected game id, module path, artifact root, and resolved topology URLs.",
  );
}

const scenarioPack = (await loadVisualScenarioPackFromModuleOrConfig({
  modulePath,
  configPath,
})) as VisualScenarioPack<
  AnyAirJamAgentContract,
  AnyVisualHarnessBridgeDefinition | null
>;
const mode =
  requestedMode === "arcade-test" ? "arcade-built" : "standalone-dev";

const asSnapshotRecord = (
  snapshot: unknown,
): Record<string, unknown> | null =>
  snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null;

const createScenarioAgentSession = async ({
  gameId,
  harnessSessionId,
  urls,
}: {
  gameId: string;
  harnessSessionId: string | null;
  urls: {
    controllerJoinUrl: string;
  };
}): Promise<VisualScenarioAgent> => {
  const opened = await openGameSession({
    cwd: process.cwd(),
    gameId,
    controllerJoinUrl: urls.controllerJoinUrl,
    ...(harnessSessionId ? { harnessSessionId } : {}),
  });

  const read = async (): Promise<Record<string, unknown>> => {
    const inspection = await readGameSession({
      gameSessionId: opened.gameSessionId,
      requestSync: true,
    });
    if (!inspection.gameSnapshot?.snapshot) {
      throw new Error(
        `Visual scenario agent session for "${gameId}" did not expose a semantic game snapshot.`,
      );
    }
    return {
      ...inspection.gameSnapshot.snapshot,
    };
  };

  return {
    listActions: async () => {
      const inspection = await readGameSession({
        gameSessionId: opened.gameSessionId,
        requestSync: true,
      });
      return inspection.actions;
    },
    read,
    waitFor: async (
      predicate: (
        snapshot: Record<string, unknown>,
      ) => boolean | Promise<boolean>,
      description = "agent snapshot",
      timeout = 30_000,
    ): Promise<Record<string, unknown>> => {
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeout) {
        const snapshot = await read();
        if (await predicate(snapshot)) {
          return snapshot;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      throw new Error(`Timed out waiting for ${description}.`);
    },
    invoke: async (
      actionId: string,
      payload?: unknown,
      options?: {
        timeoutMs?: number;
      },
    ): Promise<VisualScenarioAgentInvocation> => {
      const result = await invokeGameSessionAction({
        gameSessionId: opened.gameSessionId,
        actionId,
        payload,
        timeoutMs: options?.timeoutMs,
      });
      const invocation = result.invocation;

      return {
        actionId: result.actionId,
        lane: result.lane,
        outcome: "outcome" in invocation ? invocation.outcome : null,
        acknowledgementObservation:
          "acknowledgementObservation" in invocation
            ? invocation.acknowledgementObservation
            : null,
        snapshotBefore:
          "snapshotBefore" in invocation
            ? asSnapshotRecord(
                invocation.snapshotBefore?.snapshot ?? invocation.snapshotBefore,
              )
            : null,
        snapshotAfter:
          "snapshotAfter" in invocation
            ? asSnapshotRecord(
                invocation.snapshotAfter?.snapshot ?? invocation.snapshotAfter,
              )
            : null,
        snapshotAfterStatus:
          "snapshotAfterStatus" in invocation
            ? invocation.snapshotAfterStatus
            : null,
      };
    },
    close: async () => {
      await closeGameSession({
        gameSessionId: opened.gameSessionId,
      }).catch(() => null);
    },
  };
};

try {
  const summary = await runVisualHarness({
    gameId,
    scenarioId: scenarioId ?? null,
    mode,
    secure,
    artifactRoot,
    loadScenarioPack: async () => scenarioPack,
    createAgentSession: async ({
      gameId: activeGameId,
      harnessSessionId,
      urls,
    }) =>
      createScenarioAgentSession({
        gameId: activeGameId,
        harnessSessionId,
        urls,
      }),
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
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

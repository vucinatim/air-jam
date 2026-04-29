import {
  bundleLocalRelease,
  captureVisuals,
  getDevStatus,
  getPlatformMachineAuthStatus,
  getTopology,
  openGameSession,
  readGameSession,
  sendGameSessionInput,
  inspectGame,
  inspectGameAgentContract,
  inspectLocalRelease,
  inspectPlatformRelease,
  inspectProject,
  invokeGameSessionAction,
  listGames,
  listPlatformReleaseTargets,
  listPlatformReleases,
  listVisualCaptureSummaries,
  listVisualScenarios,
  publishPlatformRelease,
  readDevLogs,
  readVisualCaptureSummary,
  runQualityGate,
  startDev,
  stopDev,
  submitPlatformRelease,
  validateLocalRelease,
  closeGameSession,
  type AirJamProjectMode,
  type AirJamQualityGate,
} from "@air-jam/devtools-core";
import type { ToolExecution } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export type AirJamMcpToolDefinition = {
  description: string;
  inputSchema: z.ZodTypeAny;
  run: (args: never) => Promise<{
    content: Array<{
      type: "text";
      text: string;
    }>;
  }>;
  execution?: ToolExecution;
};

const withJsonText = <T>(value: T) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
});

const buildQualityGateSchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gate:
      projectMode === "monorepo"
        ? z.enum([
            "typecheck",
            "lint",
            "test",
            "build",
            "format-check",
            "scaffold-smoke",
            "release-check",
          ] satisfies [AirJamQualityGate, ...AirJamQualityGate[]])
        : z.enum([
            "typecheck",
            "lint",
            "test",
            "build",
            "format-check",
          ] satisfies [AirJamQualityGate, ...AirJamQualityGate[]]),
    packageFilter: z.string().optional(),
  });

const buildStartDevSchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    mode:
      projectMode === "monorepo"
        ? z.enum(["standalone-dev", "arcade-dev", "arcade-test"]).optional()
        : z.literal("standalone-dev").optional(),
    secure: z.boolean().optional(),
  });

const buildTopologySchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    mode:
      projectMode === "monorepo"
        ? z.enum(["standalone-dev", "arcade-dev", "arcade-test"]).optional()
        : z.literal("standalone-dev").optional(),
    secure: z.boolean().optional(),
  });

const buildCaptureVisualsSchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    scenarioId: z.string().optional(),
    mode:
      projectMode === "monorepo"
        ? z.enum(["standalone-dev", "arcade-test"]).optional()
        : z.literal("standalone-dev").optional(),
    secure: z.boolean().optional(),
  });

const buildHarnessModeSchema = (projectMode: AirJamProjectMode) =>
  projectMode === "monorepo"
    ? z.enum(["standalone-dev", "arcade-dev", "arcade-test"]).optional()
    : z.literal("standalone-dev").optional();

const RELEASE_PROJECT_INPUT_SCHEMA = z.object({
  cwd: z.string().optional(),
  distDir: z.string().optional(),
});

const RELEASE_PLATFORM_INPUT_SCHEMA = z.object({
  platformUrl: z.string().url().optional(),
});

const RELEASE_VALIDATE_INPUT_SCHEMA = RELEASE_PROJECT_INPUT_SCHEMA.extend({
  bundle: z.string().optional(),
  skipBuild: z.boolean().optional(),
});

const RELEASE_BUNDLE_INPUT_SCHEMA = RELEASE_PROJECT_INPUT_SCHEMA.extend({
  out: z.string().optional(),
  skipBuild: z.boolean().optional(),
});

const RELEASE_LIST_INPUT_SCHEMA = RELEASE_PLATFORM_INPUT_SCHEMA.extend({
  game: z.string().optional(),
});

const RELEASE_INSPECT_INPUT_SCHEMA = RELEASE_PLATFORM_INPUT_SCHEMA.extend({
  releaseId: z.string().min(1),
});

const RELEASE_SUBMIT_INPUT_SCHEMA = RELEASE_PLATFORM_INPUT_SCHEMA.extend({
  game: z.string().min(1),
  versionLabel: z.string().optional(),
  cwd: z.string().optional(),
  distDir: z.string().optional(),
  bundle: z.string().optional(),
  skipBuild: z.boolean().optional(),
  publish: z.boolean().optional(),
});

const RELEASE_PUBLISH_INPUT_SCHEMA = RELEASE_PLATFORM_INPUT_SCHEMA.extend({
  releaseId: z.string().min(1),
});

export const READ_LOGS_INPUT_SCHEMA = z.object({
  cwd: z.string().optional(),
  view: z.string().optional(),
  source: z.string().optional(),
  trace: z.string().optional(),
  room: z.string().optional(),
  controller: z.string().optional(),
  event: z.string().optional(),
  process: z.string().optional(),
  level: z.string().optional(),
  runtime: z.string().optional(),
  epoch: z.number().int().optional(),
  consoleCategory: z.string().optional(),
  file: z.string().optional(),
  tail: z.number().int().nonnegative().optional(),
});

export const INSPECT_GAME_INPUT_SCHEMA = z.object({
  cwd: z.string().optional(),
  gameId: z.string().optional(),
});

export const STOP_DEV_INPUT_SCHEMA = z.object({
  cwd: z.string().optional(),
  processId: z.string().optional(),
  mode: z.enum(["standalone-dev", "arcade-dev", "arcade-test"]).optional(),
});

const buildConnectControllerSchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    mode: buildHarnessModeSchema(projectMode),
    secure: z.boolean().optional(),
    roomId: z.string().min(1).optional(),
    harnessSessionId: z.string().min(1).optional(),
    controllerJoinUrl: z.string().url().optional(),
    controllerId: z.string().min(3).optional(),
    deviceId: z.string().min(8).optional(),
    nickname: z.string().min(1).optional(),
    avatarId: z.string().min(1).optional(),
    capabilityToken: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
  });

export const buildToolDefinitions = ({
  projectMode,
}: {
  projectMode: AirJamProjectMode;
}): Record<string, AirJamMcpToolDefinition> => {
  const runQualityGateInputSchema = buildQualityGateSchema(projectMode);
  const startDevInputSchema = buildStartDevSchema(projectMode);
  const topologyInputSchema = buildTopologySchema(projectMode);
  const captureVisualsInputSchema = buildCaptureVisualsSchema(projectMode);
  const inspectGameAgentContractInputSchema = z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
  });
  const openGameSessionInputSchema = buildConnectControllerSchema(projectMode);
  const gameSessionInputSchema = z.object({
    gameSessionId: z.string().min(1),
  });
  const sendGameSessionInputSchema = gameSessionInputSchema.extend({
    input: z.record(z.string(), z.unknown()),
  });
  const readGameSessionInputSchema = gameSessionInputSchema.extend({
    requestSync: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional(),
  });
  const invokeGameSessionActionInputSchema = gameSessionInputSchema.extend({
    actionId: z.string().min(1),
    payload: z.unknown().optional(),
    timeoutMs: z.number().int().positive().optional(),
  });

  return {
    "airjam.inspect_project": {
      description:
        "Inspect the current Air Jam project, detect monorepo vs standalone mode, and list available Air Jam capability groups.",
      inputSchema: z.object({
        cwd: z.string().optional(),
      }),
      run: async ({ cwd }: { cwd?: string }) =>
        withJsonText(await inspectProject({ cwd })),
    },
    "airjam.list_games": {
      description:
        "List Air Jam games visible from the current project. In the monorepo this returns first-party repo games; in a generated project it returns the current game.",
      inputSchema: z.object({
        cwd: z.string().optional(),
      }),
      run: async ({ cwd }: { cwd?: string }) =>
        withJsonText(await listGames({ cwd })),
    },
    "airjam.inspect_game": {
      description:
        "Inspect one Air Jam game, including config path, visual support, inferred controller route, and available quality gates.",
      inputSchema: INSPECT_GAME_INPUT_SCHEMA,
      run: async ({ cwd, gameId }: { cwd?: string; gameId?: string }) =>
        withJsonText(await inspectGame({ cwd, gameId })),
    },
    "airjam.inspect_game_agent_contract": {
      description:
        "Inspect one game's agent contract, including game-specific snapshot description and semantic controller action metadata.",
      inputSchema: inspectGameAgentContractInputSchema,
      run: async ({ cwd, gameId }: { cwd?: string; gameId?: string }) =>
        withJsonText(await inspectGameAgentContract({ cwd, gameId })),
    },
    "airjam.read_logs": {
      description:
        "Read the canonical Air Jam unified dev log stream. Start with view=signal and a bounded tail before adding more filters.",
      inputSchema: READ_LOGS_INPUT_SCHEMA,
      run: async (input: z.infer<typeof READ_LOGS_INPUT_SCHEMA>) =>
        withJsonText(await readDevLogs({ ...input, tail: input.tail ?? 200 })),
    },
    "airjam.run_quality_gate": {
      description:
        "Run one Air Jam quality gate such as typecheck, test, or build.",
      inputSchema: runQualityGateInputSchema,
      run: async (input: z.infer<typeof runQualityGateInputSchema>) =>
        withJsonText(await runQualityGate(input)),
    },
    "airjam.auth_status": {
      description:
        "Inspect the locally stored Air Jam platform machine session used for hosted release operations.",
      inputSchema: z.object({}),
      run: async () => withJsonText(await getPlatformMachineAuthStatus()),
    },
    "airjam.release_doctor": {
      description:
        "Inspect a standalone Air Jam game project for hosted release readiness and return structured local doctor output.",
      inputSchema: RELEASE_PROJECT_INPUT_SCHEMA,
      run: async ({
        cwd,
        distDir,
      }: z.infer<typeof RELEASE_PROJECT_INPUT_SCHEMA>) =>
        withJsonText(await inspectLocalRelease({ cwd, distDir })),
    },
    "airjam.release_validate": {
      description:
        "Validate hosted release inputs for a standalone Air Jam game project or an existing hosted release zip.",
      inputSchema: RELEASE_VALIDATE_INPUT_SCHEMA,
      run: async ({
        cwd,
        distDir,
        bundle,
        skipBuild,
      }: z.infer<typeof RELEASE_VALIDATE_INPUT_SCHEMA>) =>
        withJsonText(
          await validateLocalRelease({
            cwd,
            distDir,
            bundlePath: bundle,
            skipBuild,
          }),
        ),
    },
    "airjam.release_bundle": {
      description:
        "Build and bundle a hosted release zip from a standalone Air Jam game project.",
      inputSchema: RELEASE_BUNDLE_INPUT_SCHEMA,
      execution: {
        taskSupport: "required",
      },
      run: async ({
        cwd,
        distDir,
        out,
        skipBuild,
      }: z.infer<typeof RELEASE_BUNDLE_INPUT_SCHEMA>) =>
        withJsonText(
          await bundleLocalRelease({
            cwd,
            distDir,
            out,
            skipBuild,
          }),
        ),
    },
    "airjam.release_list": {
      description:
        "List owned hosted games or, when given a game slug or id, list its hosted releases.",
      inputSchema: RELEASE_LIST_INPUT_SCHEMA,
      run: async ({
        platformUrl,
        game,
      }: z.infer<typeof RELEASE_LIST_INPUT_SCHEMA>) =>
        withJsonText(
          game
            ? await listPlatformReleases({
                platformUrl,
                slugOrId: game,
              })
            : await listPlatformReleaseTargets({
                platformUrl,
              }),
        ),
    },
    "airjam.release_inspect": {
      description: "Inspect one hosted release on the Air Jam platform.",
      inputSchema: RELEASE_INSPECT_INPUT_SCHEMA,
      run: async ({
        platformUrl,
        releaseId,
      }: z.infer<typeof RELEASE_INSPECT_INPUT_SCHEMA>) =>
        withJsonText(
          await inspectPlatformRelease({
            platformUrl,
            releaseId,
          }),
        ),
    },
    "airjam.release_submit": {
      description:
        "Bundle a standalone Air Jam game if needed, upload it as a hosted release draft, finalize it, and optionally publish it.",
      inputSchema: RELEASE_SUBMIT_INPUT_SCHEMA,
      execution: {
        taskSupport: "required",
      },
      run: async ({
        platformUrl,
        game,
        versionLabel,
        cwd,
        distDir,
        bundle,
        skipBuild,
        publish,
      }: z.infer<typeof RELEASE_SUBMIT_INPUT_SCHEMA>) =>
        withJsonText(
          await submitPlatformRelease({
            platformUrl,
            slugOrId: game,
            versionLabel,
            cwd,
            distDir,
            bundlePath: bundle,
            skipBuild,
            publish,
          }),
        ),
    },
    "airjam.release_publish": {
      description: "Publish one ready hosted release on the Air Jam platform.",
      inputSchema: RELEASE_PUBLISH_INPUT_SCHEMA,
      run: async ({
        platformUrl,
        releaseId,
      }: z.infer<typeof RELEASE_PUBLISH_INPUT_SCHEMA>) =>
        withJsonText(
          await publishPlatformRelease({
            platformUrl,
            releaseId,
          }),
        ),
    },
    "airjam.start_dev": {
      description:
        "Start the Air Jam local dev stack for the current project and return the managed process id plus resolved topology.",
      inputSchema: startDevInputSchema,
      run: async (input: z.infer<typeof startDevInputSchema>) =>
        withJsonText(await startDev(input)),
    },
    "airjam.stop_dev": {
      description:
        "Stop one or more Air Jam dev processes previously started by devtools-core.",
      inputSchema: STOP_DEV_INPUT_SCHEMA,
      run: async (input: z.infer<typeof STOP_DEV_INPUT_SCHEMA>) =>
        withJsonText(await stopDev(input)),
    },
    "airjam.status": {
      description:
        "List Air Jam dev processes currently known to the local devtools registry.",
      inputSchema: z.object({
        cwd: z.string().optional(),
      }),
      run: async ({ cwd }: { cwd?: string }) =>
        withJsonText(await getDevStatus({ cwd })),
    },
    "airjam.topology": {
      description:
        "Return the resolved runtime topology and endpoint summary for the current project mode.",
      inputSchema: topologyInputSchema,
      run: async (input: z.infer<typeof topologyInputSchema>) =>
        withJsonText(await getTopology(input)),
    },
    "airjam.list_visual_scenarios": {
      description:
        "Load one game's visual scenario pack and list scenario ids plus harness action metadata for any published bridge controls.",
      inputSchema: INSPECT_GAME_INPUT_SCHEMA,
      run: async ({ cwd, gameId }: { cwd?: string; gameId?: string }) =>
        withJsonText(await listVisualScenarios({ cwd, gameId })),
    },
    "airjam.capture_visuals": {
      description:
        "Run Air Jam visual capture for one game and return artifact metadata and screenshot paths.",
      inputSchema: captureVisualsInputSchema,
      execution: {
        taskSupport: "required",
      },
      run: async (input: z.infer<typeof captureVisualsInputSchema>) =>
        withJsonText(await captureVisuals(input)),
    },
    "airjam.open_game_session": {
      description:
        "Open one high-level Air Jam game session by connecting a virtual controller and discovering any published semantic or harness control surfaces for the same room.",
      inputSchema: openGameSessionInputSchema,
      run: async (input: z.infer<typeof openGameSessionInputSchema>) =>
        withJsonText(await openGameSession(input)),
    },
    "airjam.send_game_session_input": {
      description:
        "Send one real player-style input payload through a previously opened Air Jam game session.",
      inputSchema: sendGameSessionInputSchema,
      run: async (input: z.infer<typeof sendGameSessionInputSchema>) =>
        withJsonText(await sendGameSessionInput(input)),
    },
    "airjam.read_game_session": {
      description:
        "Read one high-level Air Jam game session, including runtime controller state plus any available semantic game snapshot and harness snapshot surfaces.",
      inputSchema: readGameSessionInputSchema,
      run: async (input: z.infer<typeof readGameSessionInputSchema>) =>
        withJsonText(await readGameSession(input)),
    },
    "airjam.invoke_game_session_action": {
      description:
        "Invoke one discovered game-session action by its unified session action id, without manually choosing between player-semantic and host-staging internals.",
      inputSchema: invokeGameSessionActionInputSchema,
      run: async (input: z.infer<typeof invokeGameSessionActionInputSchema>) =>
        withJsonText(await invokeGameSessionAction(input)),
    },
    "airjam.close_game_session": {
      description:
        "Close one previously opened Air Jam game session and disconnect its virtual controller.",
      inputSchema: gameSessionInputSchema,
      run: async ({ gameSessionId }: { gameSessionId: string }) =>
        withJsonText(await closeGameSession({ gameSessionId })),
    },
    "airjam.list_visual_capture_summaries": {
      description:
        "List existing Air Jam visual capture summaries already written under .airjam/artifacts/visual.",
      inputSchema: z.object({
        cwd: z.string().optional(),
      }),
      run: async ({ cwd }: { cwd?: string }) =>
        withJsonText(await listVisualCaptureSummaries({ cwd })),
    },
    "airjam.read_visual_capture_summary": {
      description:
        "Read one Air Jam visual capture summary for a game from .airjam/artifacts/visual/<game>/capture-summary.json.",
      inputSchema: INSPECT_GAME_INPUT_SCHEMA,
      run: async ({ cwd, gameId }: { cwd?: string; gameId?: string }) =>
        withJsonText(await readVisualCaptureSummary({ cwd, gameId })),
    },
  } as const;
};

export type AirJamMcpToolDefinitions = ReturnType<typeof buildToolDefinitions>;

export const getRegisteredToolNamesForProjectMode = (
  projectMode: AirJamProjectMode,
): ReadonlyArray<keyof AirJamMcpToolDefinitions> => {
  if (projectMode === "monorepo") {
    return [
      "airjam.inspect_project",
      "airjam.auth_status",
      "airjam.list_games",
      "airjam.inspect_game",
      "airjam.inspect_game_agent_contract",
      "airjam.read_logs",
      "airjam.run_quality_gate",
      "airjam.release_list",
      "airjam.release_inspect",
      "airjam.release_publish",
      "airjam.start_dev",
      "airjam.stop_dev",
      "airjam.status",
      "airjam.topology",
      "airjam.list_visual_scenarios",
      "airjam.capture_visuals",
      "airjam.open_game_session",
      "airjam.send_game_session_input",
      "airjam.read_game_session",
      "airjam.invoke_game_session_action",
      "airjam.close_game_session",
      "airjam.list_visual_capture_summaries",
      "airjam.read_visual_capture_summary",
    ] as const;
  }

  if (projectMode === "standalone-game") {
    return [
      "airjam.inspect_project",
      "airjam.auth_status",
      "airjam.list_games",
      "airjam.inspect_game",
      "airjam.inspect_game_agent_contract",
      "airjam.read_logs",
      "airjam.run_quality_gate",
      "airjam.release_doctor",
      "airjam.release_validate",
      "airjam.release_bundle",
      "airjam.release_list",
      "airjam.release_inspect",
      "airjam.release_submit",
      "airjam.release_publish",
      "airjam.start_dev",
      "airjam.stop_dev",
      "airjam.status",
      "airjam.topology",
      "airjam.list_visual_scenarios",
      "airjam.capture_visuals",
      "airjam.open_game_session",
      "airjam.send_game_session_input",
      "airjam.read_game_session",
      "airjam.invoke_game_session_action",
      "airjam.close_game_session",
      "airjam.list_visual_capture_summaries",
      "airjam.read_visual_capture_summary",
    ] as const;
  }

  return ["airjam.inspect_project"] as const;
};

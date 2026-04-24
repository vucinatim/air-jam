import {
  captureVisuals,
  getDevStatus,
  getTopology,
  inspectGame,
  inspectProject,
  invokeHarnessAction,
  listGames,
  listHarnessSessions,
  listVisualCaptureSummaries,
  listVisualScenarios,
  readDevLogs,
  readHarnessSnapshot,
  readVisualCaptureSummary,
  runQualityGate,
  startDev,
  stopDev,
  type AirJamProjectMode,
  type AirJamQualityGate,
} from "@air-jam/devtools-core";
import type { ToolExecution } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export type AirJamMcpToolDefinition = {
  description: string;
  inputSchema: z.ZodTypeAny;
  run: (args: any) => Promise<{
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

const buildReadHarnessSnapshotSchema = (projectMode: AirJamProjectMode) =>
  z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    mode: buildHarnessModeSchema(projectMode),
    secure: z.boolean().optional(),
    roomId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
  });

const buildInvokeHarnessActionSchema = (projectMode: AirJamProjectMode) =>
  buildReadHarnessSnapshotSchema(projectMode).extend({
    actionName: z.string().min(1),
    payload: z.unknown().optional(),
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
  const listHarnessSessionsInputSchema = z.object({
    cwd: z.string().optional(),
    gameId: z.string().optional(),
    mode: buildHarnessModeSchema(projectMode),
    secure: z.boolean().optional(),
    roomId: z.string().min(1).optional(),
  });
  const readHarnessSnapshotInputSchema =
    buildReadHarnessSnapshotSchema(projectMode);
  const invokeHarnessActionInputSchema =
    buildInvokeHarnessActionSchema(projectMode);

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
    "airjam.list_harness_sessions": {
      description:
        "List live Air Jam harness sessions currently registered by browser runtimes, including room ids, action metadata, and the latest published snapshot.",
      inputSchema: listHarnessSessionsInputSchema,
      run: async (input: z.infer<typeof listHarnessSessionsInputSchema>) =>
        withJsonText(await listHarnessSessions(input)),
    },
    "airjam.read_harness_snapshot": {
      description:
        "Open a live Air Jam harness session, resolve the controller join URL, and read the current published harness bridge snapshot plus action metadata.",
      inputSchema: readHarnessSnapshotInputSchema,
      run: async (input: z.infer<typeof readHarnessSnapshotInputSchema>) =>
        withJsonText(await readHarnessSnapshot(input)),
    },
    "airjam.invoke_harness_action": {
      description:
        "Invoke one published Air Jam harness bridge action against a live dev session and return the result plus before/after snapshots.",
      inputSchema: invokeHarnessActionInputSchema,
      run: async (input: z.infer<typeof invokeHarnessActionInputSchema>) =>
        withJsonText(await invokeHarnessAction(input)),
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
  if (projectMode === "monorepo" || projectMode === "standalone-game") {
    return [
      "airjam.inspect_project",
      "airjam.list_games",
      "airjam.inspect_game",
      "airjam.read_logs",
      "airjam.run_quality_gate",
      "airjam.start_dev",
      "airjam.stop_dev",
      "airjam.status",
      "airjam.topology",
      "airjam.list_visual_scenarios",
      "airjam.capture_visuals",
      "airjam.list_harness_sessions",
      "airjam.read_harness_snapshot",
      "airjam.invoke_harness_action",
      "airjam.list_visual_capture_summaries",
      "airjam.read_visual_capture_summary",
    ] as const;
  }

  return ["airjam.inspect_project"] as const;
};

import type { z } from "zod";
import { inspectProject } from "./context.js";
import type { AirJamGameRunRecord } from "./game-run-owner.js";
import type {
  CurrentRoomAttachment,
  GameRunSteerOptions,
  StartGameRunOptions,
} from "./game-run-protocol.js";
import {
  gameRunAddressSchema,
  gameRunCancellationSchema,
  gameRunDiscoverySchema,
  gameRunWaitSchema,
} from "./game-run-protocol.js";
import { readTerminalGameRun } from "./game-run-record.js";
import { gameRunWatchRequestSchema } from "./game-run-watch.js";
import {
  ensureGameSessionBroker,
  readGameSessionBrokerState,
  requestGameSessionBroker,
  watchGameSessionBroker,
} from "./game-session-broker.js";
import {
  gameSessionBrokerRequestSchema,
  gameSessionOperationSchemas,
} from "./game-session-protocol.js";
import type { createGameSessionRuntime } from "./game-session-runtime.js";
import type { AirJamTestProfileDescription } from "./testing.js";
import type {
  AirJamGameSessionInspection,
  AirJamGameSessionSummary,
  AirJamGameSessionVisualCaptureResult,
  CaptureGameSessionVisualsOptions,
  CloseGameSessionOptions,
  CloseGameSessionResult,
  InvokeGameSessionActionOptions,
  InvokeGameSessionActionResult,
  OpenGameSessionOptions,
  ReadGameSessionOptions,
  SendGameSessionInputOptions,
  SendGameSessionInputResult,
} from "./types.js";

export type {
  AirJamGameSessionActionDescriptor,
  AirJamGameSessionInspection,
  AirJamGameSessionSummary,
  AirJamGameSessionVisualCaptureResult,
  CaptureGameSessionVisualsOptions,
  CloseGameSessionOptions,
  CloseGameSessionResult,
  InvokeGameSessionActionOptions,
  InvokeGameSessionActionResult,
  OpenGameSessionOptions,
  ReadGameSessionOptions,
  SendGameSessionInputOptions,
  SendGameSessionInputResult,
} from "./types.js";
export { gameSessionOperationSchemas };
export type {
  AirJamGameRunRecord,
  CurrentRoomAttachment,
  GameRunSteerOptions,
  StartGameRunOptions,
};
export type ControlGameSessionParticipantOptions = Parameters<
  ReturnType<typeof createGameSessionRuntime>["controlGameSessionParticipant"]
>[0];
export type ObserveGameSessionOptions = Parameters<
  ReturnType<typeof createGameSessionRuntime>["observeGameSession"]
>[0];

async function request<TResult>(
  operation: string,
  input: unknown,
  cwd?: string,
  attachment?: CurrentRoomAttachment,
): Promise<TResult> {
  const parsed = gameSessionBrokerRequestSchema.parse({
    operation,
    input,
    ...(attachment ? { attachment } : {}),
  });
  const projectDir = (await inspectProject({ cwd })).context.rootDir;
  if (parsed.operation === "run.read" || parsed.operation === "run.wait") {
    const { runId } = parsed.input;
    const record = await readTerminalGameRun(projectDir, runId);
    if (record) return record as TResult;
  }
  const state =
    operation === "open" ||
    operation === "run.start" ||
    operation === "run.cancel" ||
    operation === "run.profiles"
      ? await ensureGameSessionBroker(projectDir)
      : await readGameSessionBrokerState(projectDir);
  if (!state && operation === "run.stop-all") return [] as TResult;
  if (!state)
    throw new Error(
      `owner_unavailable: No game session owner is running for ${projectDir}. Sessions are scoped to their project; pass cwd when addressing another project.`,
    );
  return requestGameSessionBroker<TResult>({ state, request: parsed });
}

export const openGameSession = (input: OpenGameSessionOptions = {}) =>
  request<AirJamGameSessionSummary>("open", input, input.cwd);
export const readGameSession = (input: ReadGameSessionOptions) =>
  request<AirJamGameSessionInspection>("read", input, input.cwd);
export const observeGameSession = (input: ObserveGameSessionOptions) =>
  request<
    Awaited<
      ReturnType<
        ReturnType<typeof createGameSessionRuntime>["observeGameSession"]
      >
    >
  >("observe", input, input.cwd);
export const readGameSettings = (
  input: z.infer<(typeof gameSessionOperationSchemas)["settings-read"]>,
) =>
  request<
    Awaited<
      ReturnType<
        ReturnType<typeof createGameSessionRuntime>["readGameSettings"]
      >
    >
  >("settings-read", input, input.cwd);
export const updateGameSettings = (
  input: z.infer<(typeof gameSessionOperationSchemas)["settings-update"]>,
) =>
  request<
    Awaited<
      ReturnType<
        ReturnType<typeof createGameSessionRuntime>["updateGameSettings"]
      >
    >
  >("settings-update", input, input.cwd);
export const controlGameSessionParticipant = (
  input: ControlGameSessionParticipantOptions,
) =>
  request<
    Awaited<
      ReturnType<
        ReturnType<
          typeof createGameSessionRuntime
        >["controlGameSessionParticipant"]
      >
    >
  >("control", input, input.cwd);
export const sendGameSessionInput = (input: SendGameSessionInputOptions) =>
  request<SendGameSessionInputResult>("input", input, input.cwd);
export const invokeGameSessionAction = (
  input: InvokeGameSessionActionOptions,
) => request<InvokeGameSessionActionResult>("invoke", input, input.cwd);
export const captureGameSessionVisuals = (
  input: CaptureGameSessionVisualsOptions,
) => request<AirJamGameSessionVisualCaptureResult>("capture", input, input.cwd);
export const closeGameSession = (input: CloseGameSessionOptions) =>
  request<CloseGameSessionResult>("close", input, input.cwd);

export const startGameRun = (
  input: StartGameRunOptions,
  attachment?: CurrentRoomAttachment,
) => request<AirJamGameRunRecord>("run.start", input, input.cwd, attachment);
export const readGameRun = (input: z.infer<typeof gameRunAddressSchema>) =>
  request<AirJamGameRunRecord>("run.read", input, input.cwd);
export const waitGameRun = (input: z.input<typeof gameRunWaitSchema>) =>
  request<AirJamGameRunRecord>("run.wait", input, input.cwd);
export const stopGameRun = (input: z.infer<typeof gameRunAddressSchema>) =>
  request<AirJamGameRunRecord>("run.stop", input, input.cwd);
export const steerGameRun = (input: GameRunSteerOptions) =>
  request<AirJamGameRunRecord>("run.steer", input, input.cwd);
export const cancelGameRun = (input: z.infer<typeof gameRunAddressSchema>) =>
  request<z.infer<typeof gameRunCancellationSchema>>(
    "run.cancel",
    input,
    input.cwd,
  );
export { replayGameRun } from "./game-run-replay.js";
export const listGameRuns = (input: { cwd?: string } = {}) =>
  request<AirJamGameRunRecord[]>("run.list", input, input.cwd);
export const stopAllGameRuns = (input: { cwd?: string } = {}) =>
  request<AirJamGameRunRecord[]>("run.stop-all", input, input.cwd);
export const listGameTestProfiles = (
  input: z.infer<typeof gameRunDiscoverySchema> = {},
) =>
  request<{ gameId: string; profiles: AirJamTestProfileDescription[] }>(
    "run.profiles",
    input,
    input.cwd,
  );

export async function watchGameRun(
  input: unknown,
  onEvent: Parameters<typeof watchGameSessionBroker>[0]["onEvent"],
  signal: AbortSignal,
) {
  const parsed = gameRunWatchRequestSchema.parse(input);
  const projectDir = (await inspectProject({ cwd: parsed.cwd })).context
    .rootDir;
  const state = await readGameSessionBrokerState(projectDir);
  if (!state)
    throw new Error(
      "owner_unavailable: No game session owner is running for this project.",
    );
  await watchGameSessionBroker({ state, input: parsed, onEvent, signal });
}

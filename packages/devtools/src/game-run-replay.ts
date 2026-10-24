import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readTerminalGameRun } from "./game-run-record.js";
import { listGames } from "./games.js";
import { replayInputLog } from "./headless-room.js";

const OBSERVE_TIMEOUT_MS = 10_000;

/** What decides a match: the game's agent view, its simulation and its step. */
const outcome = (observation: HostObservation) => ({
  snapshot: observation.snapshot,
  runtime: observation.runtime,
  tick: observation.ticks.after,
});

/**
 * Replays an ended headless run from its input log on a fresh copy of the
 * game, and compares where the replay ends with the run's final observation.
 */
export async function replayGameRun({
  cwd,
  runId,
}: {
  cwd?: string;
  runId: string;
}) {
  const projectDir = await realpath(cwd ?? process.cwd());
  const record = await readTerminalGameRun(projectDir, runId);
  if (!record)
    throw new Error("run_not_ended: Replay a run once it has ended.");
  const evidence = record.evidence;
  if (!evidence?.inputLog || !evidence.observation)
    throw new Error(
      "no_input_log: Only headless runs of games with a simulation keep an input log.",
    );
  const games = await listGames({ cwd: projectDir });
  const game = games.find(({ id }) => id === record.request.gameId);
  if (!game?.configPath)
    throw new Error("game_not_found: The run's game is no longer here.");
  const runDirectory = path.join(
    projectDir,
    ".airjam",
    "artifacts",
    "runs",
    runId,
  );
  const inputLogPath = path.join(runDirectory, "input-log.json");
  const source = await readFile(inputLogPath);
  if (
    createHash("sha256").update(source).digest("hex") !==
    evidence.inputLog.sha256
  )
    throw new Error("run_receipt_invalid: The input log changed.");
  const recorded = JSON.parse(
    await readFile(path.join(runDirectory, "final-observation.json"), "utf8"),
  ) as HostObservation;

  const replay = await replayInputLog({
    rootDir: game.rootDir,
    configPath: game.configPath,
    inputLogPath,
    logPath: path.join(runDirectory, "replay.log"),
  });
  try {
    const response = await replay.requestHost(
      {
        operation: "observe",
        roomId: replay.roomId,
        controllerId: recorded.controllerId,
        scope: recorded.scope,
        includeImage: false,
      },
      OBSERVE_TIMEOUT_MS,
    );
    if (response.operation !== "observe")
      throw new Error("invalid_runtime_response: Expected an observation.");
    const replayed = outcome(response.observation);
    const original = outcome(recorded);
    return {
      runId,
      gameId: replay.gameId,
      ticks: replay.ticks,
      reproduced: isDeepStrictEqual(replayed, original),
      replayed,
      recorded: original,
    };
  } finally {
    await replay.stop();
  }
}

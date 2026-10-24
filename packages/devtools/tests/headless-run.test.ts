// Plays a real game's authored profile in a headless room: the Air Jam relay,
// the game's host core and Node controllers, on game time with no page.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { GameRunOwner } from "../src/game-run-owner.js";
import { createGameSessionRuntime } from "../src/game-session-runtime.js";

const pongDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../games/pong",
);

test("Pong's scoring profile passes headless, faster than real time", async () => {
  const sessions = createGameSessionRuntime();
  const owner = new GameRunOwner({
    projectDir: pongDir,
    ownerInstanceId: randomUUID(),
    openSession: ({ gameId, nickname, room }) =>
      sessions.openRunSession({ cwd: pongDir, gameId, nickname }, { room }),
    sessionClosed: () => {},
  });
  const runId = randomUUID();
  await owner.start({
    runId,
    gameId: "pong",
    target: { kind: "headless" },
    profileId: "scoring",
    policyId: "code",
    seed: 7,
    budget: { durationMs: 60_000, steps: 3000 },
  });
  const record = await owner.wait(runId, 60_000);

  expect(record.end).toMatchObject({ reason: "completed", outcome: "passed" });
  expect(record.evaluation?.final?.metrics?.goals).toBeGreaterThan(0);
  expect(record.cleanup).toMatchObject({
    errors: [],
    participantsClosed: true,
    processesClosed: true,
  });

  // Each play round is one decision interval of game time.
  const trace = (
    await readFile(
      path.join(pongDir, ".airjam/artifacts/runs", runId, "trace.ndjson"),
      "utf8",
    )
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { at: string; kind: string });
  const at = (event: { at: string }) => Date.parse(event.at);
  const ready = trace.find((event) => event.kind === "participants_ready");
  const rounds = trace.filter((event) => event.kind === "evaluation");
  const last = rounds.at(-1);
  if (!ready || !last || !record.profile || rounds.length < 2)
    throw new Error("The run did not play.");
  const gameMs = (rounds.length - 1) * record.profile.timing.intervalMs;
  const wallMs = at(last) - at(ready);
  expect(gameMs / wallMs).toBeGreaterThan(3);
}, 90_000);

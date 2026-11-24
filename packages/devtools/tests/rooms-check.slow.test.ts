import {
  ROOMS_CHECK_SCENARIOS,
  runRoomsCheck,
} from "@air-jam/devtools/rooms-check";
import { DEFAULT_ROOM_LIMITS } from "@air-jam/sdk/room-protocol";
import { createServerLogger, loadServerEnv } from "@air-jam/server";
import type { RoomGate } from "@air-jam/server/room";
import { createRoomServer } from "@air-jam/server/room-server";
import { afterAll, expect, it } from "vitest";

const PAGE_ORIGIN = "https://play.example";
const spent = new Set<string>();

/** As a hosted gate does: each grant opens one room, from the page it was given to. */
const gate: RoomGate = {
  admit: ({ hello, origin }) => {
    const credential = hello.credential;
    if (
      origin !== PAGE_ORIGIN ||
      !credential?.startsWith("grant-") ||
      spent.has(credential)
    )
      return { outcome: "refuse", reason: "unauthorised" };
    spent.add(credential);
    return {
      outcome: "open",
      limits: { ...DEFAULT_ROOM_LIMITS, hostGraceMs: 5_000 },
      labels: {},
      activity: null,
      activityChangeable: true,
    };
  },
};

// The server notices silence within seconds and closes an abandoned room in
// five, so every scenario runs in seconds while keeping its meaning.
const server = createRoomServer({
  envConfig: loadServerEnv({}),
  devLogCollector: false,
  logger: createServerLogger(undefined, undefined, null, { level: "silent" }),
  heartbeat: { intervalMs: 1_000, silenceMs: 6_000 },
  allowedOrigins: [PAGE_ORIGIN],
  gate,
});

afterAll(() => server.stop());

it("passes every room acceptance scenario against the Node room server", async () => {
  const port = await server.start(0);
  const report = await runRoomsCheck({
    url: `http://127.0.0.1:${port}`,
    origin: PAGE_ORIGIN,
    hostCredentialCommand: `"${process.execPath}" -p "'grant-' + crypto.randomUUID()"`,
    connectionsPerMinute: 6_000,
    scenarios: ROOMS_CHECK_SCENARIOS,
    briefFreezeMs: 1_500,
    stallMs: 4_000,
    idleMs: 8_000,
    crowdDurationMs: 2_000,
    load: { rooms: 4, phonesPerRoom: 4, durationMs: 2_000, workers: 1 },
  });
  expect(
    report.scenarios.flatMap((result) =>
      result.passed ? [] : [`${result.scenario}: ${result.failure}`],
    ),
  ).toEqual([]);
}, 180_000);

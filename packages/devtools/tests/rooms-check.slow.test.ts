import {
  ROOMS_CHECK_SCENARIOS,
  runRoomsCheck,
} from "@air-jam/devtools/rooms-check";
import { DEFAULT_ROOM_LIMITS } from "@air-jam/sdk/room-protocol";
import { createServerLogger, loadServerEnv } from "@air-jam/server";
import { createRoomServer } from "@air-jam/server/room-server";
import { afterAll, expect, it } from "vitest";

// The server notices silence within seconds and closes an abandoned room in
// five, so every scenario runs in seconds while keeping its meaning.
const server = createRoomServer({
  envConfig: loadServerEnv({}),
  devLogCollector: false,
  logger: createServerLogger(undefined, undefined, null, { level: "silent" }),
  heartbeat: { intervalMs: 1_000, silenceMs: 6_000 },
  limits: { ...DEFAULT_ROOM_LIMITS, hostGraceMs: 5_000 },
});

afterAll(() => server.stop());

it("passes every room acceptance scenario against the Node room server", async () => {
  const port = await server.start(0);
  const report = await runRoomsCheck({
    url: `http://127.0.0.1:${port}`,
    scenarios: ROOMS_CHECK_SCENARIOS,
    briefFreezeMs: 1_500,
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

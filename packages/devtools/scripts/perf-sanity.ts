/**
 * The room server's performance smoke: the acceptance tool's load scenario
 * (rooms of phones sending input at game rates while their hosts publish
 * state) against a Node room server started here. Prints the measurements;
 * a failed scenario fails the run.
 */
import { runRoomsCheck } from "@air-jam/devtools/rooms-check";
import { createServerLogger, loadServerEnv } from "@air-jam/server";
import { createRoomServer } from "@air-jam/server/room-server";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    rooms: { type: "string", default: "10" },
    phones: { type: "string", default: "4" },
    durationMs: { type: "string", default: "15000" },
    workers: { type: "string", default: "2" },
  },
});

const rooms = Number(values.rooms);
const phones = Number(values.phones);
// Every device connects from this machine, so the per-address admission
// limits follow the requested load, with room for each device to reconnect.
const server = createRoomServer({
  envConfig: loadServerEnv({
    AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX: String(rooms * 2),
    AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX: String(rooms * phones * 2),
  }),
  devLogCollector: false,
  logger: createServerLogger(undefined, undefined, null, { level: "silent" }),
});
try {
  const port = await server.start(0);
  const report = await runRoomsCheck({
    url: `http://127.0.0.1:${port}`,
    scenarios: ["load"],
    load: {
      rooms,
      phonesPerRoom: phones,
      durationMs: Number(values.durationMs),
      workers: Number(values.workers),
    },
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.scenarios.some((scenario) => !scenario.passed))
    process.exitCode = 1;
} finally {
  await server.stop();
}

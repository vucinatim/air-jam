import { createAirJamServer, loadServerEnv } from "@air-jam/server";
import assert from "node:assert/strict";
import fs from "node:fs";
import { io } from "socket.io-client";

const manifest = JSON.parse(
  fs.readFileSync("node_modules/@air-jam/server/package.json", "utf8"),
);
for (const name of [
  "@air-jam/database-contract",
  "@air-jam/operations-contract",
  "postgres",
  "drizzle-orm",
]) {
  assert.equal(manifest.dependencies?.[name], undefined);
}
for (const file of fs.readdirSync("node_modules/@air-jam/server/dist")) {
  if (!/\.(?:js|map|ts)$/.test(file)) continue;
  const source = fs.readFileSync(
    `node_modules/@air-jam/server/dist/${file}`,
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /@air-jam\/(?:database|operations)-contract|DatabaseRealtimeAdmissionService|realtime_host_grant_consumptions|operational_budget_cycles/,
  );
  assert.doesNotMatch(source, /from ["']@air-jam\/sdk["']/);
}
const runtime = createAirJamServer({
  devLogCollector: false,
  envConfig: loadServerEnv({ NODE_ENV: "test", AIR_JAM_LOG_LEVEL: "silent" }),
});
const sockets = [];
try {
  const port = await runtime.start(0);
  const baseUrl = `http://localhost:${port}`;
  const connect = async () => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  };
  const ack = (socket, event, payload) =>
    socket.timeout(2000).emitWithAck(event, payload);
  const host = await connect();
  assert.equal(
    (await ack(host, "host:bootstrap", { hostSessionKind: "system" })).ok,
    true,
  );
  const created = await ack(host, "host:createRoom", { maxPlayers: 2 });
  assert.equal(created.ok, true);
  const roomId = created.roomId;
  const controller = await connect();
  assert.equal(
    (
      await ack(controller, "controller:join", {
        roomId,
        controllerId: "artifact-controller",
      })
    ).ok,
    true,
  );
  const launch = await ack(host, "system:launchGame", {
    roomId,
    gameId: "artifact-game",
  });
  assert.equal(launch.ok, true);
  const child = await connect();
  assert.equal(
    (
      await ack(child, "host:joinAsChild", {
        roomId,
        capabilityToken: launch.launchCapability.token,
      })
    ).ok,
    true,
  );
  const state = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("No replicated state arrived")),
      2000,
    );
    controller.once("airjam:state_sync", (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
  child.emit("host:state_sync", {
    roomId,
    storeDomain: "default",
    revision: 0,
    data: { score: 7 },
  });
  assert.deepEqual((await state).data, { score: 7 });
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert.equal(health.realtimeAdmission.authority, "local");
  assert.equal(health.controllers, 1);
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);
  await runtime.drain(0);
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);
  process.stdout.write(
    JSON.stringify({
      installedArtifact: true,
      noPrivateDatabaseCode: true,
      realRoomAndController: true,
      childGameAndStateSync: true,
      readinessAndDrain: true,
    }) + "\n",
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  await runtime.stop();
}

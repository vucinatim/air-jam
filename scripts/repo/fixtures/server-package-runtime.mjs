import {
  createWebSocketConnector,
  HostRoomSession,
  PhoneRoomSession,
} from "@air-jam/sdk/room-session";
import { createServerLogging, loadServerEnv } from "@air-jam/server";
import { createRoomServer } from "@air-jam/server/room-server";
import assert from "node:assert/strict";
import fs from "node:fs";

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
  assert.doesNotMatch(source, /@air-jam\/(?:database|operations)-contract/);
}
const envConfig = loadServerEnv({
  NODE_ENV: "test",
  AIR_JAM_LOG_LEVEL: "silent",
});
const runtime = createRoomServer({
  ...createServerLogging({ devLogCollector: false }, envConfig),
  envConfig,
});
const sessions = [];
const until = async (condition) => {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("The condition never held.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
try {
  const port = await runtime.start(0);
  const baseUrl = `http://localhost:${port}`;
  const connector = createWebSocketConnector(baseUrl);
  const host = new HostRoomSession({
    connector,
    key: "artifact-host-key",
    seats: 2,
    deviceWakeEvents: null,
  });
  sessions.push(host);
  await until(() => host.status.phase === "open");
  const phone = new PhoneRoomSession({
    connector,
    key: "artifact-phone-key",
    code: host.code,
    deviceWakeEvents: null,
  });
  sessions.push(phone);
  await until(() => phone.status.phase === "open");
  host.publish("default", { score: 7 });
  await until(() => phone.channel("default")?.score === 7);
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert.equal(health.ok, true);
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);
  process.stdout.write(
    JSON.stringify({
      installedArtifact: true,
      noPrivateDatabaseCode: true,
      realRoomAndPhone: true,
      stateReachesPhone: true,
      healthAndReadiness: true,
    }) + "\n",
  );
} finally {
  for (const session of sessions) session.close();
  await runtime.stop();
}

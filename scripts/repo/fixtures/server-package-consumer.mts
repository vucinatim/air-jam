import {
  createServerLogging,
  loadServerEnv,
  type ServerEnvConfig,
} from "@air-jam/server";
import { createMasterKeyRoomGate, type RoomGate } from "@air-jam/server/room";
import { createRoomServer } from "@air-jam/server/room-server";

const envConfig: ServerEnvConfig = loadServerEnv({ NODE_ENV: "test" });
const gate: RoomGate = createMasterKeyRoomGate("typed-consumer-key");
const server = createRoomServer({
  ...createServerLogging({ devLogCollector: false }, envConfig),
  envConfig,
  gate,
});
await server.stop();

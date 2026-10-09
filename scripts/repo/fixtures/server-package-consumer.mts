import {
  createAirJamServer,
  loadServerEnv,
  type HostBootstrapAuthService,
  type RealtimeAdmissionService,
} from "@air-jam/server";

const authService: HostBootstrapAuthService = {
  verifyHostBootstrap: async () => ({ isVerified: false }),
};
const server = createAirJamServer({
  authService,
  envConfig: loadServerEnv({ NODE_ENV: "test" }),
});
const admitRoom: RealtimeAdmissionService["admitRoom"] = async ({
  roomId,
}) => ({
  ok: true,
  lease: { roomId, leaseToken: "typed-consumer" },
});
await admitRoom({ roomId: "TEST", maxControllers: 4 });
await server.stop();

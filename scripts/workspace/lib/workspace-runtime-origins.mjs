import { detectLocalIpv4 } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";

const toHttpOrigin = (hostname, port) => `http://${hostname}:${port}`;
const toHttpsOrigin = (hostname, port) => `https://${hostname}:${port}`;

export const resolveWorkspaceArcadeOrigins = ({
  secure = false,
  secureState = null,
  gamePort = DEFAULT_GAME_PORT,
  platformPort = DEFAULT_PLATFORM_PORT,
} = {}) => {
  if (secure) {
    if (!secureState) {
      throw new Error(
        "Secure Arcade workspace origin resolution requires a loaded secure dev state.",
      );
    }

    return {
      hostPlatformOrigin: toHttpsOrigin("localhost", platformPort),
      publicPlatformOrigin: secureState.platformHost,
      hostGameOrigin: toHttpsOrigin("localhost", gamePort),
      publicGameOrigin: secureState.publicHost,
    };
  }

  const lanIp = detectLocalIpv4() ?? "localhost";

  return {
    hostPlatformOrigin: toHttpOrigin("localhost", platformPort),
    publicPlatformOrigin: toHttpOrigin(lanIp, platformPort),
    hostGameOrigin: toHttpOrigin("localhost", gamePort),
    publicGameOrigin: toHttpOrigin(lanIp, gamePort),
  };
};

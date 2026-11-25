import { DEFAULT_MAX_PLAYERS } from "../constants";
import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";
import { AIRJAM_PRESENTATION_CHANNEL } from "../room-protocol";
import type {
  ProxyStrategy,
  ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";
import {
  findHostedEnvironment,
  hostedHostGrantEndpoint,
  hostedRuntimeErrorReporter,
} from "./hosted-rooms";

/** A surface's resolved runtime configuration; environments resolve it. */
export interface AirJamConfig {
  topology: ResolvedAirJamRuntimeTopology;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers: number;
  /**
   * Where runtime error reports go: on Air Jam's hosted rooms the platform
   * by default, elsewhere the development log when absent.
   */
  reportError?: RuntimeErrorReporter;
  /** The channel the host publishes its presentation on; a launcher uses its own so its game keeps the default. */
  presentationChannel: string;
  backendOrigin: string;
  socketOrigin: string;
  appOrigin: string;
  proxyStrategy: ProxyStrategy;
}

/**
 * The configuration of a surface whose topology is already resolved. A page
 * on Air Jam's hosted rooms talks to the platform that runs them unless told
 * otherwise: a host fetches its grants there and every page sends its crash
 * reports there. A self-hosted server keeps its own gate and reports.
 */
export const createAirJamConfig = ({
  topology,
  appId,
  hostGrantEndpoint,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  reportError,
  presentationChannel = AIRJAM_PRESENTATION_CHANNEL,
}: {
  topology: ResolvedAirJamRuntimeTopology;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers?: number;
  reportError?: RuntimeErrorReporter;
  presentationChannel?: string;
}): AirJamConfig => {
  const hosted = findHostedEnvironment(topology.socketOrigin);
  return {
    topology,
    appId,
    hostGrantEndpoint:
      hostGrantEndpoint ??
      (hosted ? hostedHostGrantEndpoint(hosted) : undefined),
    maxPlayers,
    reportError:
      reportError ?? (hosted ? hostedRuntimeErrorReporter(hosted) : undefined),
    presentationChannel,
    backendOrigin: topology.backendOrigin,
    socketOrigin: topology.socketOrigin,
    appOrigin: topology.appOrigin,
    proxyStrategy: topology.proxyStrategy,
  };
};

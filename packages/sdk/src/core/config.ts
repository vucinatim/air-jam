import { DEFAULT_MAX_PLAYERS } from "../constants";
import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";
import { AIRJAM_PRESENTATION_CHANNEL } from "../room-protocol";
import type {
  ProxyStrategy,
  ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";
import {
  AIR_JAM_HOSTED_HOST_GRANT_ENDPOINT,
  AIR_JAM_HOSTED_ROOMS_ORIGIN,
} from "./hosted-rooms";

/** A surface's resolved runtime configuration; environments resolve it. */
export interface AirJamConfig {
  topology: ResolvedAirJamRuntimeTopology;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers: number;
  /** Where runtime error reports go; the development log when absent. */
  reportError?: RuntimeErrorReporter;
  /** The channel the host publishes its presentation on; a launcher uses its own so its game keeps the default. */
  presentationChannel: string;
  backendOrigin: string;
  socketOrigin: string;
  appOrigin: string;
  proxyStrategy: ProxyStrategy;
}

/**
 * The configuration of a surface whose topology is already resolved. A host
 * on Air Jam's hosted rooms fetches its grants from the platform unless told
 * otherwise; a self-hosted server keeps its own gate.
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
}): AirJamConfig => ({
  topology,
  appId,
  hostGrantEndpoint:
    hostGrantEndpoint ??
    (topology.socketOrigin === AIR_JAM_HOSTED_ROOMS_ORIGIN
      ? AIR_JAM_HOSTED_HOST_GRANT_ENDPOINT
      : undefined),
  maxPlayers,
  reportError,
  presentationChannel,
  backendOrigin: topology.backendOrigin,
  socketOrigin: topology.socketOrigin,
  appOrigin: topology.appOrigin,
  proxyStrategy: topology.proxyStrategy,
});

import { DEFAULT_MAX_PLAYERS } from "../constants";
import type { HostSessionKind } from "../protocol/host";
import type {
  ProxyStrategy,
  ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";

/** A surface's resolved runtime configuration; environments resolve it. */
export interface AirJamConfig {
  topology: ResolvedAirJamRuntimeTopology;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers: number;
  hostSessionKind: HostSessionKind;
  backendOrigin: string;
  socketOrigin: string;
  appOrigin: string;
  proxyStrategy: ProxyStrategy;
}

/** The configuration of a surface whose topology is already resolved. */
export const createAirJamConfig = ({
  topology,
  appId,
  hostGrantEndpoint,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  hostSessionKind = "game",
}: {
  topology: ResolvedAirJamRuntimeTopology;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers?: number;
  hostSessionKind?: HostSessionKind;
}): AirJamConfig => ({
  topology,
  appId,
  hostGrantEndpoint,
  maxPlayers,
  hostSessionKind,
  backendOrigin: topology.backendOrigin,
  socketOrigin: topology.socketOrigin,
  appOrigin: topology.appOrigin,
  proxyStrategy: topology.proxyStrategy,
});

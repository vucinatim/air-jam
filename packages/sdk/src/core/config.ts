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

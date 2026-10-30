import { inspectGame } from "./games.js";
import type {
  AirJamAgentContractInspection,
  InspectGameAgentContractOptions,
} from "./types.js";
export type {
  AirJamAgentContractInspection,
  InspectGameAgentContractOptions,
} from "./types.js";

export async function inspectGameAgentContract({
  cwd = process.cwd(),
  gameId,
}: InspectGameAgentContractOptions = {}): Promise<AirJamAgentContractInspection> {
  const game = await inspectGame({ cwd, gameId });
  const contract = game.declaration.agent;
  return {
    gameId: game.id,
    rootDir: game.rootDir,
    source: "source-declaration",
    hasContract: contract !== null,
    snapshotStoreDomains: [],
    snapshotDescription: null,
    actions: [],
    ...contract,
  };
}

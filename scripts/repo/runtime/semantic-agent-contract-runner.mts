import { inspectAirJamAgentContractConformance } from "@air-jam/sdk/agent-tooling";
import path from "node:path";
import { pathToFileURL } from "node:url";

const readArg = (name: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Missing --${name}`);
  }
  return value;
};

const gameId = readArg("game-id");
const gameDir = path.resolve(readArg("game-dir"));
const contractPath = path.resolve(gameDir, readArg("contract"));
const storePath = path.resolve(gameDir, readArg("store"));
const storeExport = readArg("store-export");

const contractModule = (await import(pathToFileURL(contractPath).href)) as {
  agentContract?: Parameters<
    typeof inspectAirJamAgentContractConformance
  >[0]["contract"];
};
const storeModule = (await import(pathToFileURL(storePath).href)) as Record<
  string,
  { getState?: () => object }
>;
const contract = contractModule.agentContract;
const store = storeModule[storeExport];

if (!contract) {
  throw new Error(
    `${gameId} does not export agentContract from ${contractPath}`,
  );
}
if (!store?.getState) {
  throw new Error(`${gameId} does not export ${storeExport} from ${storePath}`);
}

const report = await inspectAirJamAgentContractConformance({
  gameId,
  contract,
  stores: { default: store.getState() },
});

process.stdout.write(`${JSON.stringify(report)}\n`);
if (!report.ok) {
  process.exitCode = 1;
}

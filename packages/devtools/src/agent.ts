import { agentContractDescriptionSchema } from "@air-jam/sdk/agent-tooling";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { inspectGame } from "./games.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import type {
  AirJamAgentContractInspection,
  InspectGameAgentContractOptions,
} from "./types.js";
export type {
  AirJamAgentContractInspection,
  InspectGameAgentContractOptions,
} from "./types.js";

const sourceDescriptionSchema = z.discriminatedUnion("hasContract", [
  z.object({ hasContract: z.literal(false) }),
  agentContractDescriptionSchema.extend({ hasContract: z.literal(true) }),
]);

/** Source declaration inspection; never used to interpret a running game. */
export async function inspectGameAgentContract({
  cwd = process.cwd(),
  gameId,
}: InspectGameAgentContractOptions = {}): Promise<AirJamAgentContractInspection> {
  const game = await inspectGame({ cwd, gameId });
  const empty = {
    gameId: game.id,
    rootDir: game.rootDir,
    source: "source-declaration" as const,
    hasContract: false,
    snapshotStoreDomains: [],
    snapshotDescription: null,
    actions: [],
  };
  if (!game.configPath) return empty;
  const configPath = game.configPath;
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        ...resolveDevtoolsHelperArgs(
          resolveDevtoolsHelperScript("agent-contract.ts"),
        ),
        "--config",
        configPath,
      ],
      { cwd: path.dirname(configPath), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "",
      settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill("SIGKILL");
        reject(error);
      } else resolve(stdout);
    };
    const timer = setTimeout(
      () => finish(new Error("Source contract inspection timed out.")),
      30000,
    );
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 1048576)
        finish(
          new Error("Source contract inspection exceeded its output limit."),
        );
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-8192);
    });
    child.once("error", finish);
    child.once("close", (code) =>
      finish(
        code === 0
          ? undefined
          : new Error(`Source contract inspection failed: ${stderr}`),
      ),
    );
  });
  const start = output.indexOf("{"),
    end = output.lastIndexOf("}");
  const result = sourceDescriptionSchema.parse(
    JSON.parse(output.slice(start, end + 1)),
  );
  return result.hasContract ? { ...empty, ...result } : empty;
}

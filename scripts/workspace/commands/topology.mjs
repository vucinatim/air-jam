import fs from "node:fs";
import path from "node:path";
import { runProjectTopologyCli } from "../../../packages/cli/runtime/topology.mjs";

export const runWorkspaceTopologyCommand = async ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure = false,
} = {}) => {
  const gamesRoot = path.join(rootDir, "games");
  const directory = fs
    .readdirSync(gamesRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name === gameId);
  if (
    !directory ||
    !fs.existsSync(path.join(gamesRoot, directory.name, "airjam-template.json"))
  )
    throw new Error(`Unknown game "${gameId}".`);
  await runProjectTopologyCli({
    cwd: path.join(gamesRoot, directory.name),
    argv: [`--mode=${mode}`, ...(secure ? ["--secure"] : [])],
  });
};

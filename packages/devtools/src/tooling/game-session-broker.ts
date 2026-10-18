import path from "node:path";
import { runGameSessionBroker } from "../game-session-broker.js";

const projectDir = process.argv[2];
if (!projectDir)
  throw new Error("Game session owner requires a project directory.");
await runGameSessionBroker({ projectDir: path.resolve(projectDir) });

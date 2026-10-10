import {
  capturePrefabAtRuntime,
  loadPrefabCapture,
} from "@air-jam/devtools/harness/visual";
import { findRepoGame } from "../../workspace/lib/repo-games.mjs";
import { repoRoot } from "../lib/paths.mjs";
import { startRepoVisualStack, VISUAL_ARTIFACT_ROOT } from "./core.js";

export const runVisualPrefabCaptureCommand = async (
  options: Omit<Parameters<typeof loadPrefabCapture>[0], "gameDirectory">,
) => {
  const game = findRepoGame({
    rootDir: repoRoot,
    gameId: options.gameId,
  });
  if (!game) throw new Error(`Unknown game "${options.gameId}".`);
  const capture = await loadPrefabCapture({
    ...options,
    gameDirectory: game.dir,
  });
  const stack = await startRepoVisualStack({
    gameId: game.id,
    mode: capture.mode,
    secure: capture.secure,
  });
  try {
    const result = await capturePrefabAtRuntime({
      capture,
      hostUrl: stack.urls.hostUrl,
      artifactRoot: VISUAL_ARTIFACT_ROOT,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await stack.shutdown();
  }
};

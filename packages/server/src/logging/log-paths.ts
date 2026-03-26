import path from "node:path";
import { fileURLToPath } from "node:url";

const resolveWorkspaceRootFromModule = (): string => {
  const thisFilePath = fileURLToPath(import.meta.url);
  const loggingDir = path.dirname(thisFilePath);
  return path.resolve(loggingDir, "../../../../");
};

export const AIR_JAM_WORKSPACE_ROOT = resolveWorkspaceRootFromModule();

export const resolveDefaultDevLogDir = (): string => {
  return path.join(AIR_JAM_WORKSPACE_ROOT, ".airjam", "logs");
};


import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  gameRunAddressSchema,
  gameRunRecordSchema,
  type AirJamGameRunRecord,
} from "./game-run-protocol.js";

export async function readGameRunArtifact(
  projectDir: string,
  runId: string,
  name: "record.json" | "trace.ndjson",
  maximumBytes: number,
) {
  gameRunAddressSchema.parse({ runId });
  const filename = path.join(
    await realpath(projectDir),
    ".airjam",
    "artifacts",
    "runs",
    runId,
    name,
  );
  const file = await open(
    filename,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!file) return null;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximumBytes)
      throw new Error(
        "run_receipt_invalid: Retained record exceeds its limit.",
      );
    const validatePath = async () => {
      const current = await lstat(filename);
      if ((await realpath(filename)) !== filename)
        throw new Error("run_receipt_invalid: Retained record path changed.");
      if (current.ino !== stat.ino || current.dev !== stat.dev) {
        // Live records are replaced atomically; a changing record is not an offline terminal receipt.
        if (name === "record.json" && current.isFile()) return false;
        throw new Error("run_receipt_invalid: Retained record path changed.");
      }
      return true;
    };
    if (!(await validatePath())) return null;
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (!(await validatePath())) return null;
    if (size !== stat.size)
      throw new Error(
        "run_receipt_invalid: Retained record changed during read.",
      );
    return buffer.subarray(0, size);
  } finally {
    await file.close();
  }
}

/** Completed evidence remains readable without reviving a session owner. */
export async function readTerminalGameRun(
  projectDir: string,
  runId: string,
): Promise<AirJamGameRunRecord | null> {
  const bytes = await readGameRunArtifact(
    projectDir,
    runId,
    "record.json",
    1_048_576,
  );
  if (!bytes) return null;
  const record = gameRunRecordSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (
    record.runId !== runId ||
    record.request.runId !== runId ||
    record.request.cwd !== projectDir
  )
    throw new Error("run_receipt_invalid: Retained record identity differs.");
  if (record.state !== "ended") return null;
  if (!record.endedAt || !record.end)
    throw new Error("run_receipt_invalid: Terminal receipt is incomplete.");
  return record;
}

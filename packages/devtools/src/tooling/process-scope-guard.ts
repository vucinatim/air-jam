import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  processGuardRequestSchema,
  type ProcessGuardResponse,
} from "../process-scope-protocol.js";
import {
  closeProcessScope,
  createProcessScope,
  processIdentity,
  processScopeJournalSchema,
  processScopeNamespace,
  registerProcessScope,
  type ProcessScope,
} from "../process-scope.js";
import { WindowsProcessScopes } from "../windows-process-scopes.js";

const scopes = new Map<string, { scope: ProcessScope; filename: string }>();
const recovered = new Set<string>();
let poisoned = false;
let windows: WindowsProcessScopes | null = null;
try {
  if (process.platform === "win32") windows = await WindowsProcessScopes.open();
} catch (error) {
  if (process.send && process.connected) {
    const transmit = process.send.bind(process);
    await new Promise<void>((resolve, reject) =>
      transmit(
        {
          kind: "startup-error",
          message: error instanceof Error ? error.message : String(error),
        } satisfies ProcessGuardResponse,
        undefined,
        undefined,
        (failure) => (failure ? reject(failure) : resolve()),
      ),
    );
  }
  throw error;
}
const guardian = windows ? null : processIdentity(process.pid);
if (!windows && !guardian)
  throw new Error("process_scope_unavailable: Guardian identity unavailable.");

async function persist(entry: { scope: ProcessScope; filename: string }) {
  const temporary = `${entry.filename}.new`;
  await writeFile(temporary, JSON.stringify({ guardian, scope: entry.scope }), {
    mode: 0o600,
  });
  await rename(temporary, entry.filename);
}
async function recover(rootDir: string) {
  if (recovered.has(rootDir)) return;
  const directory = path.join(rootDir, ".airjam/devtools/process-scopes");
  await mkdir(directory, { recursive: true });
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) continue;
    const filename = path.join(directory, name);
    let record;
    try {
      record = processScopeJournalSchema.parse(
        JSON.parse(await readFile(filename, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (record.scope.namespace !== processScopeNamespace()) {
      await unlink(filename).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      continue;
    }
    const owner = processIdentity(record.guardian.processId);
    if (owner?.started === record.guardian.started) continue;
    const receipt = await closeProcessScope(record.scope);
    if (receipt.status !== "tree_clean") {
      poisoned = true;
      await persist({ scope: record.scope, filename });
      throw new Error(
        `process_tree_unconfirmed: Recovery refused admission: ${JSON.stringify(receipt)}`,
      );
    }
    await unlink(filename).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  recovered.add(rootDir);
}
async function close(token: string) {
  if (windows) {
    const receipt = await windows.close(token);
    if (receipt.status !== "tree_clean") poisoned = true;
    return receipt;
  }
  const entry = scopes.get(token);
  if (!entry)
    throw new Error("process_scope_unavailable: Unknown process scope.");
  const receipt = await closeProcessScope(entry.scope);
  if (receipt.status === "tree_clean") {
    await unlink(entry.filename);
    scopes.delete(token);
  } else {
    poisoned = true;
    await persist(entry);
  }
  return receipt;
}
function send(value: ProcessGuardResponse) {
  if (process.connected) process.send?.(value);
}
let queue = Promise.resolve();
let stopping = false;
process.on("message", (value: unknown) => {
  queue = queue
    .then(async () => {
      const request = processGuardRequestSchema.parse(value);
      try {
        if (stopping)
          throw new Error("process_scope_unavailable: Guardian is stopping.");
        if (request.kind === "open") {
          if (poisoned)
            throw new Error(
              "process_tree_unconfirmed: Guardian requires preserved-workspace recovery before new admission.",
            );
          if (windows) await windows.create(request.token);
          else {
            await recover(request.rootDir);
            if (scopes.has(request.token))
              throw new Error("Duplicate process scope.");
            const entry = {
              scope: { ...createProcessScope(), token: request.token },
              filename: path.join(
                request.rootDir,
                ".airjam/devtools/process-scopes",
                `${request.token}.json`,
              ),
            };
            scopes.set(request.token, entry);
            await persist(entry);
          }
          send({ kind: "result", id: request.id });
        } else if (request.kind === "register") {
          if (windows)
            await windows.register(
              request.token,
              request.processId,
              request.root,
            );
          else {
            const entry = scopes.get(request.token);
            if (!entry) throw new Error("Unknown process scope.");
            registerProcessScope(entry.scope, request.processId);
            await persist(entry);
          }
          send({ kind: "result", id: request.id });
        } else
          send({
            kind: "result",
            id: request.id,
            receipt: await close(request.token),
          });
      } catch (error) {
        if (request.kind === "close") poisoned = true;
        send({
          kind: "error",
          scopeUnconfirmed: poisoned,
          id: request.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })
    .catch((error) => {
      console.error(error);
      void shutdown();
    });
});
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await queue;
  if (windows) await windows.shutdown();
  else await Promise.allSettled([...scopes.keys()].map(close));
  process.exit(0);
}
process.once("disconnect", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
process.once("SIGINT", () => {
  void shutdown();
});
if (process.connected) send({ kind: "ready" });
else await shutdown();

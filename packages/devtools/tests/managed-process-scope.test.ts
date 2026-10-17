import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import {
  closeScopedProcess,
  spawnScopedProcess,
} from "../src/managed-process-scope.js";
import { processScopeJournalSchema } from "../src/process-scope.js";

const loader = createRequire(import.meta.url).resolve("tsx");
const manager = new URL("../src/managed-process-scope.ts", import.meta.url)
  .href;
const resources: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  const errors: unknown[] = [];
  for (const release of resources.splice(0).reverse()) {
    try {
      await release();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "Process-scope fixture cleanup failed.");
});
const metadataSchema = z.object({
  type: z.literal("fixture-ready"),
  processId: z.number().int().positive(),
  descendantProcessId: z.number().int().positive(),
});
async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-scoped-process-"));
  resources.push(() => rm(root, { recursive: true, force: true }));
  return root;
}
function message(child: ChildProcess, type: string) {
  return new Promise<unknown>((resolve, reject) => {
    const finish = (error?: Error, value?: unknown) => {
      clearTimeout(timer);
      child.off("message", receive);
      child.off("exit", exited);
      if (error) reject(error);
      else resolve(value);
    };
    const receive = (value: unknown) => {
      if (
        value !== null &&
        typeof value === "object" &&
        "type" in value &&
        value.type === type
      )
        finish(undefined, value);
    };
    const exited = () =>
      finish(new Error("Fixture exited before its message."));
    const timer = setTimeout(
      () => finish(new Error("Fixture message timed out.")),
      8000,
    );
    child.on("message", receive);
    child.once("exit", exited);
  });
}
async function script(root: string, detached = false) {
  const filename = path.join(root, "fixture.mjs");
  await writeFile(
    filename,
    `
import {spawn} from 'node:child_process';
const descendant=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.send({type:'ready'});setInterval(()=>{},1000);"],{detached:${JSON.stringify(detached)},stdio:['ignore','inherit','inherit','ipc']});
descendant.once('message',()=>process.send({type:'fixture-ready',processId:process.pid,descendantProcessId:descendant.pid}));
process.on('message',value=>{if(value==='ping')process.send({type:'pong'});});
setInterval(()=>{},1000);
`,
  );
  return filename;
}
async function fixture(detached = false) {
  const root = await directory();
  const filename = await script(root, detached);
  const child = await spawnScopedProcess(["--import", loader, filename], {
    cwd: root,
  });
  child.stdout?.resume();
  child.stderr?.on("data", () => {});
  resources.push(() => closeScopedProcess(child));
  return {
    child,
    root,
    metadata: metadataSchema.parse(await message(child, "fixture-ready")),
  };
}
async function running(processId: number) {
  if (process.platform === "linux") {
    try {
      const stat = await readFile(`/proc/${processId}/stat`, "utf8");
      return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0] !== "Z";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

it("confirms cleanup after the root dies while its child holds stdout, preserving another scope", async () => {
  const first = await fixture();
  const second = await fixture();
  first.child.kill("SIGKILL");
  await closeScopedProcess(first.child);
  await expect
    .poll(() => running(first.metadata.descendantProcessId), { timeout: 4000 })
    .toBe(false);
  const reply = message(second.child, "pong");
  second.child.send("ping");
  expect(await reply).toEqual({ type: "pong" });
  expect(await running(second.metadata.descendantProcessId)).toBe(true);
}, 15000);

async function independentBroker() {
  const root = await directory();
  const helper = await script(root);
  const brokerFile = path.join(root, "broker.mjs");
  await writeFile(
    brokerFile,
    `
import {spawnScopedProcess,assertProcessScopesConfirmed} from ${JSON.stringify(manager)};
const child=await spawnScopedProcess(['--import',${JSON.stringify(loader)},${JSON.stringify(helper)}],{cwd:${JSON.stringify(root)}});
child.stdout.resume();child.stderr.resume();
child.on('message',value=>{if(value.type==='fixture-ready')process.send(value);});
process.on('message',value=>{if(value==='check-scope-owner'){let error=null;try{assertProcessScopesConfirmed();}catch(failure){error=String(failure);}process.send({type:'fault-status',error});}});
setInterval(()=>{},1000);
`,
  );
  const broker = spawn(process.execPath, ["--import", loader, brokerFile], {
    cwd: root,
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  broker.stderr?.on("data", () => {});
  resources.push(async () => {
    if (broker.exitCode === null && broker.signalCode === null)
      broker.kill("SIGKILL");
  });
  const owned = metadataSchema.parse(await message(broker, "fixture-ready"));
  return { root, broker, owned };
}

it("the dead-man guardian cleans descendants when its broker is killed", async () => {
  const unrelated = await fixture();
  const { broker, owned } = await independentBroker();
  broker.kill("SIGKILL");
  await expect
    .poll(
      async () =>
        !(await running(owned.processId)) &&
        !(await running(owned.descendantProcessId)),
      { timeout: 6000 },
    )
    .toBe(true);
  const reply = message(unrelated.child, "pong");
  unrelated.child.send("ping");
  expect(await reply).toEqual({ type: "pong" });
}, 15000);

it.skipIf(process.platform === "win32")(
  "a dead guardian fails the broker closed and removes its surviving roots",
  async () => {
    const unrelated = await fixture();
    const { root, broker, owned } = await independentBroker();
    const files = await readdir(
      path.join(root, ".airjam/devtools/process-scopes"),
    );
    const filename = files.find((name) => name.endsWith(".json"));
    if (!filename) throw new Error("Owned scope journal is missing.");
    const journal = processScopeJournalSchema.parse(
      JSON.parse(
        await readFile(
          path.join(root, ".airjam/devtools/process-scopes", filename),
          "utf8",
        ),
      ),
    );
    process.kill(journal.guardian.processId, "SIGKILL");
    await expect
      .poll(
        async () =>
          !(await running(owned.processId)) &&
          !(await running(owned.descendantProcessId)),
        { timeout: 6000 },
      )
      .toBe(true);
    const status = message(broker, "fault-status");
    broker.send("check-scope-owner");
    expect(await status).toMatchObject({
      error: expect.stringContaining("Guardian exited"),
    });
    const reply = message(unrelated.child, "pong");
    unrelated.child.send("ping");
    expect(await reply).toEqual({ type: "pong" });
  },
  15000,
);

it("Stop before root admission cannot load the helper or leave it alive", async () => {
  const root = await directory();
  const filename = path.join(root, "effect.mjs");
  const effect = path.join(root, "effect.json");
  await writeFile(
    filename,
    `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(effect)},'effect');setInterval(()=>{},1000);`,
  );
  const child = await spawnScopedProcess([filename], { cwd: root });
  child.stdout?.resume();
  child.stderr?.resume();
  await closeScopedProcess(child);
  await expect(readFile(effect)).rejects.toMatchObject({ code: "ENOENT" });
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
}, 15000);

it.skipIf(process.platform === "darwin")(
  "inherits ownership across an unregistered detached child on Linux and Windows",
  async () => {
    const first = await fixture(true);
    await closeScopedProcess(first.child);
    await expect
      .poll(() => running(first.metadata.descendantProcessId), {
        timeout: 4000,
      })
      .toBe(false);
  },
  15000,
);

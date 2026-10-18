import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  closeProcessScope,
  createProcessScope,
  processScopeMarker,
  registerProcessScope,
  type ProcessScope,
} from "../src/process-scope.js";

const scopes: ProcessScope[] = [];
afterEach(async () => {
  for (const scope of scopes.splice(0)) await closeProcessScope(scope);
});
async function fixture(
  program = 'console.log("ready");setInterval(()=>{},1000);',
) {
  const scope = createProcessScope();
  scopes.push(scope);
  const child = spawn(
    process.execPath,
    ["-e", program, "--", processScopeMarker(scope.token)],
    { detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const lines: string[] = [];
  let buffer = "";
  child.stdout?.on("data", (chunk) => {
    buffer += String(chunk);
    const pending = buffer.split("\n");
    buffer = pending.pop() ?? "";
    lines.push(...pending);
  });
  child.stderr?.on("data", () => {});
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Child startup timed out.")),
      3000,
    );
    child.once("spawn", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.once("error", reject);
  });
  return { scope, child, lines };
}
async function ready(lines: string[], expected = "ready") {
  await expect
    .poll(() => lines.includes(expected), { timeout: 3000 })
    .toBe(true);
}
function processId(child: ChildProcess) {
  if (!child.pid) throw new Error("Owned process ID unavailable.");
  return child.pid;
}

describe.skipIf(process.platform === "win32")(
  "POSIX process group backend",
  () => {
    it("stops a marked process group while another owned group keeps running", async () => {
      const first = await fixture();
      const other = await fixture();
      await ready(first.lines);
      await ready(other.lines);
      registerProcessScope(first.scope, processId(first.child));
      registerProcessScope(other.scope, processId(other.child));
      expect((await closeProcessScope(first.scope)).status).toBe("tree_clean");
      expect(() => process.kill(processId(other.child), 0)).not.toThrow();
    });
    it("escalates through a stubborn inherited descendant after the group leader exits", async () => {
      const first = await fixture(
        `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('descendant ready');setInterval(()=>{},1000);"],{stdio:'inherit'});console.log('ready');setInterval(()=>{},1000);`,
      );
      await ready(first.lines);
      await ready(first.lines, "descendant ready");
      registerProcessScope(first.scope, processId(first.child));
      const started = performance.now();
      const receipt = await closeProcessScope(first.scope);
      expect(receipt).toMatchObject({
        status: "tree_clean",
        survivors: [],
        errors: [],
      });
      expect(performance.now() - started).toBeGreaterThanOrEqual(1000);
    });
    it("sweeps a marked process that started before registration and survives its owner", async () => {
      const first = await fixture();
      await ready(first.lines);
      expect(first.scope.groups).toHaveLength(0);
      expect(await closeProcessScope(first.scope)).toMatchObject({
        status: "tree_clean",
        survivors: [],
      });
    });
    it("does not signal a recovered group whose process generation and marker differ", async () => {
      const other = await fixture();
      await ready(other.lines);
      registerProcessScope(other.scope, processId(other.child));
      const recovered = createProcessScope();
      const group = other.scope.groups[0];
      recovered.groups.push({
        groupId: group.groupId,
        anchor: { ...group.anchor, started: "another-generation" },
        members: [],
      });
      const receipt = await closeProcessScope(recovered);
      expect(receipt.status).toBe("tree_clean");
      expect(receipt.survivors).toEqual([]);
      expect(() => process.kill(processId(other.child), 0)).not.toThrow();
    });

    it("retires a journal from another boot or container namespace without signaling its reused IDs", async () => {
      const other = await fixture();
      await ready(other.lines);
      registerProcessScope(other.scope, processId(other.child));
      const recovered = structuredClone(other.scope);
      recovered.namespace = "another-container-boot";
      expect((await closeProcessScope(recovered)).status).toBe("tree_clean");
      expect(() => process.kill(processId(other.child), 0)).not.toThrow();
    });

    it("leaves an unverified leaderless group untouched and reports unconfirmed cleanup", async () => {
      const other = await fixture(
        `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"console.log('descendant ready');setInterval(()=>{},1000);"],{stdio:'inherit'});console.log('ready');setInterval(()=>{},1000);`,
      );
      await ready(other.lines, "descendant ready");
      registerProcessScope(other.scope, processId(other.child));
      const group = other.scope.groups[0];
      const recovered = createProcessScope();
      recovered.groups.push({
        groupId: group.groupId,
        anchor: { ...group.anchor, started: "unknown-old-generation" },
        members: [],
      });
      other.child.kill("SIGKILL");
      await expect.poll(() => other.child.signalCode).toBe("SIGKILL");
      const receipt = await closeProcessScope(recovered);
      expect(receipt.status).toBe("tree_unconfirmed");
      expect(receipt.survivors.length).toBeGreaterThan(0);
    });

    it("closes a separate marked descendant group after its direct owner is SIGKILLed", async () => {
      const owner = await fixture(
        `const {spawn}=require('node:child_process');const browser=spawn(process.execPath,['-e',"console.log('separate ready');setInterval(()=>{},1000);",'--',process.argv[1]],{detached:true,stdio:'inherit'});browser.once('spawn',()=>console.log(JSON.stringify({separateProcessId:browser.pid})));console.log('ready');setInterval(()=>{},1000);`,
      );
      const other = await fixture();
      await ready(owner.lines);
      await ready(owner.lines, "separate ready");
      await ready(other.lines);
      const metadataLine = owner.lines.find((line) => line.startsWith("{"));
      if (!metadataLine)
        throw new Error("Separate process did not register its identity.");
      const metadata = z
        .object({ separateProcessId: z.number().int().positive() })
        .parse(JSON.parse(metadataLine));
      registerProcessScope(owner.scope, processId(owner.child));
      registerProcessScope(owner.scope, metadata.separateProcessId);
      registerProcessScope(other.scope, processId(other.child));
      owner.child.kill("SIGKILL");
      expect(await closeProcessScope(owner.scope)).toMatchObject({
        status: "tree_clean",
        survivors: [],
      });
      expect(() => process.kill(processId(other.child), 0)).not.toThrow();
    });
  },
);

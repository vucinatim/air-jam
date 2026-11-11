import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { acquireWorkspaceBuildLock } from "../../ensure-workspace-package-build.mjs";

const fixture = (context, owner) => {
  let now = 0;
  context.mock.method(Date, "now", () => now);
  context.mock.method(globalThis, "setTimeout", (callback, milliseconds) => {
    now += milliseconds;
    queueMicrotask(callback);
  });
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-build-lock-"),
  );
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockDir = path.join(directory, "package.lock");
  if (owner) {
    fs.mkdirSync(lockDir);
    fs.writeFileSync(
      path.join(lockDir, `${randomUUID()}.json`),
      JSON.stringify(owner),
    );
  }
  return lockDir;
};

const readOwner = (lockDir) =>
  JSON.parse(
    fs.readFileSync(path.join(lockDir, fs.readdirSync(lockDir)[0]), "utf8"),
  );
const options = { timeoutMs: 500, pollIntervalMs: 1 };
const deadOwner = { pid: 12345, host: os.hostname() };
const mockDeadProcess = (context) =>
  context.mock.method(process, "kill", (pid, signal) => {
    assert.equal(pid, deadOwner.pid);
    assert.equal(signal, 0);
    throw Object.assign(new Error("No such process"), { code: "ESRCH" });
  });

test("dead local build owner is reclaimed before the first polling delay", async (context) => {
  const lockDir = fixture(context, deadOwner);
  mockDeadProcess(context);
  const log = context.mock.method(console, "error", () => {});
  await acquireWorkspaceBuildLock(lockDir, {
    timeoutMs: 500,
    pollIntervalMs: 1000,
  });
  assert.equal(Date.now(), 0);
  assert.deepEqual(readOwner(lockDir), {
    pid: process.pid,
    host: os.hostname(),
  });
  assert.equal(log.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[0], /Reclaimed.*dead process 12345/);
});

test("live build owner is logged once and retained until release", async (context) => {
  const lockDir = fixture(context);
  await acquireWorkspaceBuildLock(lockDir, options);
  const originalOwnerFile = fs.readdirSync(lockDir)[0];
  let probes = 0;
  context.mock.method(process, "kill", (pid, signal) => {
    assert.equal(pid, process.pid);
    assert.equal(signal, 0);
    assert.ok(fs.existsSync(path.join(lockDir, originalOwnerFile)));
    if (++probes === 2) fs.rmSync(lockDir, { recursive: true });
  });
  const log = context.mock.method(console, "error", () => {});
  await acquireWorkspaceBuildLock(lockDir, options);
  assert.equal(probes, 2);
  assert.equal(log.mock.callCount(), 1);
  assert.match(
    log.mock.calls[0].arguments[0],
    new RegExp(`Waiting.*process ${process.pid}`),
  );
  assert.notEqual(fs.readdirSync(lockDir)[0], originalOwnerFile);
});

test("two stale-lock waiters acquire one at a time", async (context) => {
  const lockDir = fixture(context, deadOwner);
  context.mock.method(process, "kill", (pid) => {
    if (pid === deadOwner.pid)
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    assert.equal(pid, process.pid);
  });
  const staleOwnerPath = path.join(lockDir, fs.readdirSync(lockDir)[0]);
  const bothReadStaleOwner = Promise.withResolvers();
  const winnerAcquired = Promise.withResolvers();
  const loserWaiting = Promise.withResolvers();
  const originalReadFile = filesystem.readFile;
  const originalUnlink = filesystem.unlink;
  let staleReads = 0;
  let staleUnlinks = 0;
  context.mock.method(filesystem, "readFile", async (...args) => {
    const contents = await originalReadFile(...args);
    if (args[0] === staleOwnerPath) {
      if (++staleReads === 2) bothReadStaleOwner.resolve();
      await bothReadStaleOwner.promise;
    }
    return contents;
  });
  context.mock.method(filesystem, "unlink", async (file) => {
    if (file === staleOwnerPath && ++staleUnlinks === 2)
      await winnerAcquired.promise;
    return originalUnlink(file);
  });
  syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const log = context.mock.method(console, "error", (line) => {
    if (line.startsWith("Waiting")) loserWaiting.resolve();
  });
  const acquired = [];
  const waiters = [0, 1].map(async (index) => {
    await acquireWorkspaceBuildLock(lockDir, options);
    acquired.push(index);
    winnerAcquired.resolve();
    return index;
  });
  await Promise.race(waiters);
  await loserWaiting.promise;
  assert.equal(staleReads, 2);
  assert.equal(staleUnlinks, 2);
  assert.equal(acquired.length, 1);
  assert.deepEqual(readOwner(lockDir), {
    pid: process.pid,
    host: os.hostname(),
  });
  fs.rmSync(lockDir, { recursive: true });
  await Promise.all(waiters);
  assert.equal(acquired.length, 2);
  assert.equal(
    log.mock.calls.filter(({ arguments: [line] }) =>
      line.startsWith("Reclaimed"),
    ).length,
    1,
  );
});

for (const [label, owner, code] of [
  ["foreign host", { pid: 12345, host: "another-host" }, null],
  ["unrecorded owner", null, null],
  ["permission-protected process", deadOwner, "EPERM"],
]) {
  test(`${label} keeps the bounded timeout`, async (context) => {
    const lockDir = fixture(context, owner);
    if (!owner) fs.mkdirSync(lockDir);
    const kill = context.mock.method(process, "kill", () => {
      throw Object.assign(new Error("Permission denied"), { code });
    });
    const log = context.mock.method(console, "error", () => {});
    const originalFiles = fs.readdirSync(lockDir);
    await assert.rejects(
      acquireWorkspaceBuildLock(lockDir, { timeoutMs: 15, pollIntervalMs: 1 }),
      /Timed out after 15ms/,
    );
    assert.deepEqual(fs.readdirSync(lockDir), originalFiles);
    assert.equal(log.mock.callCount(), 1);
    if (!code) assert.equal(kill.mock.callCount(), 0);
  });
}

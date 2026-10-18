import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { processGuardEnvironment } from "../../src/managed-process-scope.js";

if (process.platform !== "win32") throw new Error("Windows diagnostic only.");
const helper = fileURLToPath(
  new URL("../../src/tooling/process-scope-windows.ps1", import.meta.url),
).replaceAll("'", "''");
const command = `
$ErrorActionPreference = 'Stop'
$clock = [Diagnostics.Stopwatch]::StartNew()
[Console]::Error.WriteLine("module import starting at $($clock.ElapsedMilliseconds) ms")
Import-Module Microsoft.PowerShell.Utility
[Console]::Error.WriteLine("module imported at $($clock.ElapsedMilliseconds) ms")
$null = Get-Command Add-Type
[Console]::Error.WriteLine("compiler resolved at $($clock.ElapsedMilliseconds) ms")
& ([scriptblock]::Create([IO.File]::ReadAllText('${helper}')))
`;
for (const [variant, environment] of [
  ["guardian", processGuardEnvironment()],
  ["runner", process.env],
] as const) {
  const started = performance.now();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { env: environment, detached: true, windowsHide: true, stdio: "pipe" },
    );
    console.log(
      JSON.stringify({
        variant,
        processId: child.pid,
        environmentNames: Object.keys(environment).sort(),
      }),
    );
    let output = "";
    let errors = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-2048);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errors = (errors + chunk.toString()).slice(-4096);
      console.log(
        JSON.stringify({
          variant,
          elapsedMs: Math.round(performance.now() - started),
          phase: chunk.toString().trim(),
        }),
      );
    });
    child.stdin.end();
    const timer = setTimeout(() => {
      timedOut = true;
      const cleanup = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      cleanup.once("error", reject);
      cleanup.once("exit", (code) => {
        if (code !== 0) reject(new Error(`Diagnostic cleanup failed: ${code}`));
      });
    }, 60000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      console.log(
        JSON.stringify({
          variant,
          code,
          signal,
          timedOut,
          elapsedMs: Math.round(performance.now() - started),
          output,
          errors,
        }),
      );
      resolve();
    });
  });
}

import { processGuardEnvironment } from "../../src/managed-process-scope.js";
import { WindowsProcessScopes } from "../../src/windows-process-scopes.js";

if (process.platform !== "win32") throw new Error("Windows diagnostic only.");
const environment = processGuardEnvironment();
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, environment);

const measureCold = process.argv.includes("--measure-cold");
for (let index = 0; index < (measureCold ? 1 : 5); index += 1) {
  const started = performance.now();
  const guardian = await WindowsProcessScopes.open(
    measureCold ? 120000 : undefined,
  );
  try {
    console.log(
      JSON.stringify({
        attempt: index + 1,
        diagnosticOnly: measureCold,
        runnerState: index === 0 ? "first-probe" : "subsequent-process",
        environmentNames: Object.keys(environment).sort(),
        readyMs: Math.round(performance.now() - started),
      }),
    );
  } finally {
    await guardian.shutdown();
  }
}

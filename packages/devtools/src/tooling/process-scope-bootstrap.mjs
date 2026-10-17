import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const [entry, loader, ...argumentsList] = process.argv.slice(2);
process.once("disconnect", () => process.exit(1));
await new Promise((resolve, reject) => {
  process.once("message", (permission) => {
    if (permission === 1) resolve();
    else reject(new Error("Process scope admission was refused."));
  });
  process.send(0);
});
process.argv = [process.execPath, entry, ...argumentsList];
if (loader !== "javascript") {
  const loaderRequire = createRequire(loader);
  const [{ register: registerCommonJs }, { register: registerEsm }] =
    await Promise.all([
      import(pathToFileURL(loaderRequire.resolve("tsx/cjs/api")).href),
      import(pathToFileURL(loaderRequire.resolve("tsx/esm/api")).href),
    ]);
  registerCommonJs();
  registerEsm();
}
await import(pathToFileURL(entry).href);

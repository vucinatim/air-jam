import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "tooling/agent-contract": "../devtools-core/src/tooling/agent-contract.ts",
    "tooling/hold-runtime-host":
      "../devtools-core/src/tooling/hold-runtime-host.ts",
    "tooling/inspect-airjam-agent":
      "../devtools-core/src/tooling/inspect-airjam-agent.ts",
    "tooling/list-visual-scenarios":
      "../devtools-core/src/tooling/list-visual-scenarios.ts",
    "tooling/run-visual-capture":
      "../devtools-core/src/tooling/run-visual-capture.ts",
  },
  format: ["esm"],
  dts: false,
  clean: false,
  shims: true,
  sourcemap: true,
  platform: "node",
  target: "es2022",
  external: ["playwright-core"],
  noExternal: [
    "@air-jam/devtools-core",
    "@air-jam/harness",
    "@air-jam/sdk",
    "@air-jam/env",
  ],
});

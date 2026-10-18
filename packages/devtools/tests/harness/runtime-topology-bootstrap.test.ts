import {
  AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY,
  parseRuntimeTopologyFromSearchParams,
  readRuntimeTopologyFromWindow,
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import { runInNewContext } from "node:vm";
import type { BrowserContext } from "playwright-core";
import { expect, it, vi } from "vitest";
import { installHarnessRuntimeTopology } from "../../src/harness/visual/browser.js";
import { bindHarnessControllerUrl } from "../../src/harness/visual/session.js";

it("bootstraps production host and embedded controller topology only in the owned game origin", async () => {
  for (const role of ["host", "controller"] as const) {
    const topology = resolveRuntimeTopology({
      runtimeMode: "self-hosted-production",
      surfaceRole: role,
      appOrigin: "http://127.0.0.1:40237",
      backendOrigin: "http://127.0.0.1:40237",
      publicHost: "http://127.0.0.1:40237",
      embedded: role === "controller",
      ...(role === "controller"
        ? {
            embedParentOrigin: "http://airjam-controller-observation.localhost",
          }
        : {}),
    });
    const addInitScript = vi.fn();
    await installHarnessRuntimeTopology(
      { addInitScript } as unknown as BrowserContext,
      topology,
    );
    const [initialize, parameters] = addInitScript.mock.calls[0];
    for (const origin of [
      topology.appOrigin,
      "http://airjam-controller-observation.localhost",
      "http://unrelated.localhost",
    ]) {
      const window = { location: { origin } };
      runInNewContext(`(${initialize.toString()})(parameters)`, {
        window,
        parameters,
      });
      if (origin === topology.appOrigin) {
        expect(readRuntimeTopologyFromWindow(window)).toEqual(topology);
      } else
        expect(window).not.toHaveProperty(AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY);
    }
  }
});

it("binds a production join invitation to its actual relay while preserving the game route and player invitation", () => {
  const origin = "http://127.0.0.1:46127";
  const topology = resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "controller",
    appOrigin: origin,
    backendOrigin: origin,
    publicHost: origin,
  });
  const base = new URL("/controller", origin);
  for (const [key, value] of Object.entries(
    runtimeTopologyToQueryParams(topology),
  ))
    base.searchParams.set(key, value);
  const actual = new URL(
    bindHarnessControllerUrl(
      "https://previous.invalid/play/phone?room=ROOM&aj_controller_cap=private-player-invitation",
      base.toString(),
    ),
  );
  expect(actual.origin).toBe(origin);
  expect(actual.pathname).toBe("/play/phone");
  expect(actual.searchParams.get("room")).toBe("ROOM");
  expect(actual.searchParams.get("aj_controller_cap")).toBe(
    "private-player-invitation",
  );
  expect(parseRuntimeTopologyFromSearchParams(actual.searchParams)).toEqual(
    topology,
  );
});

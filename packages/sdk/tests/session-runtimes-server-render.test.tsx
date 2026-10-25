import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import {
  AirJamControllerRuntime,
  AirJamHostRuntime,
} from "../src/runtime/session-runtimes";

const topology = (surfaceRole: "host" | "controller") =>
  resolveRuntimeTopology({
    runtimeMode: "standalone-dev",
    surfaceRole,
    appOrigin: "http://localhost:3000",
    backendOrigin: "http://localhost:4000",
    publicHost: "http://localhost:3000",
    assetBasePath: "/",
    embedded: false,
    proxyStrategy: "none",
  });

describe("session runtimes on the server", () => {
  it("render nothing instead of reading browser globals", () => {
    expect(typeof window).toBe("undefined");
    expect(
      renderToString(
        <AirJamHostRuntime topology={topology("host")}>
          <p>host</p>
        </AirJamHostRuntime>,
      ),
    ).toBe("");
    expect(
      renderToString(
        <AirJamControllerRuntime topology={topology("controller")}>
          <p>controller</p>
        </AirJamControllerRuntime>,
      ),
    ).toBe("");
  });
});

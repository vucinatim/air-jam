import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as sdk from "../src/index";

describe("sdk export surface", () => {
  it("does not expose unscoped lifecycle primitives on root export", () => {
    expect("AirJamProvider" in sdk).toBe(false);
    expect("useAirJamContext" in sdk).toBe(false);
    expect("useAirJamConfig" in sdk).toBe(false);
    expect("useAirJamState" in sdk).toBe(false);
    expect("useAirJamSocket" in sdk).toBe(false);
    expect("SocketManager" in sdk).toBe(false);
  });

  it("keeps package subpath exports limited to public entrypoints", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as {
      exports?: Record<string, unknown>;
    };

    const exportKeys = Object.keys(packageJson.exports ?? {});
    expect(exportKeys).toEqual(
      expect.arrayContaining([
        ".",
        "./ui",
        "./protocol",
        "./contracts/v2",
        "./styles.css",
      ]),
    );
    expect(packageJson.exports?.["./context"]).toBeUndefined();
    expect(packageJson.exports?.["./context/socket-manager"]).toBeUndefined();
  });
});

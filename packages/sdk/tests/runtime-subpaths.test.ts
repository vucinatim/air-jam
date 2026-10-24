import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AirJamControllerRuntime,
  AirJamHostRuntime,
} from "../src/arcade/runtime";
import { createPrefabCatalog, definePrefab } from "../src/prefabs";
import { readRuntimeInspectionContract } from "../src/runtime-inspection";

describe("runtime experimental subpaths", () => {
  it("reads the inspection contract from the dedicated leaf", () => {
    expect(readRuntimeInspectionContract({})).toBeNull();
  });

  it("re-exports the prefab contract seam from the dedicated leaf", () => {
    const catalog = createPrefabCatalog([
      definePrefab({
        id: "test.prefab.default",
        label: "Test Prefab",
        category: "prop",
        description: "A prefab leaf contract.",
        tags: ["test"],
        defaultProps: { size: 1 },
        configSchema: z.object({ size: z.number().positive() }),
        render: ({ size }) => size,
      }),
    ] as const);

    expect(catalog[0]?.id).toBe("test.prefab.default");
  });

  it("keeps raw runtimes on the platform composition leaf", () => {
    expect(typeof AirJamHostRuntime).toBe("function");
    expect(typeof AirJamControllerRuntime).toBe("function");
  });
});

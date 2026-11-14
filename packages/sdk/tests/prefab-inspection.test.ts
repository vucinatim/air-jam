import { expect, it } from "vitest";
import { z } from "zod";
import {
  createPrefabCatalog,
  definePrefab,
  prefabMetadata,
} from "../src/prefabs/types";
import {
  DEFAULT_PREFAB_VIEW,
  resolvePrefab2DTransform,
  resolvePrefabOrbitCamera,
} from "../src/prefabs/view";
import { prefabInspectionRequestSchema } from "../src/runtime/prefab-inspection-bridge";
import { advancePrefabClock } from "../src/runtime/prefab-inspection-clock";

it("reports one static state, rejects duplicate identities and malformed capture views", () => {
  const prefab = definePrefab({
    id: "dot",
    label: "Dot",
    space: "2d",
    category: "actor",
    description: "",
    tags: [],
    defaultProps: {},
    configSchema: z.object({}),
  });
  expect(prefabMetadata(prefab).defaultState).toBe("static");
  expect(() => createPrefabCatalog([prefab, prefab])).toThrow();
  const view = { stateId: "static", time: 0, view: DEFAULT_PREFAB_VIEW };
  const capture = {
    type: "AIRJAM_PREFAB_CAPTURE",
    requestId: "capture",
    views: [view],
  };
  expect(prefabInspectionRequestSchema.safeParse(capture).success).toBe(true);
  expect(
    prefabInspectionRequestSchema.safeParse({
      ...capture,
      views: Array(9).fill(view),
    }).success,
  ).toBe(false);
  expect(
    prefabInspectionRequestSchema.safeParse({
      ...capture,
      views: [{ ...view, time: -1 }],
    }).success,
  ).toBe(false);
});

it("wraps a looping clock and stops a finite or static state", () => {
  expect(
    advancePrefabClock(0.9, 0.3, {
      id: "run",
      label: "Run",
      seconds: 1,
      loop: true,
    }),
  ).toEqual({ time: expect.closeTo(0.2), playing: true });
  expect(
    advancePrefabClock(0.9, 0.3, { id: "hit", label: "Hit", seconds: 1 }),
  ).toEqual({ time: 1, playing: false });
  expect(advancePrefabClock(0.9, 0.3, { id: "idle", label: "Idle" })).toEqual({
    time: 0,
    playing: false,
  });
});

it("preserves the default camera and pans in fractions of view height", () => {
  const camera = {
    position: [4, 3, 4] as const,
    target: [0, 0, 0] as const,
    fov: 45,
  };
  const resolved = resolvePrefabOrbitCamera(camera, DEFAULT_PREFAB_VIEW);
  resolved.position.forEach((value, index) =>
    expect(value).toBeCloseTo(camera.position[index]!),
  );
  expect(resolved.target).toEqual([0, 0, 0]);
  expect(
    resolvePrefab2DTransform(
      { ...DEFAULT_PREFAB_VIEW, zoom: 2, pan: [0.5, -0.25] },
      200,
    ),
  ).toEqual({ scale: 2, translate: [100, 50] });
});

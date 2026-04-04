import { z } from "zod";
import { ARENA_RADIUS } from "../../constants";

const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const airCaptureArenaPrefabSchema = z.object({
  arenaRadius: z.number().positive(),
  groundColor: z.string(),
  fogDensity: z.number().nonnegative(),
  ambientLightIntensity: z.number().nonnegative(),
  directionalLightIntensity: z.number().nonnegative(),
  directionalLightPosition: vector3Schema,
  gridColorMajor: z.string(),
  gridColorMinor: z.string(),
  forcefieldColor: z.string(),
});

export type AirCaptureArenaPrefabProps = z.infer<
  typeof airCaptureArenaPrefabSchema
>;

export type AirCaptureArenaPrefabOverrides = Partial<AirCaptureArenaPrefabProps>;

export const AIR_CAPTURE_ARENA_DEFAULT_PROPS: AirCaptureArenaPrefabProps =
  airCaptureArenaPrefabSchema.parse({
    arenaRadius: ARENA_RADIUS,
    groundColor: "#222222",
    fogDensity: 0.0005,
    ambientLightIntensity: 0.4,
    directionalLightIntensity: 2,
    directionalLightPosition: {
      x: 60,
      y: 100,
      z: 60,
    },
    gridColorMajor: "#555555",
    gridColorMinor: "#333333",
    forcefieldColor: "#00e5ff",
  });

export const resolveAirCaptureArenaProps = (
  overrides: AirCaptureArenaPrefabOverrides = {},
): AirCaptureArenaPrefabProps =>
  airCaptureArenaPrefabSchema.parse({
    ...AIR_CAPTURE_ARENA_DEFAULT_PROPS,
    ...overrides,
    directionalLightPosition: {
      ...AIR_CAPTURE_ARENA_DEFAULT_PROPS.directionalLightPosition,
      ...overrides.directionalLightPosition,
    },
  });

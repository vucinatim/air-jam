import { paintAirCaptureArena } from "./paint-arena";
import type { AirCaptureArenaPrefabOverrides } from "./schema";

export const AirCaptureArena = ({
  overrides,
}: {
  overrides?: AirCaptureArenaPrefabOverrides;
}) => {
  return paintAirCaptureArena(overrides);
};

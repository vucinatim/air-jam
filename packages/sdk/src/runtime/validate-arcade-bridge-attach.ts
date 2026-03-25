import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";

/**
 * Validates an embedded bridge attach against monotonic Arcade surface epochs.
 * When `identity` is absent (legacy attach), the gate is unchanged.
 */
export const validateArcadeBridgeAttachEpoch = (
  lastEpoch: number | null,
  identity: ArcadeSurfaceRuntimeIdentity | undefined,
):
  | { ok: true; nextLast: number | null }
  | { ok: false } => {
  if (!identity) {
    return { ok: true, nextLast: lastEpoch };
  }
  if (lastEpoch !== null && identity.epoch < lastEpoch) {
    return { ok: false };
  }
  return { ok: true, nextLast: identity.epoch };
};

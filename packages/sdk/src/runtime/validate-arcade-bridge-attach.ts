import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";

/**
 * Validates an embedded bridge attach against monotonic Arcade surface epochs.
 */
export const validateArcadeBridgeAttachEpoch = (
  lastEpoch: number | null,
  identity: ArcadeSurfaceRuntimeIdentity,
):
  | { ok: true; nextLast: number | null }
  | { ok: false } => {
  if (lastEpoch !== null && identity.epoch < lastEpoch) {
    return { ok: false };
  }
  return { ok: true, nextLast: identity.epoch };
};

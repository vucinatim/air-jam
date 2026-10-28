import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";

/** An embedded runtime's parent frame and the origin its topology declares, or null when not embedded. */
export function embeddedRuntimeParent(
  topology: Pick<
    ResolvedAirJamRuntimeTopology,
    "embedded" | "embedParentOrigin"
  >,
) {
  if (
    typeof window === "undefined" ||
    window.parent === window ||
    !topology.embedded
  )
    return null;
  if (!topology.embedParentOrigin)
    throw new Error("An embedded runtime requires its declared parent origin.");
  return {
    window: window.parent,
    origin: new URL(topology.embedParentOrigin).origin,
  };
}

import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";

export function embeddedRuntimeParent(topology: ResolvedAirJamRuntimeTopology) {
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

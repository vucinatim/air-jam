import { init as initRapier } from "@dimforge/rapier3d-compat";

let rapierInitPromise: Promise<void> | null = null;

/**
 * Pre-initialize Rapier with the new object-style init signature before
 * `@react-three/rapier` mounts. This avoids the dependency's deprecated
 * no-arg fallback warning in development without patching node_modules.
 */
export const preloadRapier = (): Promise<void> => {
  if (!rapierInitPromise) {
    rapierInitPromise = initRapier();
  }

  return rapierInitPromise;
};

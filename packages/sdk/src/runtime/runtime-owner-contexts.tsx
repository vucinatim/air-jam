import { createContext } from "react";
import type { AttachableStore } from "../core/replicated-store";

/** Undefined outside a game runtime; null for games without a fixed orientation. */
export const fixedControllerOrientationContext = createContext<
  "landscape" | null | undefined
>(undefined);

export const hostRuntimeContext = createContext<unknown>(null);
export const controllerRuntimeContext = createContext<unknown>(null);
/** The replicated stores the surrounding runtime attaches. */
export const declaredStoresContext =
  createContext<ReadonlySet<AttachableStore> | null>(null);

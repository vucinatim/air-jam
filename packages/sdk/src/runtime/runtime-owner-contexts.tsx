import { createContext } from "react";
import type { AttachableStore } from "../core/replicated-store";

export const hostRuntimeContext = createContext<unknown>(null);
export const controllerRuntimeContext = createContext<unknown>(null);
/** The replicated stores the surrounding runtime attaches. */
export const declaredStoresContext =
  createContext<ReadonlySet<AttachableStore> | null>(null);

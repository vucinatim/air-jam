import { createContext, useContext } from "react";
import type { PrefabDeclarationCatalog, PrefabState } from "../prefabs/types";
import type { PrefabSelection } from "./prefab-inspection-bridge";

export type PrefabInspection = Omit<PrefabSelection, "prefabId" | "stateId"> & {
  prefab: PrefabDeclarationCatalog[number];
  props: unknown;
  state: PrefabState;
};
export const prefabInspectionContext = createContext<PrefabInspection | null>(
  null,
);
export function usePrefabInspection(): PrefabInspection {
  const value = useContext(prefabInspectionContext);
  if (!value)
    throw new Error(
      "usePrefabInspection requires the host's prefabStage in an inspection document.",
    );
  return value;
}

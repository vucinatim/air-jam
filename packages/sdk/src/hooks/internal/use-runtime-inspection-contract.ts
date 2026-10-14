import { useStore } from "zustand";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  createControllerRuntimeInspectionContract,
  createHostRuntimeInspectionContract,
  type ControllerRuntimeInspectionContract,
  type HostRuntimeInspectionContract,
} from "../../runtime/contracts/inspection";
import { useAirJamController } from "../use-air-jam-controller";
import { useAirJamHost } from "../use-air-jam-host";

export const useHostRuntimeInspectionContract =
  (): HostRuntimeInspectionContract => {
    const api = useAirJamHost();
    const { store } = useAirJamContext();
    const controllerOrientation = useStore(
      store,
      (state) => state.controllerOrientation,
    );
    return createHostRuntimeInspectionContract({
      ...api,
      controllerOrientation,
    });
  };

export const useControllerRuntimeInspectionContract =
  (): ControllerRuntimeInspectionContract =>
    createControllerRuntimeInspectionContract(useAirJamController());

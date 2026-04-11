import { useAirJamController } from "../use-air-jam-controller";
import { useAirJamHost } from "../use-air-jam-host";
import {
  createControllerRuntimeInspectionContract,
  createHostRuntimeInspectionContract,
  type ControllerRuntimeInspectionContract,
  type HostRuntimeInspectionContract,
} from "../../runtime/contracts/inspection";

export const useHostRuntimeInspectionContract = (): HostRuntimeInspectionContract =>
  createHostRuntimeInspectionContract(useAirJamHost());

export const useControllerRuntimeInspectionContract = (): ControllerRuntimeInspectionContract =>
  createControllerRuntimeInspectionContract(useAirJamController());

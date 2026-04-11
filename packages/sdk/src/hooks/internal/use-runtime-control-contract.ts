import { useAirJamController } from "../use-air-jam-controller";
import { useAirJamHost } from "../use-air-jam-host";
import {
  createControllerRuntimeControlContract,
  createHostRuntimeControlContract,
  type ControllerRuntimeControlContract,
  type HostRuntimeControlContract,
} from "../../runtime/contracts/control";

export const useHostRuntimeControlContract = (): HostRuntimeControlContract =>
  createHostRuntimeControlContract(useAirJamHost());

export const useControllerRuntimeControlContract = (): ControllerRuntimeControlContract =>
  createControllerRuntimeControlContract(useAirJamController());

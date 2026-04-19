import { useCallback } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import { emitAirJamDiagnostic } from "../diagnostics";
import {
  controllerInputSchema,
  type ControllerInputPayload,
} from "../protocol";
import { getControllerRealtimeClient } from "../runtime/controller-realtime-client";
import { isRpcSerializable } from "../utils/is-rpc-serializable";

export const useInputWriter = (): ((
  input: ControllerInputPayload,
) => boolean) => {
  useAssertSessionScope("controller", "useInputWriter");

  const { store, getSocket } = useAirJamContext();

  return useCallback(
    (input: ControllerInputPayload): boolean => {
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        emitAirJamDiagnostic({
          code: "AJ_INPUT_WRITER_INVALID_SHAPE",
          severity: "warn",
          message: "Input writer payload must be a plain object.",
        });
        return false;
      }
      if (!isRpcSerializable(input)) {
        emitAirJamDiagnostic({
          code: "AJ_INPUT_WRITER_NOT_SERIALIZABLE",
          severity: "warn",
          message: "Input writer payload must be RPC-serializable.",
        });
        return false;
      }

      const state = store.getState();
      if (!state.roomId || !state.controllerId) {
        emitAirJamDiagnostic({
          code: "AJ_INPUT_WRITER_SESSION_NOT_READY",
          severity: "warn",
          message:
            "Input writer blocked: room/controller session is not ready.",
        });
        return false;
      }

      const socket = getControllerRealtimeClient((role) => getSocket(role));
      if (!socket.connected) {
        emitAirJamDiagnostic({
          code: "AJ_INPUT_WRITER_SOCKET_DISCONNECTED",
          severity: "warn",
          message: "Input writer blocked: controller socket is disconnected.",
        });
        return false;
      }

      const payload = controllerInputSchema.safeParse({
        roomId: state.roomId,
        controllerId: state.controllerId,
        input,
      });

      if (!payload.success) {
        emitAirJamDiagnostic({
          code: "AJ_INPUT_WRITER_SCHEMA_INVALID",
          severity: "warn",
          message:
            "Input writer payload failed controller input schema validation.",
          details: {
            issueCount: payload.error.issues.length,
          },
        });
        return false;
      }

      socket.emit("controller:input", payload.data);
      return true;
    },
    [getSocket, store],
  );
};

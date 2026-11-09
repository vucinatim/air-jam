import type { ControllerRuntime } from "../core/controller-runtime";
import { readPreviewControllerParent } from "../preview/identity";
import {
  CONTROLLER_CAPTURE_TIMEOUT_MS,
  controllerAgentRequestMessageSchema,
  controllerAgentResultMessageSchema,
  type ControllerCapture,
} from "./contracts/controller-agent";

export function requestControllerAgent(
  target: Window,
  origin: string,
  requestId: string,
  request: { operation: "capture"; roomId: string; controllerId: string },
) {
  target.postMessage(
    controllerAgentRequestMessageSchema.parse({
      type: "AIRJAM_CONTROLLER_AGENT",
      requestId,
      request,
    }),
    origin,
  );
}
export function readControllerAgentResult(
  event: MessageEvent<unknown>,
  target: Window,
  origin: string,
) {
  if (event.source !== target || event.origin !== origin) return null;
  const parsed = controllerAgentResultMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : null;
}

/** Only the configured preview parent can capture this controller's own document. */
export function publishEmbeddedControllerAgent(runtime: ControllerRuntime) {
  const parent = readPreviewControllerParent();
  if (!parent) return () => {};
  let closed = false;
  let busy = false;
  const listener = (event: MessageEvent<unknown>) => {
    if (event.source !== parent.window || event.origin !== parent.origin)
      return;
    const parsed = controllerAgentRequestMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const { requestId, request } = parsed.data;
    const state = runtime.store.getState();
    if (
      state.roomId !== request.roomId ||
      state.controllerId !== request.controllerId
    )
      return;
    if (busy) {
      parent.window.postMessage(
        {
          type: "AIRJAM_CONTROLLER_AGENT_RESULT",
          requestId,
          roomId: request.roomId,
          controllerId: request.controllerId,
          capture: { status: "unavailable", reason: "timeout" },
        },
        parent.origin,
      );
      return;
    }
    busy = true;
    const work: Promise<ControllerCapture> = import("./controller-capture")
      .then((module) => module.captureControllerDocument())
      .catch(
        (): ControllerCapture => ({
          status: "unavailable",
          reason: "unsupported",
        }),
      )
      .finally(() => {
        busy = false;
      });
    void (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const capture = await Promise.race<ControllerCapture>([
          work,
          new Promise((resolve) => {
            timer = setTimeout(
              () =>
                resolve({
                  status: "unavailable",
                  reason: "timeout",
                  detail:
                    "The controller page capture did not finish within 10 seconds.",
                }),
              CONTROLLER_CAPTURE_TIMEOUT_MS,
            );
          }),
        ]);
        const current = runtime.store.getState();
        if (
          !closed &&
          current.roomId === request.roomId &&
          current.controllerId === request.controllerId
        )
          parent.window.postMessage(
            controllerAgentResultMessageSchema.parse({
              type: "AIRJAM_CONTROLLER_AGENT_RESULT",
              requestId,
              roomId: request.roomId,
              controllerId: request.controllerId,
              capture,
            }),
            parent.origin,
          );
      } finally {
        clearTimeout(timer);
      }
    })();
  };
  window.addEventListener("message", listener);
  return () => {
    closed = true;
    window.removeEventListener("message", listener);
  };
}

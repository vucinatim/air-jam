import {
  createControllerBridgeAttachMessage,
  createControllerBridgeEventMessage,
  type ControllerBridgeServerEventName,
  type ControllerBridgeSnapshot,
} from "@air-jam/sdk/controller-bridge";
import type { HostStateSyncPayload } from "@air-jam/sdk/protocol";
import { AIR_JAM_RUNTIME_INSPECTION_KEY } from "@air-jam/sdk/runtime-inspection";
import {
  parseRuntimeTopologyFromSearchParams,
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import type { Browser } from "playwright-core";
import { installHarnessRuntimeTopology } from "./browser.js";
import { DEFAULT_CONTROLLER_VIEWPORT } from "./session.js";

export async function openControllerObservation({
  browser,
  controllerJoinUrl,
  snapshot,
  stores,
  onMessage,
  signal,
}: {
  browser: Browser;
  controllerJoinUrl: string;
  snapshot: ControllerBridgeSnapshot & { harnessSessionId: string };
  stores: HostStateSyncPayload[];
  onMessage: (message: unknown) => void;
  signal?: AbortSignal;
}) {
  const context = await browser.newContext({
    viewport: DEFAULT_CONTROLLER_VIEWPORT,
  });
  let closing: Promise<void> | undefined;
  const close = () => {
    signal?.removeEventListener("abort", aborted);
    return (closing ??= context.close());
  };
  const aborted = () => {
    // The lifecycle awaits this same close promise, including its failure.
    void close().catch(() => undefined);
  };
  signal?.addEventListener("abort", aborted, { once: true });
  try {
    signal?.throwIfAborted();
    const controllerUrl = new URL(controllerJoinUrl);
    const parentUrl = new URL(
      `/__airjam/controller-observation/${snapshot.harnessSessionId}`,
      "http://airjam-controller-observation.localhost",
    );
    // Fulfilled documents have no network address space. Give only this
    // trusted capture shell permission to load the local game controller.
    await context.grantPermissions(["local-network-access"], {
      origin: parentUrl.origin,
    });
    const topology = parseRuntimeTopologyFromSearchParams(
      controllerUrl.searchParams,
    );
    if (!topology)
      throw new Error(
        "Controller observation requires complete runtime topology.",
      );
    const observationTopology = resolveRuntimeTopology({
      ...topology,
      embedded: true,
      embedParentOrigin: parentUrl.origin,
    });
    await installHarnessRuntimeTopology(context, observationTopology);
    for (const [name, value] of Object.entries(
      runtimeTopologyToQueryParams(observationTopology),
    ))
      controllerUrl.searchParams.set(name, value);
    controllerUrl.searchParams.set("aj_room", snapshot.roomId);
    controllerUrl.searchParams.set("aj_controller_id", snapshot.controllerId);
    controllerUrl.searchParams.set(
      "aj_harness_session",
      snapshot.harnessSessionId,
    );
    controllerUrl.searchParams.delete("aj_controller_cap");
    const page = await context.newPage();
    await page.route(parentUrl.href, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><head><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block;overflow:hidden}</style></head><body></body></html>",
      }),
    );
    await page.exposeBinding(
      "airJamObservationMessage",
      (_, message: unknown) => onMessage(message),
    );
    await page.goto(parentUrl.href, { waitUntil: "domcontentloaded" });
    const initialEvents = stores.map((store) =>
      createControllerBridgeEventMessage("airjam:state_sync", store),
    );
    await page.evaluate(
      ({ controllerUrl, attach, initialEvents }) => {
        const frame = document.createElement("iframe");
        let port: MessagePort | null = null;
        const pending = [...initialEvents];
        Object.assign(window, {
          airJamObservationDeliver: (message: unknown) => {
            if (port) port.postMessage(message);
            else pending.push(message as (typeof initialEvents)[number]);
          },
        });
        window.addEventListener("message", (event: MessageEvent<unknown>) => {
          if (
            event.source !== frame.contentWindow ||
            event.origin !== new URL(controllerUrl).origin
          )
            return;
          const request = event.data as {
            type?: string;
            payload?: {
              roomId?: string;
              controllerId?: string;
              harnessSessionId?: string;
            };
          };
          if (
            request.type !== "AIRJAM_CONTROLLER_BRIDGE_REQUEST" ||
            !event.ports[0] ||
            request.payload?.roomId !== attach.payload.snapshot.roomId ||
            request.payload?.controllerId !==
              attach.payload.snapshot.controllerId ||
            request.payload?.harnessSessionId !==
              attach.payload.snapshot.harnessSessionId
          )
            return;
          port?.close();
          port = event.ports[0];
          port.onmessage = (message: MessageEvent<unknown>) => {
            const binding = Reflect.get(window, "airJamObservationMessage") as (
              value: unknown,
            ) => Promise<void>;
            void binding(message.data);
          };
          port.start();
          port.postMessage(attach);
          for (const message of pending.splice(0)) port.postMessage(message);
        });
        frame.src = controllerUrl;
        frame.title = "Acting controller observation";
        document.body.append(frame);
      },
      {
        controllerUrl: controllerUrl.href,
        attach: createControllerBridgeAttachMessage(snapshot),
        initialEvents,
      },
    );
    const frameElement = await page.locator("iframe").elementHandle();
    if (!frameElement)
      throw new Error("Controller observation frame is missing.");
    const controllerFrame = await frameElement.contentFrame();
    if (!controllerFrame)
      throw new Error("Controller observation document is unavailable.");
    await controllerFrame.waitForFunction(
      ({ key, roomId, controllerId }) => {
        const inspection = Reflect.get(window, key) as
          | {
              roomId?: string;
              controllerId?: string;
              connectionStatus?: string;
            }
          | undefined;
        return (
          inspection?.roomId === roomId &&
          inspection.controllerId === controllerId &&
          inspection.connectionStatus === "connected"
        );
      },
      {
        key: AIR_JAM_RUNTIME_INSPECTION_KEY,
        roomId: snapshot.roomId,
        controllerId: snapshot.controllerId,
      },
    );
    // Inspection updates in an effect; allow its rendered controller state to reach the compositor.
    await controllerFrame.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    signal?.throwIfAborted();
    return {
      page,
      async deliver(event: ControllerBridgeServerEventName, args: unknown[]) {
        await page.evaluate(
          (message) => {
            const deliver = Reflect.get(window, "airJamObservationDeliver") as (
              value: unknown,
            ) => void;
            deliver(message);
          },
          { type: "AIRJAM_CONTROLLER_BRIDGE_EVENT", payload: { event, args } },
        );
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

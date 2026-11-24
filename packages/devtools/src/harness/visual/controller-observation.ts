import { AIR_JAM_RUNTIME_INSPECTION_KEY } from "@air-jam/sdk/runtime-inspection";
import {
  parseRuntimeTopologyFromSearchParams,
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import type { Browser } from "playwright-core";
import { installHarnessRuntimeTopology } from "./browser.js";
import { DEFAULT_CONTROLLER_VIEWPORT } from "./session.js";

/**
 * Shows the acting phone's controller in a browser page for capture. The
 * page frames the game's controller as an embedded harness controller and
 * relays the room port it asks for to `onPortMessage`; the room's answers
 * come back through `deliver`. Whoever holds the acting phone serves that
 * port, read-only, as a view of its session.
 */
export async function openControllerObservation({
  browser,
  controllerJoinUrl,
  harnessSessionId,
  roomId,
  onPortMessage,
  signal,
}: {
  browser: Browser;
  controllerJoinUrl: string;
  harnessSessionId: string;
  roomId: string;
  onPortMessage: (message: unknown) => void;
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
      `/__airjam/controller-observation/${harnessSessionId}`,
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
    controllerUrl.searchParams.set("aj_room", roomId);
    controllerUrl.searchParams.set("aj_harness_session", harnessSessionId);
    const page = await context.newPage();
    await page.route(parentUrl.href, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><head><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block;overflow:hidden}</style></head><body></body></html>",
      }),
    );
    await page.exposeBinding(
      "airJamObservationMessage",
      (_, message: unknown) => onPortMessage(message),
    );
    await page.goto(parentUrl.href, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ controllerUrl, harnessSessionId }) => {
        const frame = document.createElement("iframe");
        let port: MessagePort | null = null;
        const pending: unknown[] = [];
        Object.assign(window, {
          airJamObservationDeliver: (message: unknown) => {
            if (port) port.postMessage(message);
            else pending.push(message);
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
            payload?: { role?: string; harnessSessionId?: string };
          };
          if (
            request.type !== "AIRJAM_ROOM_BRIDGE_REQUEST" ||
            !event.ports[0] ||
            request.payload?.role !== "controller" ||
            request.payload.harnessSessionId !== harnessSessionId
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
          for (const message of pending.splice(0)) port.postMessage(message);
        });
        frame.src = controllerUrl;
        frame.title = "Acting controller observation";
        document.body.append(frame);
      },
      { controllerUrl: controllerUrl.href, harnessSessionId },
    );
    const frameElement = await page.locator("iframe").elementHandle();
    if (!frameElement)
      throw new Error("Controller observation frame is missing.");
    const controllerFrame = await frameElement.contentFrame();
    if (!controllerFrame)
      throw new Error("Controller observation document is unavailable.");
    await controllerFrame.waitForFunction(
      ({ key, roomId }) => {
        const inspection = Reflect.get(window, key) as
          | { roomId?: string; connectionStatus?: string }
          | undefined;
        return (
          inspection?.roomId === roomId &&
          inspection.connectionStatus === "connected"
        );
      },
      { key: AIR_JAM_RUNTIME_INSPECTION_KEY, roomId },
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
      async deliver(message: unknown) {
        await page.evaluate((message) => {
          const deliver = Reflect.get(window, "airJamObservationDeliver") as (
            value: unknown,
          ) => void;
          deliver(message);
        }, message);
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

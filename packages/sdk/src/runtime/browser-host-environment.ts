import { z } from "zod";
import type { AirJamConfig } from "../core/config";
import type { AirJamHostEnvironment } from "../core/environment";
import { updateDevBrowserLogContext } from "../dev/browser-log-sink";
import type { RoomCode } from "../protocol";
import { roomCodeSchema } from "../room-protocol";
import { browserDeviceWakeEvents } from "../room-session/browser-wake-events";
import { HostRoomSession } from "../room-session/host-room-session";
import { createRoomKey } from "../room-session/room-key";
import {
  runtimeTopologyToQueryParams,
  type ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";
import { detectRunMode } from "../utils/mode";
import { urlBuilder } from "../utils/url-builder";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "./arcade-runtime-url";
import {
  browserRoomConnector,
  devLogRuntimeErrorReporter,
} from "./browser-room";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import { readEmbeddedHostChildSession } from "./embedded-runtime-adapters";

const HOST_RESUME_STORAGE_KEY = "airjam_host_room";

const hostResumeSchema = z.object({
  key: z.string().min(16),
  code: roomCodeSchema,
  instance: z.string().min(1),
});

const hostGrantResponseSchema = z.object({ hostGrant: z.string().min(1) });

const readRequestedRoomId = (): RoomCode | null => {
  const room = new URLSearchParams(window.location.search).get("room");
  if (!room) return null;
  const parsed = roomCodeSchema.safeParse(room.toUpperCase());
  return parsed.success ? parsed.data : null;
};

/** The host environment of a browser page: its URL, session storage and frames. */
export const createBrowserHostEnvironment = (
  config: AirJamConfig,
): AirJamHostEnvironment => {
  const embedded = readEmbeddedHostChildSession();
  const connector = browserRoomConnector({
    topology: config.topology,
    role: "host",
    embedding: embedded ? { arcadeSurface: embedded.arcadeSurface } : null,
  });
  return {
    embedded: embedded
      ? {
          joinUrl: embedded.joinUrl,
          localControllerUrl: embedded.localControllerUrl,
        }
      : null,
    requestedRoomId: readRequestedRoomId(),
    runMode: detectRunMode(),
    defaultStoreDomain: resolveImplicitReplicatedStoreDomainFromWindow(),
    presentationChannel: config.presentationChannel,
    controlTarget: window,
    openRoom: (roomOptions) =>
      new HostRoomSession({
        ...roomOptions,
        connector,
        deviceWakeEvents: browserDeviceWakeEvents,
      }),
    createKey: createRoomKey,
    // An embedded host's place belongs to the page that embeds it.
    readResume: () => {
      if (embedded) return null;
      try {
        const parsed = hostResumeSchema.safeParse(
          JSON.parse(sessionStorage.getItem(HOST_RESUME_STORAGE_KEY) ?? "null"),
        );
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    writeResume: (resume) => {
      if (embedded) return;
      try {
        if (resume)
          sessionStorage.setItem(
            HOST_RESUME_STORAGE_KEY,
            JSON.stringify(resume),
          );
        else sessionStorage.removeItem(HOST_RESUME_STORAGE_KEY);
      } catch {
        // Without storage a reload opens a new room.
      }
    },
    requestHostGrant: async (endpoint, appId) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(appId ? { appId } : {}),
      });
      if (!response.ok)
        throw new Error(`Failed to fetch host grant (${response.status})`);
      const parsed = hostGrantResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid host grant response");
      return parsed.data.hostGrant;
    },
    controllerUrls: async (roomId, topology) => {
      const buildUrl = async (
        host: string,
        controllerTopology: ResolvedAirJamRuntimeTopology,
      ) => {
        const url = new URL(
          await urlBuilder.buildControllerUrl(roomId, { host }),
        );
        if (
          topology.runtimeMode === "standalone-dev" ||
          topology.runtimeMode === "standalone-secure"
        ) {
          for (const [key, value] of Object.entries(
            runtimeTopologyToQueryParams({
              ...controllerTopology,
              surfaceRole: "controller",
              embedded: false,
              embedParentOrigin: undefined,
            }),
          ))
            url.searchParams.set(key, value);
        }
        return url.toString();
      };
      const [localControllerUrl, joinUrl] = await Promise.all([
        buildUrl(topology.appOrigin, { ...topology, publicHost: undefined }),
        topology.publicHost
          ? buildUrl(topology.publicHost, topology)
          : Promise.resolve(""),
      ]);
      return { localControllerUrl, joinUrl };
    },
    reportError: config.reportError ?? devLogRuntimeErrorReporter,
    emitDevEvent: emitAirJamDevRuntimeEvent,
    setDevLogContext: updateDevBrowserLogContext,
    seed: () => crypto.getRandomValues(new Uint32Array(1))[0],
    now: () => performance.now(),
    frames: (onFrame) => {
      let stopped = false;
      let frame = requestAnimationFrame(function next(now) {
        onFrame(now);
        if (!stopped) frame = requestAnimationFrame(next);
      });
      return () => {
        stopped = true;
        cancelAnimationFrame(frame);
      };
    },
  };
};

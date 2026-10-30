import { z } from "zod";
import type { AirJamConfig } from "../core/config";
import type { AirJamHostEnvironment } from "../core/environment";
import { updateDevBrowserLogContext } from "../dev/browser-log-sink";
import { roomCodeSchema, type RoomCode } from "../protocol";
import { runtimeTopologyToQueryParams } from "../runtime-topology";
import { detectRunMode } from "../utils/mode";
import { urlBuilder } from "../utils/url-builder";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "./arcade-runtime-url";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import { readEmbeddedHostChildSession } from "./embedded-runtime-adapters";
import { getHostRealtimeClient } from "./host-realtime-client";

const HOST_ROOM_SESSION_STORAGE_KEY = "airjam_room_id";
const HOST_RESUME_CAPABILITY_SESSION_STORAGE_KEY =
  "airjam_host_resume_capability";

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
  return {
    embedded: embedded
      ? { roomId: embedded.roomId, joinUrl: embedded.joinUrl }
      : null,
    requestedRoomId: readRequestedRoomId(),
    runMode: detectRunMode(),
    defaultStoreDomain: resolveImplicitReplicatedStoreDomainFromWindow(),
    controlTarget: window,
    readResume: () => {
      const roomId = sessionStorage.getItem(HOST_ROOM_SESSION_STORAGE_KEY);
      const token = sessionStorage.getItem(
        HOST_RESUME_CAPABILITY_SESSION_STORAGE_KEY,
      );
      if (roomId && token) return { roomId, token };
      if (roomId || token) {
        sessionStorage.removeItem(HOST_ROOM_SESSION_STORAGE_KEY);
        sessionStorage.removeItem(HOST_RESUME_CAPABILITY_SESSION_STORAGE_KEY);
      }
      return null;
    },
    writeResume: (resume) => {
      if (!resume) {
        sessionStorage.removeItem(HOST_ROOM_SESSION_STORAGE_KEY);
        sessionStorage.removeItem(HOST_RESUME_CAPABILITY_SESSION_STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(HOST_ROOM_SESSION_STORAGE_KEY, resume.roomId);
      sessionStorage.setItem(
        HOST_RESUME_CAPABILITY_SESSION_STORAGE_KEY,
        resume.token,
      );
    },
    requestHostGrant: async (endpoint, appId) => {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(appId ? { appId } : {}),
      });
      if (!response.ok)
        throw new Error(`Failed to fetch host grant (${response.status})`);
      const parsed = hostGrantResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid host grant response");
      return parsed.data.hostGrant;
    },
    controllerUrl: async (roomId, capabilityToken) => {
      const url = new URL(
        await urlBuilder.buildControllerUrl(roomId, {
          host: config.topology.publicHost,
          capabilityToken,
        }),
      );
      if (
        config.topology.runtimeMode === "standalone-dev" ||
        config.topology.runtimeMode === "standalone-secure"
      )
        for (const [key, value] of Object.entries(
          runtimeTopologyToQueryParams({
            ...config.topology,
            surfaceRole: "controller",
            embedded: false,
            embedParentOrigin: undefined,
          }),
        ))
          url.searchParams.set(key, value);
      return url.toString();
    },
    transport: (getSocket) => getHostRealtimeClient(getSocket),
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

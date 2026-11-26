import type { SettingsValues } from "../core/settings";
import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_GAME_SETTINGS,
  AIRJAM_GAME_SETTINGS_RESULT,
  AIRJAM_GAME_SETTINGS_UPDATE,
  AIRJAM_SETTINGS_READY,
  AIRJAM_SETTINGS_SYNC,
  airJamGameSettingsMessageSchema,
  airJamGameSettingsResultMessageSchema,
  airJamGameSettingsUpdateMessageSchema,
  createBridgeHandshake,
  isAirJamSettingsReadyMessage,
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
  type AirJamGameSettingsState,
} from "../runtime/iframe-bridge";
import { AIR_JAM_SDK_VERSION } from "../runtime/sdk-version";
import {
  watchEmbeddedGameSettings,
  type EmbeddedGameSettingsSource,
} from "./embedded-game-settings";
import type { AirJamSurfaceSettings } from "./platform-settings";

const createSettingsBridgeInitMessage = () => ({
  type: AIRJAM_BRIDGE_INIT,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-runtime",
      capabilityFlags: {
        settingsSync: true,
      },
    }),
  },
});

const createSettingsSyncMessage = (settings: AirJamSurfaceSettings) => ({
  type: AIRJAM_SETTINGS_SYNC,
  payload: {
    settings,
  },
});

export type PlatformSettingsBridgeState = "unbound" | "waiting_ready" | "ready";

export type PlatformSettingsBridgeTransport =
  | "bridge_port"
  | "window_postmessage";

export interface ParentPlatformSettingsBridgeEventMap {
  bridgeAttached: { state: PlatformSettingsBridgeState };
  settingsReady: { state: PlatformSettingsBridgeState };
  snapshotFlushed: {
    phase: "initial" | "update";
    transports: PlatformSettingsBridgeTransport[];
    settings: AirJamSurfaceSettings;
  };
}

export interface ParentPlatformSettingsBridgeOptions {
  createMessageChannel?: () => MessageChannel;
  onEvent?<T extends keyof ParentPlatformSettingsBridgeEventMap>(
    event: T,
    payload: ParentPlatformSettingsBridgeEventMap[T],
  ): void;
  /** The framed game's declared settings as they change; null when it has none or left. */
  onGameSettings?(state: AirJamGameSettingsState | null): void;
}

export interface ParentPlatformSettingsBridgeController {
  attach(targetWindow: Window, targetOrigin: string): void;
  detach(): void;
  updateSettings(settings: AirJamSurfaceSettings): void;
  /** Changes the framed game's settings; rejects with the game's refusal. */
  updateGameSettings(
    patch: SettingsValues,
    expectedRevision: number,
  ): Promise<void>;
  handleMessage(
    event: MessageEvent<unknown>,
    targetWindow: Window | null,
    targetOrigin: string | null,
  ): boolean;
  getState(): PlatformSettingsBridgeState;
}

const noop = () => {};

export const createParentPlatformSettingsBridge = (
  options: ParentPlatformSettingsBridgeOptions = {},
): ParentPlatformSettingsBridgeController => {
  const createMessageChannel =
    options.createMessageChannel ?? (() => new MessageChannel());
  const emit = options.onEvent ?? noop;

  let state: PlatformSettingsBridgeState = "unbound";
  let latestSettings: AirJamSurfaceSettings | null = null;
  let bridgePort: MessagePort | null = null;
  let targetWindow: Window | null = null;
  let targetOrigin: string | null = null;
  let initialSnapshotFlushed = false;
  let childReadySeen = false;
  let requestCount = 0;
  const pendingUpdates = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();

  const settlePending = (message: string) => {
    for (const pending of pendingUpdates.values())
      pending.reject(new Error(message));
    pendingUpdates.clear();
  };

  const closeBridgePort = () => {
    if (!bridgePort) {
      return;
    }

    try {
      bridgePort.close();
    } catch {
      // Ignore close errors during teardown or iframe reload.
    }

    bridgePort = null;
    settlePending("The game left before its settings changed.");
    options.onGameSettings?.(null);
  };

  const handlePortMessage = (event: MessageEvent<unknown>) => {
    const state = airJamGameSettingsMessageSchema.safeParse(event.data);
    if (state.success) {
      options.onGameSettings?.(state.data.payload);
      return;
    }
    const result = airJamGameSettingsResultMessageSchema.safeParse(event.data);
    if (!result.success) return;
    const pending = pendingUpdates.get(result.data.payload.requestId);
    if (!pending) return;
    pendingUpdates.delete(result.data.payload.requestId);
    if (result.data.payload.ok) pending.resolve();
    else pending.reject(new Error(result.data.payload.error));
  };

  const flushSnapshot = (phase: "initial" | "update") => {
    if (
      !latestSettings ||
      !targetWindow ||
      !targetOrigin ||
      state !== "ready"
    ) {
      return;
    }

    const payload = createSettingsSyncMessage(latestSettings);
    const transports: PlatformSettingsBridgeTransport[] = [];

    if (bridgePort) {
      bridgePort.postMessage(payload);
      transports.push("bridge_port");
    }

    targetWindow.postMessage(payload, targetOrigin);
    transports.push("window_postmessage");

    emit("snapshotFlushed", {
      phase,
      transports,
      settings: latestSettings,
    });
    initialSnapshotFlushed = true;
  };

  return {
    attach(nextTargetWindow, nextTargetOrigin) {
      closeBridgePort();

      const channel = createMessageChannel();
      bridgePort = channel.port1;
      bridgePort.addEventListener("message", handlePortMessage);
      bridgePort.start?.();
      targetWindow = nextTargetWindow;
      targetOrigin = nextTargetOrigin;
      initialSnapshotFlushed = false;
      state = childReadySeen ? "ready" : "waiting_ready";

      nextTargetWindow.postMessage(
        createSettingsBridgeInitMessage(),
        nextTargetOrigin,
        [channel.port2],
      );

      emit("bridgeAttached", {
        state,
      });

      if (childReadySeen) {
        flushSnapshot("initial");
      }
    },

    detach() {
      closeBridgePort();
      targetWindow = null;
      targetOrigin = null;
      initialSnapshotFlushed = false;
      childReadySeen = false;
      state = "unbound";
    },

    updateSettings(settings) {
      latestSettings = settings;
      if (state === "ready") {
        flushSnapshot(initialSnapshotFlushed ? "update" : "initial");
      }
    },

    updateGameSettings(patch, expectedRevision) {
      const port = bridgePort;
      if (!port) return Promise.reject(new Error("The game is not running."));
      requestCount += 1;
      const requestId = String(requestCount);
      return new Promise<void>((resolve, reject) => {
        pendingUpdates.set(requestId, { resolve, reject });
        port.postMessage({
          type: AIRJAM_GAME_SETTINGS_UPDATE,
          payload: { requestId, patch, expectedRevision },
        });
      });
    },

    handleMessage(event, expectedTargetWindow, expectedTargetOrigin) {
      if (!expectedTargetWindow || !expectedTargetOrigin) {
        return false;
      }

      if (event.source !== expectedTargetWindow) {
        return false;
      }

      if (event.origin !== expectedTargetOrigin) {
        return false;
      }

      if (!isAirJamSettingsReadyMessage(event.data)) {
        return false;
      }

      childReadySeen = true;
      state = "ready";
      emit("settingsReady", {
        state,
      });
      flushSnapshot(initialSnapshotFlushed ? "update" : "initial");
      return true;
    },

    getState() {
      return state;
    },
  };
};

export interface InheritedPlatformSettingsBridgeOptions {
  applySettings: (settings: AirJamSurfaceSettings) => void;
  onBridgeUnavailable?: () => void;
  onBridgeAttached?: (origin: string) => void;
}

const refusal = (error: unknown) =>
  String(error instanceof Error ? error.message : error).slice(0, 1024) ||
  "The game refused the change.";

/**
 * Serves the game's own declared settings to the platform over the bridge
 * port: their current state whenever it changes, and each requested change.
 */
export const serveEmbeddedGameSettings = (port: MessagePort): (() => void) => {
  let current: EmbeddedGameSettingsSource | null = null;
  let unsubscribeSource = () => {};
  const unwatch = watchEmbeddedGameSettings((source) => {
    unsubscribeSource();
    unsubscribeSource = () => {};
    current = source;
    const post = () =>
      port.postMessage({
        type: AIRJAM_GAME_SETTINGS,
        payload: source
          ? { declaration: source.declaration, ...source.read() }
          : null,
      });
    post();
    if (source) unsubscribeSource = source.subscribe(post);
  });
  const handleUpdate = (event: MessageEvent<unknown>) => {
    const parsed = airJamGameSettingsUpdateMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const { requestId, patch, expectedRevision } = parsed.data.payload;
    try {
      if (!current) throw new Error("This game declares no settings.");
      current.update(patch, expectedRevision);
      port.postMessage({
        type: AIRJAM_GAME_SETTINGS_RESULT,
        payload: { requestId, ok: true },
      });
    } catch (error) {
      port.postMessage({
        type: AIRJAM_GAME_SETTINGS_RESULT,
        payload: { requestId, ok: false, error: refusal(error) },
      });
    }
  };
  port.addEventListener("message", handleUpdate as EventListener);
  return () => {
    unwatch();
    unsubscribeSource();
    port.removeEventListener("message", handleUpdate as EventListener);
  };
};

export const initializeInheritedPlatformSettingsBridge = ({
  applySettings,
  onBridgeUnavailable,
  onBridgeAttached,
}: InheritedPlatformSettingsBridgeOptions): (() => void) => {
  if (typeof window === "undefined" || window.parent === window) {
    onBridgeUnavailable?.();
    return () => {};
  }

  const trustedParentOrigin = (() => {
    try {
      return document.referrer ? new URL(document.referrer).origin : null;
    } catch {
      return null;
    }
  })();
  if (!trustedParentOrigin) {
    onBridgeUnavailable?.();
    return () => {};
  }

  let bridgePortCleanup: (() => void) | null = null;

  const bindBridgePort = (port: MessagePort) => {
    bridgePortCleanup?.();

    const handlePortMessage = (event: MessageEvent<unknown>) => {
      if (isAirJamSettingsSyncMessage(event.data))
        applySettings(event.data.payload.settings);
    };

    port.addEventListener("message", handlePortMessage as EventListener);
    const stopServing = serveEmbeddedGameSettings(port);
    port.start();

    bridgePortCleanup = () => {
      stopServing();
      port.removeEventListener("message", handlePortMessage as EventListener);
      try {
        port.close();
      } catch {
        // Ignore close errors during iframe teardown.
      }
      bridgePortCleanup = null;
    };
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) {
      return;
    }

    if (event.origin !== trustedParentOrigin) {
      return;
    }

    if (isAirJamSettingsSyncMessage(event.data)) {
      applySettings(event.data.payload.settings);
      return;
    }

    if (!parseAirJamBridgeInitMessage(event.data)) {
      return;
    }

    const bridgePort = event.ports?.[0];
    if (!bridgePort) {
      return;
    }

    onBridgeAttached?.(event.origin);
    bindBridgePort(bridgePort);
  };

  window.addEventListener("message", handleMessage);

  if (typeof window.parent.postMessage === "function") {
    window.parent.postMessage(
      {
        type: AIRJAM_SETTINGS_READY,
        payload: { ready: true },
      },
      trustedParentOrigin,
    );
  }

  return () => {
    window.removeEventListener("message", handleMessage);
    bridgePortCleanup?.();
  };
};

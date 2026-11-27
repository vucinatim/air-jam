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

export interface ParentPlatformSettingsBridgeOptions {
  createMessageChannel?: () => MessageChannel;
  /** The framed game's declared settings as they change; null when it has none or left. */
  onGameSettings?(state: AirJamGameSettingsState | null): void;
}

export interface ParentPlatformSettingsBridgeController {
  /** Offers the frame a fresh port; the frame answers on it once bound. */
  attach(targetWindow: Window, targetOrigin: string): void;
  detach(): void;
  updateSettings(settings: AirJamSurfaceSettings): void;
  /** Changes the framed game's settings; rejects with the game's refusal. */
  updateGameSettings(
    patch: SettingsValues,
    expectedRevision: number,
  ): Promise<void>;
  /**
   * A frame that (re)loaded says it is ready on the window; the bridge
   * answers with a fresh port. True when the event was that.
   */
  handleMessage(
    event: MessageEvent<unknown>,
    targetWindow: Window | null,
    targetOrigin: string | null,
  ): boolean;
  getState(): PlatformSettingsBridgeState;
}

/**
 * The platform's end of one game frame's settings link. Settings and the
 * game's own declared settings travel over one port per frame document; the
 * frame confirms the port before anything is sent on it.
 */
export const createParentPlatformSettingsBridge = (
  options: ParentPlatformSettingsBridgeOptions = {},
): ParentPlatformSettingsBridgeController => {
  const createMessageChannel =
    options.createMessageChannel ?? (() => new MessageChannel());

  let state: PlatformSettingsBridgeState = "unbound";
  let latestSettings: AirJamSurfaceSettings | null = null;
  let bridgePort: MessagePort | null = null;
  let requestCount = 0;
  const pendingUpdates = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();

  const flush = () => {
    if (state === "ready" && bridgePort && latestSettings)
      bridgePort.postMessage(createSettingsSyncMessage(latestSettings));
  };

  const closeBridgePort = () => {
    if (!bridgePort) return;
    try {
      bridgePort.close();
    } catch {
      // Ignore close errors during teardown or iframe reload.
    }
    bridgePort = null;
    state = "unbound";
    for (const pending of pendingUpdates.values())
      pending.reject(new Error("The game left before its settings changed."));
    pendingUpdates.clear();
    options.onGameSettings?.(null);
  };

  const handlePortMessage = (event: MessageEvent<unknown>) => {
    if (isAirJamSettingsReadyMessage(event.data)) {
      state = "ready";
      flush();
      return;
    }
    const gameState = airJamGameSettingsMessageSchema.safeParse(event.data);
    if (gameState.success) {
      options.onGameSettings?.(gameState.data.payload);
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

  const attach = (targetWindow: Window, targetOrigin: string) => {
    closeBridgePort();
    const channel = createMessageChannel();
    bridgePort = channel.port1;
    bridgePort.addEventListener("message", handlePortMessage);
    bridgePort.start();
    state = "waiting_ready";
    targetWindow.postMessage(createSettingsBridgeInitMessage(), targetOrigin, [
      channel.port2,
    ]);
  };

  return {
    attach,
    detach: closeBridgePort,

    updateSettings(settings) {
      latestSettings = settings;
      flush();
    },

    updateGameSettings(patch, expectedRevision) {
      const port = bridgePort;
      if (!port || state !== "ready")
        return Promise.reject(new Error("The game is not running."));
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

    handleMessage(event, targetWindow, targetOrigin) {
      if (
        !targetWindow ||
        !targetOrigin ||
        event.source !== targetWindow ||
        event.origin !== targetOrigin ||
        !isAirJamSettingsReadyMessage(event.data)
      )
        return false;
      attach(targetWindow, targetOrigin);
      return true;
    },

    getState() {
      return state;
    },
  };
};

export interface InheritedPlatformSettingsBridgeOptions {
  /** The platform page embedding this game, as its topology declares it. */
  parent: { window: Window; origin: string };
  applySettings: (settings: AirJamSurfaceSettings) => void;
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
  parent,
  applySettings,
  onBridgeAttached,
}: InheritedPlatformSettingsBridgeOptions): (() => void) => {
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
    port.postMessage({ type: AIRJAM_SETTINGS_READY, payload: { ready: true } });

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
    if (event.source !== parent.window || event.origin !== parent.origin)
      return;

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

  parent.window.postMessage(
    { type: AIRJAM_SETTINGS_READY, payload: { ready: true } },
    parent.origin,
  );

  return () => {
    window.removeEventListener("message", handleMessage);
    bridgePortCleanup?.();
  };
};

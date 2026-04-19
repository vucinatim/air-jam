import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_READY,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  isAirJamSettingsReadyMessage,
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
} from "../runtime/iframe-bridge";
import { AIR_JAM_SDK_VERSION } from "../runtime/sdk-version";
import type { PlatformSettingsSnapshot } from "./platform-settings";

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

const createSettingsSyncMessage = (settings: PlatformSettingsSnapshot) => ({
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
    settings: PlatformSettingsSnapshot;
  };
}

export interface ParentPlatformSettingsBridgeOptions {
  createMessageChannel?: () => MessageChannel;
  onEvent?<T extends keyof ParentPlatformSettingsBridgeEventMap>(
    event: T,
    payload: ParentPlatformSettingsBridgeEventMap[T],
  ): void;
}

export interface ParentPlatformSettingsBridgeController {
  attach(targetWindow: Window, targetOrigin: string): void;
  detach(): void;
  updateSettings(settings: PlatformSettingsSnapshot): void;
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
  let latestSettings: PlatformSettingsSnapshot | null = null;
  let bridgePort: MessagePort | null = null;
  let targetWindow: Window | null = null;
  let targetOrigin: string | null = null;
  let initialSnapshotFlushed = false;
  let childReadySeen = false;

  const setState = (next: PlatformSettingsBridgeState) => {
    state = next;
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
      bridgePort.start?.();
      targetWindow = nextTargetWindow;
      targetOrigin = nextTargetOrigin;
      initialSnapshotFlushed = false;
      setState(childReadySeen ? "ready" : "waiting_ready");

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
      setState("unbound");
    },

    updateSettings(settings) {
      latestSettings = settings;
      if (state === "ready") {
        flushSnapshot(initialSnapshotFlushed ? "update" : "initial");
      }
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
      setState("ready");
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
  applySettings: (settings: PlatformSettingsSnapshot) => void;
  onBridgeUnavailable?: () => void;
  onBridgeAttached?: (origin: string) => void;
  onSettingsReadyRequested?: (origin: string) => void;
  onSnapshotApplied?: (
    transport: PlatformSettingsBridgeTransport,
    settings: PlatformSettingsSnapshot,
  ) => void;
}

export const initializeInheritedPlatformSettingsBridge = ({
  applySettings,
  onBridgeUnavailable,
  onBridgeAttached,
  onSettingsReadyRequested,
  onSnapshotApplied,
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

  const applySnapshot = (
    transport: PlatformSettingsBridgeTransport,
    settings: PlatformSettingsSnapshot,
  ) => {
    onSnapshotApplied?.(transport, settings);
    applySettings(settings);
  };

  const bindBridgePort = (port: MessagePort) => {
    bridgePortCleanup?.();

    const handlePortMessage = (event: MessageEvent<unknown>) => {
      if (!isAirJamSettingsSyncMessage(event.data)) {
        return;
      }

      applySnapshot("bridge_port", event.data.payload.settings);
    };

    port.addEventListener("message", handlePortMessage as EventListener);
    port.start();

    bridgePortCleanup = () => {
      port.removeEventListener("message", handlePortMessage as EventListener);
      try {
        port.close();
      } catch {
        // Ignore close errors during iframe teardown.
      }
      bridgePortCleanup = null;
    };
  };

  const handleInitMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) {
      return;
    }

    if (event.origin !== trustedParentOrigin) {
      return;
    }

    const initMessage = parseAirJamBridgeInitMessage(event.data);
    if (!initMessage) {
      return;
    }

    const bridgePort = event.ports?.[0];
    if (!bridgePort) {
      return;
    }

    onBridgeAttached?.(event.origin);
    bindBridgePort(bridgePort);
  };

  const handleFallbackMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) {
      return;
    }

    if (event.origin !== trustedParentOrigin) {
      return;
    }

    if (!isAirJamSettingsSyncMessage(event.data)) {
      return;
    }

    applySnapshot("window_postmessage", event.data.payload.settings);
  };

  window.addEventListener("message", handleInitMessage);
  window.addEventListener("message", handleFallbackMessage);

  if (typeof window.parent.postMessage === "function") {
    window.parent.postMessage(
      {
        type: AIRJAM_SETTINGS_READY,
        payload: { ready: true },
      },
      trustedParentOrigin,
    );
    onSettingsReadyRequested?.(trustedParentOrigin);
  }

  return () => {
    window.removeEventListener("message", handleInitMessage);
    window.removeEventListener("message", handleFallbackMessage);
    bridgePortCleanup?.();
  };
};

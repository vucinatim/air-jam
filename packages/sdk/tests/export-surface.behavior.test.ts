import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as sdk from "../src/index";

describe("sdk export surface", () => {
  it("does not expose unscoped lifecycle primitives on root export", () => {
    expect("AirJamProvider" in sdk).toBe(false);
    expect("AirJamProviderProps" in sdk).toBe(false);
    expect("useAirJamContext" in sdk).toBe(false);
    expect("useAirJamConfig" in sdk).toBe(false);
    expect("useAirJamState" in sdk).toBe(false);
    expect("useAirJamSocket" in sdk).toBe(false);
    expect("SocketManager" in sdk).toBe(false);
    expect("resolveAirJamConfig" in sdk).toBe(false);
    expect("getControllerRealtimeClient" in sdk).toBe(false);
    expect("getHostRealtimeClient" in sdk).toBe(false);
    expect("readEmbeddedControllerChildSession" in sdk).toBe(false);
    expect("readEmbeddedHostChildSession" in sdk).toBe(false);
    expect("generateRoomCode" in sdk).toBe(false);
    expect("generateControllerId" in sdk).toBe(false);
    expect("getLocalNetworkIp" in sdk).toBe(false);
    expect("DEFAULT_SERVER_PORT" in sdk).toBe(false);
    expect("CONTROLLER_PATH" in sdk).toBe(false);
    expect("INPUT_DEBOUNCE_MS" in sdk).toBe(false);
    expect("TOGGLE_DEBOUNCE_MS" in sdk).toBe(false);
    expect("SOCKET_CONFIG" in sdk).toBe(false);
    expect("DEFAULT_MAX_PLAYERS" in sdk).toBe(false);
    expect("HostEvents" in sdk).toBe(false);
    expect("ControllerEvents" in sdk).toBe(false);
    expect("SystemEvents" in sdk).toBe(false);
    expect("ServerEvents" in sdk).toBe(false);
    expect("Events" in sdk).toBe(false);
    expect("urlBuilder" in sdk).toBe(false);
    expect("AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN" in sdk).toBe(false);
    expect("AIR_JAM_SDK_VERSION" in sdk).toBe(false);
    expect("createBridgeHandshake" in sdk).toBe(false);
    expect("arcadeSurfaceRuntimeUrlParams" in sdk).toBe(false);
    expect("createControllerBridgeAttachMessage" in sdk).toBe(false);
    expect("createHostBridgeAttachMessage" in sdk).toBe(false);
    expect("isArcadeSurfaceMismatch" in sdk).toBe(false);
    expect("AirJamStateSyncPayload" in sdk).toBe(false);
    expect("AirJamActionRpcPayload" in sdk).toBe(false);
    expect("ControllerStateMessage" in sdk).toBe(false);
    expect("ControllerWelcomePayload" in sdk).toBe(false);
    expect("HostLeftNotice" in sdk).toBe(false);
    expect("PlayerUpdatedNotice" in sdk).toBe(false);
    expect("PlaySoundPayload" in sdk).toBe(false);
    expect("ServerErrorPayload" in sdk).toBe(false);
    expect("HostRegistrationAck" in sdk).toBe(false);
    expect("SystemLaunchGameAck" in sdk).toBe(false);
    expect("AudioManager" in sdk).toBe(false);
    expect("useAudioManager" in sdk).toBe(false);
    expect("AudioProvider" in sdk).toBe(false);
    expect("useProvidedAudio" in sdk).toBe(false);
    expect("useRemoteSound" in sdk).toBe(false);
    expect("useVolumeStore" in sdk).toBe(false);
    expect("isManifestSoundId" in sdk).toBe(false);
    expect("detectSoundCategory" in sdk).toBe(false);
    expect("initializeParentSettingsSync" in sdk).toBe(false);
    expect("disposeParentSettingsSync" in sdk).toBe(false);
    expect("isInternalActionName" in sdk).toBe(false);
  });

  it("exposes explicit audio runtimes and consumer hooks on root export", () => {
    expect("AudioRuntime" in sdk).toBe(true);
    expect("ControllerRemoteAudioRuntime" in sdk).toBe(true);
    expect("useAudio" in sdk).toBe(true);
    expect("useAudioRuntimeStatus" in sdk).toBe(true);
    expect("useAudioRuntimeControls" in sdk).toBe(true);
    expect("PlatformSettingsBoundary" in sdk).toBe(true);
    expect("PlatformSettingsRuntime" in sdk).toBe(true);
    expect("usePlatformSettings" in sdk).toBe(true);
    expect("useInheritedPlatformSettings" in sdk).toBe(true);
    expect("usePlatformAudioSettings" in sdk).toBe(true);
    expect("getEffectiveAudioVolume" in sdk).toBe(true);
    expect("useAudioSettings" in sdk).toBe(false);
  });

  it("keeps package subpath exports limited to public entrypoints", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as {
      exports?: Record<string, unknown>;
    };

    const exportKeys = Object.keys(packageJson.exports ?? {});
    expect(exportKeys).toEqual(
      expect.arrayContaining([
        ".",
        "./arcade",
        "./arcade/bridge",
        "./arcade/bridge/controller",
        "./arcade/bridge/host",
        "./arcade/bridge/iframe",
        "./arcade/host",
        "./arcade/surface",
        "./arcade/url",
        "./ui",
        "./protocol",
        "./contracts/v2",
        "./prefabs",
        "./styles.css",
      ]),
    );
    expect(packageJson.exports?.["./context"]).toBeUndefined();
    expect(packageJson.exports?.["./context/socket-manager"]).toBeUndefined();
  });
});

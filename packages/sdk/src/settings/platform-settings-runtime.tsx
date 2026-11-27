import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAirJamConfig } from "../context/air-jam-context";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import { embeddedRuntimeParent } from "../runtime/embedded-parent";
import { emitAirJamDevRuntimeEvent } from "../runtime/dev-runtime-events";
import {
  DEFAULT_ROOM_SETTINGS,
  DEFAULT_SURFACE_SETTINGS,
  normalizeDeviceSettings,
  normalizeRoomSettings,
  resolveSurfaceSettings,
  type AirJamSurfaceSettings,
  type DeviceSettingsValues,
  type PlatformSurface,
  type RoomSettingsValues,
} from "./platform-settings";
import { initializeInheritedPlatformSettingsBridge } from "./platform-settings-bridge";
import {
  publishSurfaceSettings,
  readAirJamSurfaceSettings,
  subscribeSurfaceSettings,
} from "./surface-settings";

const DEVICE_STORAGE_KEY = "air-jam-device-settings";
const ROOM_STORAGE_KEY = "air-jam-room-settings";

/**
 * The platform's settings as they apply to this game surface: sound levels,
 * vibration, reduced motion, contrast, interface scale and on-screen
 * controller opacity. Read-only; the platform alone changes them.
 */
export const useAirJamSurfaceSettings = (): AirJamSurfaceSettings =>
  useSyncExternalStore(
    subscribeSurfaceSettings,
    readAirJamSurfaceSettings,
    () => DEFAULT_SURFACE_SETTINGS,
  );

/** Reduced motion, contrast and size reach every element without game code. */
const presentSurfaceSettings = (settings: AirJamSurfaceSettings) => {
  const root = document.documentElement;
  root.toggleAttribute("data-aj-reduce-motion", settings.reduceMotion);
  root.toggleAttribute("data-aj-increase-contrast", settings.increaseContrast);
  root.style.setProperty(
    "--aj-interface-scale",
    String(settings.interfaceScale),
  );
  root.style.fontSize =
    settings.interfaceScale === 1
      ? ""
      : `${Math.round(settings.interfaceScale * 100)}%`;
};

const readStored = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // Storage can be denied or hold a damaged value; defaults apply.
    return null;
  }
};

const writeStored = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage the setting holds for this page only.
  }
};

const systemPrefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const readDeviceSettings = () =>
  normalizeDeviceSettings(readStored(DEVICE_STORAGE_KEY), {
    reduceMotion: systemPrefersReducedMotion(),
  });

export type PlatformSettingsRuntimeStatus = "ready" | "waiting";

interface OwnerApi {
  readonly surface: PlatformSurface;
  readonly device: DeviceSettingsValues;
  readonly room: RoomSettingsValues;
  readonly setDevice: (patch: Partial<DeviceSettingsValues>) => void;
  /** Only the screen holds the room's settings; a phone asks the screen. */
  readonly setRoom: (patch: Partial<RoomSettingsValues>) => void;
  /** A phone shows the room's settings as the screen shares them. */
  readonly mirrorRoom: (room: RoomSettingsValues) => void;
}

type RuntimeContext =
  | { readonly mode: "owner"; readonly owner: OwnerApi }
  | {
      readonly mode: "inherited";
      readonly status: PlatformSettingsRuntimeStatus;
    };

const runtimeContext = createContext<RuntimeContext | null>(null);

export interface PlatformSettingsRuntimeProps {
  children: ReactNode;
  /** The surface this page is when it is not embedded by the platform. */
  surface: PlatformSurface;
}

function OwnerRuntime({ children, surface }: PlatformSettingsRuntimeProps) {
  const [device, setDeviceState] = useState(readDeviceSettings);
  const [room, setRoomState] = useState(() =>
    surface === "screen"
      ? normalizeRoomSettings(readStored(ROOM_STORAGE_KEY))
      : DEFAULT_ROOM_SETTINGS,
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DEVICE_STORAGE_KEY)
        setDeviceState(readDeviceSettings());
      if (
        surface === "screen" &&
        (event.key === null || event.key === ROOM_STORAGE_KEY)
      )
        setRoomState(normalizeRoomSettings(readStored(ROOM_STORAGE_KEY)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [surface]);

  const setDevice = useCallback((patch: Partial<DeviceSettingsValues>) => {
    setDeviceState((current) => {
      const next = normalizeDeviceSettings({ ...current, ...patch });
      writeStored(DEVICE_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setRoom = useCallback(
    (patch: Partial<RoomSettingsValues>) => {
      if (surface !== "screen")
        throw new Error(
          "A phone cannot hold the room's settings; ask the screen to change them.",
        );
      setRoomState((current) => {
        const next = normalizeRoomSettings({ ...current, ...patch });
        writeStored(ROOM_STORAGE_KEY, next);
        return next;
      });
    },
    [surface],
  );

  const mirrorRoom = useCallback(
    (shared: RoomSettingsValues) => {
      if (surface !== "phone")
        throw new Error("A screen holds the room's settings itself.");
      setRoomState(normalizeRoomSettings(shared));
    },
    [surface],
  );

  const resolved = useMemo(
    () => resolveSurfaceSettings({ surface, device, room }),
    [surface, device, room],
  );
  useEffect(() => {
    publishSurfaceSettings(resolved);
    presentSurfaceSettings(resolved);
  }, [resolved]);

  const value = useMemo<RuntimeContext>(
    () => ({
      mode: "owner",
      owner: { surface, device, room, setDevice, setRoom, mirrorRoom },
    }),
    [surface, device, room, setDevice, setRoom, mirrorRoom],
  );
  return (
    <runtimeContext.Provider value={value}>{children}</runtimeContext.Provider>
  );
}

type EmbeddingParent = NonNullable<ReturnType<typeof embeddedRuntimeParent>>;

/** Waits for the embedding platform's settings; nothing plays before they arrive. */
function InheritedRuntime({
  children,
  parent,
}: {
  children: ReactNode;
  parent: EmbeddingParent;
}) {
  const [status, setStatus] =
    useState<PlatformSettingsRuntimeStatus>("waiting");

  useEffect(
    () =>
      initializeInheritedPlatformSettingsBridge({
        parent,
        applySettings: (settings) => {
          publishSurfaceSettings(settings);
          presentSurfaceSettings(settings);
          setStatus("ready");
        },
        onBridgeAttached: (origin) => {
          emitAirJamDevRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
            message: "Embedded runtime bound platform settings bridge port",
            level: "info",
            data: { origin, state: "waiting_ready", transport: "bridge_port" },
          });
        },
      }),
    [parent],
  );

  const value = useMemo<RuntimeContext>(
    () => ({ mode: "inherited", status }),
    [status],
  );
  return (
    <runtimeContext.Provider value={value}>{children}</runtimeContext.Provider>
  );
}

/**
 * The platform's settings for a page the platform owns: its device's settings
 * and, on a screen, the room's, stored on the device. Every platform page
 * mounts one at its root, including a phone page the platform shows inside
 * its own screen.
 */
export function PlatformSettingsRuntime(props: PlatformSettingsRuntimeProps) {
  return <OwnerRuntime {...props} />;
}

/**
 * A game's settings boundary: inside a platform page it uses that page's
 * settings; embedded by the platform it inherits what the platform resolved
 * for it, from the parent its topology declares; on its own it owns its
 * device's settings.
 */
export function PlatformSettingsBoundary(props: PlatformSettingsRuntimeProps) {
  const existing = useContext(runtimeContext);
  const { topology } = useAirJamConfig();
  const parent = useMemo(() => embeddedRuntimeParent(topology), [topology]);
  if (existing) return props.children;
  return parent ? (
    <InheritedRuntime parent={parent}>{props.children}</InheritedRuntime>
  ) : (
    <OwnerRuntime {...props} />
  );
}

/** The settings a platform page owns and changes; only an owning page has it. */
export function usePlatformSettings(): OwnerApi {
  const context = useContext(runtimeContext);
  if (context?.mode !== "owner")
    throw new Error(
      "usePlatformSettings needs the page that owns its settings: mount <PlatformSettingsRuntime> at the top of the platform shell.",
    );
  return context.owner;
}

/** The owning page's settings, or null where the page inherits them. */
export function useOptionalPlatformSettings(): OwnerApi | null {
  const context = useContext(runtimeContext);
  return context?.mode === "owner" ? context.owner : null;
}

export function usePlatformSettingsRuntimeStatus(): PlatformSettingsRuntimeStatus {
  const context = useContext(runtimeContext);
  return context?.mode === "inherited" ? context.status : "ready";
}

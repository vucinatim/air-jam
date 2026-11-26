import { z } from "zod";
import {
  defineAirJamSettings,
  isValidSettingValue,
  setting,
  type AirJamSettings,
  type AirJamSettingsValues,
} from "../core/settings";

/** Who holds a value: the one screen or phone it is on, or the room's screen for everyone. */
export type PlatformSettingScope = "device" | "room";
/** Where a setting can be seen. */
export type PlatformSurface = "screen" | "phone";
/** The settings dialog's section a setting lives in. */
export type PlatformSettingSection = "audio" | "display" | "room" | "controls";

type Entry = {
  readonly scope: PlatformSettingScope;
  readonly section: PlatformSettingSection;
  readonly surfaces: readonly PlatformSurface[];
  readonly setting:
    | ReturnType<typeof setting.number>
    | ReturnType<typeof setting.boolean>
    | ReturnType<typeof setting.choice>;
};

const BOTH = ["screen", "phone"] as const;

/**
 * Every setting Air Jam itself offers, declared once with its owner and its
 * place. The platform draws them; games never write them and receive what
 * applies to their surface as {@link AirJamSurfaceSettings}.
 */
const entries = {
  volume: {
    scope: "room",
    section: "audio",
    surfaces: BOTH,
    setting: setting.number({
      label: "Volume",
      default: 100,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    }),
  },
  music: {
    scope: "room",
    section: "audio",
    surfaces: BOTH,
    setting: setting.number({
      label: "Music",
      default: 80,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    }),
  },
  effects: {
    scope: "room",
    section: "audio",
    surfaces: ["screen"],
    setting: setting.number({
      label: "Effects",
      default: 100,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    }),
  },
  muted: {
    scope: "room",
    section: "audio",
    surfaces: ["screen"],
    setting: setting.boolean({
      label: "Mute",
      default: false,
      description: "Silence the game without losing your levels.",
    }),
  },
  controllerSounds: {
    scope: "device",
    section: "audio",
    surfaces: ["phone"],
    setting: setting.number({
      label: "Controller sounds",
      default: 100,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
      description: "Clicks and effects your controller plays.",
    }),
  },
  vibration: {
    scope: "device",
    section: "audio",
    surfaces: ["phone"],
    setting: setting.boolean({
      label: "Vibration",
      default: true,
      description: "Feel hits, buzzes and button presses.",
    }),
  },
  interfaceSize: {
    scope: "device",
    section: "display",
    surfaces: BOTH,
    setting: setting.choice({
      label: "Interface size",
      options: ["Default", "Large", "Larger"],
      default: "Default",
      description: "Larger reads better from the couch.",
    }),
  },
  reduceMotion: {
    scope: "device",
    section: "display",
    surfaces: BOTH,
    setting: setting.boolean({
      label: "Reduce motion",
      default: false,
      description: "Calmer transitions in Air Jam and its games.",
    }),
  },
  increaseContrast: {
    scope: "device",
    section: "display",
    surfaces: BOTH,
    setting: setting.boolean({
      label: "Increase contrast",
      default: false,
      description: "Stronger edges and text.",
    }),
  },
  joinable: {
    scope: "room",
    section: "room",
    surfaces: BOTH,
    setting: setting.boolean({
      label: "New players can join",
      default: true,
      description: "Turn off to lock the room.",
    }),
  },
  settingsAccess: {
    scope: "room",
    section: "room",
    surfaces: BOTH,
    setting: setting.choice({
      label: "Phones can change settings",
      options: ["Host player", "Everyone", "No one"],
      default: "Host player",
      description: "The big screen always can.",
    }),
  },
  localPlayers: {
    scope: "room",
    section: "controls",
    surfaces: ["screen"],
    setting: setting.boolean({
      label: "Keyboard and gamepad players",
      default: false,
      description: "Each keyboard half or gamepad joins as a player.",
    }),
  },
  buttonHints: {
    scope: "room",
    section: "controls",
    surfaces: ["screen"],
    setting: setting.boolean({
      label: "Button hints",
      default: true,
      description: "Show which key or button does what.",
    }),
  },
  controllerOpacity: {
    scope: "room",
    section: "controls",
    surfaces: ["screen"],
    setting: setting.number({
      label: "Controller opacity",
      default: 100,
      min: 35,
      max: 100,
      step: 1,
      unit: "%",
      description: "How solid live controllers look over the game.",
    }),
  },
} as const satisfies Record<string, Entry>;

type Entries = typeof entries;
export type PlatformSettingKey = keyof Entries;

export const platformSettingDefinitions = defineAirJamSettings(
  Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [key, entry.setting]),
  ) as { [Key in PlatformSettingKey]: Entries[Key]["setting"] },
);

export interface PlatformSettingPlacement {
  readonly key: PlatformSettingKey;
  readonly scope: PlatformSettingScope;
  readonly section: PlatformSettingSection;
  readonly surfaces: readonly PlatformSurface[];
  readonly definition: AirJamSettings[string];
}

/** Every platform setting in declaration order, the order the dialog draws them. */
export const platformSettingPlacements: readonly PlatformSettingPlacement[] =
  Object.freeze(
    (Object.keys(entries) as PlatformSettingKey[]).map((key) =>
      Object.freeze({
        key,
        scope: entries[key].scope,
        section: entries[key].section,
        surfaces: entries[key].surfaces,
        definition: platformSettingDefinitions[key],
      }),
    ),
  );

type KeysOfScope<Scope extends PlatformSettingScope> = {
  [Key in PlatformSettingKey]: Entries[Key]["scope"] extends Scope
    ? Key
    : never;
}[PlatformSettingKey];

type PlatformSettingsValues = AirJamSettingsValues<
  typeof platformSettingDefinitions
>;
export type DeviceSettingsValues = Pick<
  PlatformSettingsValues,
  KeysOfScope<"device">
>;
export type RoomSettingsValues = Pick<
  PlatformSettingsValues,
  KeysOfScope<"room">
>;

const keysOf = (scope: PlatformSettingScope) =>
  platformSettingPlacements
    .filter((placement) => placement.scope === scope)
    .map((placement) => placement.key);

/** Keeps each declared value that is valid; anything else reads as its default. */
const normalize = <Values>(
  scope: PlatformSettingScope,
  value: unknown,
  fallback: Partial<Record<PlatformSettingKey, unknown>> = {},
): Values => {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return Object.freeze(
    Object.fromEntries(
      keysOf(scope).map((key) => {
        const definition = platformSettingDefinitions[key];
        const candidate = source[key];
        if (isValidSettingValue(definition, candidate)) return [key, candidate];
        const preferred = fallback[key];
        return [
          key,
          isValidSettingValue(definition, preferred)
            ? preferred
            : definition.default,
        ];
      }),
    ),
  ) as Values;
};

export const normalizeDeviceSettings = (
  value: unknown,
  fallback?: Partial<DeviceSettingsValues>,
): DeviceSettingsValues => normalize("device", value, fallback);

export const normalizeRoomSettings = (value: unknown): RoomSettingsValues =>
  normalize("room", value);

export const DEFAULT_DEVICE_SETTINGS = normalizeDeviceSettings(null);
export const DEFAULT_ROOM_SETTINGS = normalizeRoomSettings(null);

const unitInterval = z.number().min(0).max(1);

/**
 * What one surface (the screen's game or a phone's controller) receives: the
 * platform's settings resolved for it. The SDK applies them itself (sound,
 * vibration, motion, contrast and size), so a game needs no settings code.
 */
export const airJamSurfaceSettingsSchema = z
  .object({
    audio: z
      .object({
        volume: unitInterval,
        music: unitInterval,
        effects: unitInterval,
      })
      .strict(),
    vibration: z.boolean(),
    reduceMotion: z.boolean(),
    increaseContrast: z.boolean(),
    interfaceScale: z.number().min(1).max(2),
    controllerOpacity: unitInterval,
    buttonHints: z.boolean(),
  })
  .strict();
export type AirJamSurfaceSettings = z.infer<typeof airJamSurfaceSettingsSchema>;
export type AirJamAudioLevels = AirJamSurfaceSettings["audio"];

const INTERFACE_SCALE: Record<DeviceSettingsValues["interfaceSize"], number> = {
  Default: 1,
  Large: 1.15,
  Larger: 1.3,
};

const fraction = (percent: number) => percent / 100;

export const resolveSurfaceSettings = ({
  surface,
  device,
  room,
}: {
  surface: PlatformSurface;
  device: DeviceSettingsValues;
  room: RoomSettingsValues;
}): AirJamSurfaceSettings =>
  Object.freeze({
    audio: Object.freeze(
      surface === "screen"
        ? {
            volume: room.muted ? 0 : fraction(room.volume),
            music: fraction(room.music),
            effects: fraction(room.effects),
          }
        : { volume: fraction(device.controllerSounds), music: 1, effects: 1 },
    ),
    vibration: device.vibration,
    reduceMotion: device.reduceMotion,
    increaseContrast: device.increaseContrast,
    interfaceScale: INTERFACE_SCALE[device.interfaceSize],
    controllerOpacity: fraction(room.controllerOpacity),
    buttonHints: room.buttonHints,
  });

export const DEFAULT_SURFACE_SETTINGS = resolveSurfaceSettings({
  surface: "screen",
  device: DEFAULT_DEVICE_SETTINGS,
  room: DEFAULT_ROOM_SETTINGS,
});

export const effectiveAudioVolume = (
  audio: AirJamAudioLevels,
  category: "music" | "sfx",
): number =>
  audio.volume * (category === "music" ? audio.music : audio.effects);

/**
 * Whether a phone may change the room's and the game's settings. The screen
 * always may; the host player is the room's earliest player still in it.
 */
export const phoneMayChangeSettings = (
  access: RoomSettingsValues["settingsAccess"],
  isHostPlayer: boolean,
): boolean =>
  access === "Everyone" || (access === "Host player" && isHostPlayer);

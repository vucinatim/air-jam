import {
  defineAirJamSettings,
  setting,
  type AirJamSettingsValues,
} from "@air-jam/sdk/core";

export const pongSettings = defineAirJamSettings({
  paddleSpeed: setting.number({
    default: 720,
    min: 360,
    max: 1440,
    step: 10,
    live: true,
  }),
  ballSpeed: setting.number({
    default: 360,
    min: 180,
    max: 720,
    step: 10,
    live: true,
  }),
  countdownSeconds: setting.number({
    default: 3,
    min: 1.5,
    max: 6,
    step: 1,
    live: true,
  }),
});
export type PongSettings = AirJamSettingsValues<typeof pongSettings>;

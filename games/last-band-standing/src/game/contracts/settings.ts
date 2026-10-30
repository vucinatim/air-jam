import {
  defineAirJamSettings,
  setting,
  type AirJamSettingsValues,
} from "@air-jam/sdk/core";
export const quizSettings = defineAirJamSettings({
  totalRounds: setting.number({
    default: 10,
    min: 5,
    max: 20,
    step: 1,
    live: true,
  }),
  roundDurationSec: setting.number({
    default: 30,
    min: 15,
    max: 60,
    step: 1,
    live: true,
  }),
  revealDurationSec: setting.number({
    default: 7,
    min: 3.5,
    max: 14,
    step: 1,
    live: true,
  }),
  matchStartCountdownSec: setting.number({
    default: 3,
    min: 1.5,
    max: 6,
    step: 1,
    live: true,
  }),
  optionCount: setting.number({
    default: 4,
    min: 2,
    max: 8,
    step: 1,
    live: true,
  }),
  streakFireMinRounds: setting.number({
    default: 2,
    min: 1,
    max: 4,
    step: 1,
    live: true,
  }),
});
export type QuizSettings = AirJamSettingsValues<typeof quizSettings>;

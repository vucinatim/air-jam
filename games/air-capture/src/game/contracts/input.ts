import {
  button,
  defineAirJamInput,
  stick,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/**
 * What each pilot controls: the flight stick (x turns, y climbs and dives),
 * the trigger, held to keep firing, and the ability, used once per press.
 */
export const airCaptureInput = defineAirJamInput({
  vector: stick(),
  action: button("held"),
  ability: button("pressed"),
});

export type GameLoopInput = AirJamInputValues<typeof airCaptureInput>;

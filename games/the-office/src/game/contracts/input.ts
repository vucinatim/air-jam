import {
  button,
  defineAirJamInput,
  stick,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/** What each worker controls: walking and the work button. */
export const officeInput = defineAirJamInput({
  move: stick(),
  action: button("held"),
});

export type GameInput = AirJamInputValues<typeof officeInput>;

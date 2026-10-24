import {
  arrows,
  button,
  defineAirJamInput,
  stick,
  wasd,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/** What each worker controls: walking and the work button. */
export const officeInput = defineAirJamInput(
  {
    move: stick(),
    action: button("held"),
  },
  {
    keyboard: [
      { move: wasd(), action: "Space" },
      { move: arrows(), action: "Enter" },
    ],
    gamepad: { move: "leftStick", action: "south" },
  },
);

export type GameInput = AirJamInputValues<typeof officeInput>;

import {
  arrows,
  button,
  defineAirJamInput,
  defineAirJamInputBindings,
  stick,
  wasd,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/** What each worker controls: walking and the work button. */
export const officeInput = defineAirJamInput({
  move: stick(),
  action: button("held"),
});

/** Keyboard layouts and gamepads that play as local players without a phone. */
export const officeInputBindings = defineAirJamInputBindings(officeInput, {
  keyboard: [
    { move: wasd(), action: "Space" },
    { move: arrows(), action: "Enter" },
  ],
  gamepad: { move: "leftStick", action: "south" },
});

export type GameInput = AirJamInputValues<typeof officeInput>;

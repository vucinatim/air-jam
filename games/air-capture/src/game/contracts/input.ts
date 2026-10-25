import {
  arrows,
  button,
  defineAirJamInput,
  defineAirJamInputBindings,
  stick,
  wasd,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/**
 * What each pilot controls: the flight stick (x turns; pushed up it climbs, pulled down it dives),
 * the trigger, held to keep firing, and the ability, used once per press.
 */
export const airCaptureInput = defineAirJamInput({
  vector: stick(),
  action: button("held"),
  ability: button("pressed"),
});

/** Keyboard layouts and gamepads that play as local players without a phone. */
export const airCaptureInputBindings = defineAirJamInputBindings(
  airCaptureInput,
  {
    keyboard: [
      { vector: wasd(), action: "Space", ability: "ShiftLeft" },
      { vector: arrows(), action: "Enter", ability: "ShiftRight" },
    ],
    gamepad: {
      vector: "leftStick",
      action: ["rightTrigger", "south"],
      ability: ["leftTrigger", "east"],
    },
  },
);

export type GameLoopInput = AirJamInputValues<typeof airCaptureInput>;

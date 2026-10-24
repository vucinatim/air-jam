import {
  arrows,
  button,
  defineAirJamInput,
  stick,
  wasd,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/**
 * What each pilot controls: the flight stick (x turns; pushed up it climbs, pulled down it dives),
 * the trigger, held to keep firing, and the ability, used once per press.
 */
export const airCaptureInput = defineAirJamInput(
  {
    vector: stick(),
    action: button("held"),
    ability: button("pressed"),
  },
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

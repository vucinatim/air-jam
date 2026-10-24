import {
  axis,
  button,
  defineAirJamInput,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/** What each fighter controls: movement, one punch per tap with each hand, and a held guard. */
export const codeReviewInput = defineAirJamInput({
  /** -1 moves up the screen, 1 down. */
  vertical: axis(),
  horizontal: axis(),
  leftPunch: button("pressed"),
  rightPunch: button("pressed"),
  defend: button("held"),
});

export type GameInput = AirJamInputValues<typeof codeReviewInput>;

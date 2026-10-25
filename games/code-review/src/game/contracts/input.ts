import {
  axis,
  button,
  defineAirJamInput,
  defineAirJamInputBindings,
  keyAxis,
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

/** Keyboard layouts and gamepads that play as local players without a phone. */
export const codeReviewInputBindings = defineAirJamInputBindings(
  codeReviewInput,
  {
    keyboard: [
      {
        vertical: keyAxis("KeyW", "KeyS"),
        horizontal: keyAxis("KeyA", "KeyD"),
        leftPunch: "KeyJ",
        rightPunch: "KeyK",
        defend: "KeyL",
      },
      {
        vertical: keyAxis("ArrowUp", "ArrowDown"),
        horizontal: keyAxis("ArrowLeft", "ArrowRight"),
        leftPunch: "Comma",
        rightPunch: "Period",
        defend: "Slash",
      },
    ],
    gamepad: {
      vertical: "leftStickY",
      horizontal: "leftStickX",
      leftPunch: "west",
      rightPunch: "east",
      defend: ["leftBumper", "rightBumper"],
    },
  },
);

export type GameInput = AirJamInputValues<typeof codeReviewInput>;

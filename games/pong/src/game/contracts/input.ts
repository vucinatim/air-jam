import {
  axis,
  defineAirJamInput,
  defineAirJamInputBindings,
  keyAxis,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/**
 * What each player controls: their paddle's direction, -1 up to 1 down.
 * W/S and the arrow keys are two keyboard players; each gamepad is one more.
 */
export const pongInput = defineAirJamInput({ direction: axis() });

/** Keyboard layouts and gamepads that play as local players without a phone. */
export const pongInputBindings = defineAirJamInputBindings(pongInput, {
  keyboard: [
    { direction: keyAxis("KeyW", "KeyS") },
    { direction: keyAxis("ArrowUp", "ArrowDown") },
  ],
  gamepad: { direction: "leftStickY" },
});

export type PongInput = AirJamInputValues<typeof pongInput>;

import {
  axis,
  defineAirJamInput,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

/** What each player controls: their paddle's direction, -1 up to 1 down. */
export const pongInput = defineAirJamInput({ direction: axis() });

export type PongInput = AirJamInputValues<typeof pongInput>;

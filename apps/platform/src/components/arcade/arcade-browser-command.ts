import { AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN } from "@air-jam/sdk/arcade/surface";
import {
  airJamArcadePlatformActions,
  arcadeBrowserConfirmPayloadSchema,
  arcadeBrowserNavigatePayloadSchema,
  type AirJamActionRpcPayload,
  type ArcadeBrowserDirection,
} from "@air-jam/sdk/protocol";
import {
  EXIT_COOLDOWN_MS,
  type ArcadeRuntimeState,
} from "./arcade-runtime-manager";
import type { ArcadeSurfaceState } from "./arcade-surface-types";

type BrowserCommand =
  | { type: "navigate"; direction: ArcadeBrowserDirection }
  | { type: "confirm"; selectedIndex: number };

/** Validate against live host state, not the controller's render or input stream. */
export const resolveArcadeBrowserCommand = ({
  event,
  mode,
  surface,
  runtime,
  players,
  gamesLength,
  now,
}: {
  event: AirJamActionRpcPayload;
  mode: "arcade" | "preview";
  surface: Pick<ArcadeSurfaceState, "kind" | "epoch">;
  runtime: ArcadeRuntimeState;
  players: readonly { id: string }[];
  gamesLength: number;
  now: number;
}): BrowserCommand | null => {
  if (
    event.storeDomain !== AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN ||
    event.actor.role !== "controller" ||
    !players.some((player) => player.id === event.actor.id) ||
    mode !== "arcade" ||
    surface.kind !== "browser" ||
    runtime.isLaunching ||
    runtime.launchCapability ||
    gamesLength <= 0
  ) {
    return null;
  }

  if (event.actionName === airJamArcadePlatformActions.navigate) {
    const payload = arcadeBrowserNavigatePayloadSchema.safeParse(event.payload);
    return payload.success && payload.data.epoch === surface.epoch
      ? { type: "navigate", direction: payload.data.direction }
      : null;
  }

  if (event.actionName === airJamArcadePlatformActions.confirm) {
    const payload = arcadeBrowserConfirmPayloadSchema.safeParse(event.payload);
    if (
      payload.success &&
      payload.data.epoch === surface.epoch &&
      now - runtime.lastExitAt >= EXIT_COOLDOWN_MS &&
      Number.isInteger(runtime.selectedIndex) &&
      runtime.selectedIndex >= 0 &&
      runtime.selectedIndex < gamesLength
    ) {
      return { type: "confirm", selectedIndex: runtime.selectedIndex };
    }
  }
  return null;
};

import type { JSX } from "react";
import { AirCaptureFlag } from "../flag";
import { AirCaptureJumpPad } from "../jump-pad";
import { AirCaptureObstacleBlock } from "../obstacle-block";
import { AirCapturePlayerBase } from "../player-base";
import {
  AIR_CAPTURE_ARENA_FLAG_INSTANCES,
  AIR_CAPTURE_ARENA_JUMP_PADS,
  AIR_CAPTURE_ARENA_OBSTACLES,
  AIR_CAPTURE_ARENA_PLAYER_BASE_INSTANCES,
} from "./layout";
import {
  resolveAirCaptureArenaProps,
  type AirCaptureArenaPrefabOverrides,
} from "./schema";
import { SpaceEnvironment } from "./space-environment";

export const paintAirCaptureArena = (
  overrides: AirCaptureArenaPrefabOverrides = {},
): JSX.Element => {
  const props = resolveAirCaptureArenaProps(overrides);

  return (
    <>
      <SpaceEnvironment props={props} />
      {AIR_CAPTURE_ARENA_OBSTACLES.map((obstacle, index) => (
        <AirCaptureObstacleBlock
          key={`obstacle-${index}`}
          position={obstacle.position}
          rotationY={obstacle.rotationY}
          size={obstacle.size}
        />
      ))}
      {AIR_CAPTURE_ARENA_PLAYER_BASE_INSTANCES.map((base) => (
        <AirCapturePlayerBase
          key={`base-${base.teamId}`}
          teamId={base.teamId}
        />
      ))}
      {AIR_CAPTURE_ARENA_FLAG_INSTANCES.map((flag) => (
        <AirCaptureFlag key={`flag-${flag.teamId}`} teamId={flag.teamId} />
      ))}
      {AIR_CAPTURE_ARENA_JUMP_PADS.map((pad) => (
        <AirCaptureJumpPad key={pad.id} id={pad.id} position={pad.position} />
      ))}
    </>
  );
};

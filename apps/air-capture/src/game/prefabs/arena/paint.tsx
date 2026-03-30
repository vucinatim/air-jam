import type { JSX } from "react";
import { resolveAirCaptureArenaProps, type AirCaptureArenaPrefabOverrides } from "./schema";
import { Flags } from "./flags";
import { JumpPads } from "./jump-pads";
import { Obstacles } from "./obstacles";
import { PlayerBases } from "./player-bases";
import { SpaceEnvironment } from "./space-environment";

export const paintAirCaptureArena = (
  overrides: AirCaptureArenaPrefabOverrides = {},
): JSX.Element => {
  const props = resolveAirCaptureArenaProps(overrides);

  return (
    <>
      <SpaceEnvironment props={props} />
      <Obstacles />
      <PlayerBases />
      <Flags />
      <JumpPads />
    </>
  );
};

export const AirCaptureArena = ({
  overrides,
}: {
  overrides?: AirCaptureArenaPrefabOverrides;
}) => {
  return paintAirCaptureArena(overrides);
};

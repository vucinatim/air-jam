import { z } from "zod";
import { TEAM_IDS } from "../../domain/team";

export const airCapturePlayerBasePrefabSchema = z.object({
  teamId: z.enum(TEAM_IDS),
});

export type AirCapturePlayerBasePrefabProps = z.infer<
  typeof airCapturePlayerBasePrefabSchema
>;

export const AIR_CAPTURE_PLAYER_BASE_DEFAULT_PROPS: AirCapturePlayerBasePrefabProps =
  airCapturePlayerBasePrefabSchema.parse({
    teamId: "solaris",
  });

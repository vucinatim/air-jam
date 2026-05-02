import { z } from "zod";
import { TEAM_IDS } from "../../domain/team";

export const airCaptureShipPrefabSchema = z.object({
  teamId: z.enum(TEAM_IDS),
  thrust: z.number().min(0).max(1),
});

export type AirCaptureShipPrefabProps = z.infer<
  typeof airCaptureShipPrefabSchema
>;

export const AIR_CAPTURE_SHIP_DEFAULT_PROPS: AirCaptureShipPrefabProps =
  airCaptureShipPrefabSchema.parse({
    teamId: "solaris",
    thrust: 0.55,
  });

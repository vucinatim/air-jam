import { z } from "zod";
import { TEAM_IDS } from "../../domain/team";

export const airCaptureFlagPrefabSchema = z.object({
  teamId: z.enum(TEAM_IDS),
});

export type AirCaptureFlagPrefabProps = z.infer<typeof airCaptureFlagPrefabSchema>;

export const AIR_CAPTURE_FLAG_DEFAULT_PROPS: AirCaptureFlagPrefabProps =
  airCaptureFlagPrefabSchema.parse({
    teamId: "solaris",
  });

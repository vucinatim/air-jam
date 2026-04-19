import { z } from "zod";
import { getTeamColor, type TeamId } from "../../domain/team";

const teamColorSchema = z.object({
  team1: z.string(),
  team2: z.string(),
}) satisfies z.ZodType<Record<TeamId, string>>;

export const pongArenaPrefabSchema = z.object({
  fieldWidth: z.number().positive(),
  fieldHeight: z.number().positive(),
  backgroundColor: z.string(),
  centerLineColor: z.string(),
  teamColors: teamColorSchema,
});

export type PongArenaPrefabProps = z.infer<typeof pongArenaPrefabSchema>;

export type PongArenaPrefabOverrides = Partial<
  Omit<PongArenaPrefabProps, "teamColors">
> & {
  teamColors?: Partial<Record<TeamId, string>>;
};

export const PONG_ARENA_DEFAULT_PROPS: PongArenaPrefabProps =
  pongArenaPrefabSchema.parse({
    fieldWidth: 1000,
    fieldHeight: 600,
    backgroundColor: "#09090b",
    centerLineColor: "#3f3f46",
    teamColors: {
      team1: getTeamColor("team1"),
      team2: getTeamColor("team2"),
    },
  });

export const resolvePongArenaProps = (
  overrides: PongArenaPrefabOverrides = {},
): PongArenaPrefabProps =>
  pongArenaPrefabSchema.parse({
    ...PONG_ARENA_DEFAULT_PROPS,
    ...overrides,
    teamColors: {
      ...PONG_ARENA_DEFAULT_PROPS.teamColors,
      ...overrides.teamColors,
    },
  });

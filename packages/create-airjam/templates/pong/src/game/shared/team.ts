export type TeamId = "team1" | "team2";

export const TEAMS: Record<
  TeamId,
  {
    id: TeamId;
    label: string;
    color: string;
  }
> = {
  team1: {
    id: "team1",
    label: "Solaris",
    color: "#f97316",
  },
  team2: {
    id: "team2",
    label: "Nebulon",
    color: "#38bdf8",
  },
};

export const oppositeTeam = (team: TeamId): TeamId =>
  team === "team1" ? "team2" : "team1";

export const getTeamLabel = (team: TeamId): string => TEAMS[team].label;

export const getTeamColor = (team: TeamId): string => TEAMS[team].color;

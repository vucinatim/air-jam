export const TEAM_CONFIG = {
  solaris: {
    id: "solaris",
    label: "Solaris",
    color: "#f97316",
    accent: "#fde047",
    basePosition: [-120, 0, 40] as [number, number, number],
  },
  nebulon: {
    id: "nebulon",
    label: "Nebulon",
    color: "#38bdf8",
    accent: "#a5f3fc",
    basePosition: [120, 0, -40] as [number, number, number],
  },
} as const;

export type TeamId = keyof typeof TEAM_CONFIG;

export const TEAM_IDS = Object.keys(TEAM_CONFIG) as TeamId[];

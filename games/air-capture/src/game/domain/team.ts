import { airCaptureTheme } from "../theme";
export const TEAM_CONFIG = {
  solaris: {
    id: "solaris",
    label: "Solaris",
    color: airCaptureTheme.colors.solaris,
    accent: airCaptureTheme.colors.solarisAccent,
    basePosition: [-120, 0, 40] as [number, number, number],
  },
  nebulon: {
    id: "nebulon",
    label: "Nebulon",
    color: airCaptureTheme.colors.nebulon,
    accent: airCaptureTheme.colors.nebulonAccent,
    basePosition: [120, 0, -40] as [number, number, number],
  },
} as const;

export type TeamId = keyof typeof TEAM_CONFIG;

export const TEAM_IDS = Object.keys(TEAM_CONFIG) as TeamId[];

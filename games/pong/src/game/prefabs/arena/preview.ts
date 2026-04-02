export interface PongArenaPrefabPreview {
  summary: string;
  accentColor: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export const PONG_ARENA_PREVIEW: PongArenaPrefabPreview = {
  summary: "A clean two-lane Pong arena with a centered divider and team-colored sides.",
  accentColor: "#38bdf8",
  dimensions: {
    width: 1000,
    height: 600,
  },
};

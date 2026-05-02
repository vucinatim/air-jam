import { TEAM_IDS } from "../../domain/team";

export interface ObstacleData {
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
}

export interface JumpPadData {
  id: string;
  position: [number, number, number];
}

export const AIR_CAPTURE_ARENA_OBSTACLES: ObstacleData[] = [
  { position: [30, 4, 20], rotationY: Math.PI / 4, size: [8, 8, 8] },
  { position: [-25, 4, 30], rotationY: Math.PI / 6, size: [8, 8, 8] },
  { position: [40, 4, -20], rotationY: Math.PI / 3, size: [8, 8, 8] },
  { position: [-35, 4, -25], rotationY: -Math.PI / 4, size: [8, 8, 8] },
  { position: [60, 4, 50], rotationY: Math.PI / 5, size: [8, 8, 8] },
  { position: [-50, 4, 60], rotationY: -Math.PI / 6, size: [8, 8, 8] },
  { position: [70, 4, -40], rotationY: Math.PI / 2, size: [8, 8, 8] },
  { position: [-60, 4, -50], rotationY: -Math.PI / 3, size: [8, 8, 8] },
  { position: [90, 4, 80], rotationY: Math.PI / 4, size: [8, 8, 8] },
  { position: [-80, 4, 90], rotationY: -Math.PI / 5, size: [8, 8, 8] },
  { position: [100, 4, -70], rotationY: Math.PI / 3, size: [8, 8, 8] },
  { position: [-90, 4, -80], rotationY: -Math.PI / 4, size: [8, 8, 8] },
  { position: [0, 4, 50], rotationY: Math.PI / 6, size: [8, 8, 8] },
  { position: [50, 4, 0], rotationY: -Math.PI / 4, size: [8, 8, 8] },
  { position: [-50, 4, 0], rotationY: Math.PI / 3, size: [8, 8, 8] },
  { position: [0, 4, -50], rotationY: -Math.PI / 6, size: [8, 8, 8] },
];

export const AIR_CAPTURE_ARENA_JUMP_PADS: JumpPadData[] = [
  { id: "jump-pad-1", position: [20, 0, 15] },
  { id: "jump-pad-2", position: [-15, 0, 25] },
  { id: "jump-pad-3", position: [30, 0, -15] },
  { id: "jump-pad-4", position: [-25, 0, -20] },
  { id: "jump-pad-5", position: [50, 0, 40] },
  { id: "jump-pad-6", position: [-40, 0, 50] },
  { id: "jump-pad-7", position: [60, 0, -30] },
  { id: "jump-pad-8", position: [-50, 0, -40] },
  { id: "jump-pad-9", position: [80, 0, 70] },
  { id: "jump-pad-10", position: [-70, 0, 80] },
  { id: "jump-pad-11", position: [90, 0, -60] },
  { id: "jump-pad-12", position: [-80, 0, -70] },
  { id: "jump-pad-13", position: [0, 0, 40] },
  { id: "jump-pad-14", position: [40, 0, 0] },
  { id: "jump-pad-15", position: [-40, 0, 0] },
  { id: "jump-pad-16", position: [0, 0, -40] },
];

export const AIR_CAPTURE_ARENA_FLAG_INSTANCES = TEAM_IDS.map((teamId) => ({
  teamId,
}));

export const AIR_CAPTURE_ARENA_PLAYER_BASE_INSTANCES = TEAM_IDS.map(
  (teamId) => ({
    teamId,
  }),
);

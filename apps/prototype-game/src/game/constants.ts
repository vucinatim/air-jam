export const ARENA_RADIUS = 200;

export const PLAYER_CAMERA_OFFSET = { x: 0, y: 5, z: 10 };
export const TOPDOWN_CAMERA_HEIGHT = 10;
export const PLAYER_MAX_SPEED = 35;
// Acceleration/deceleration rate (m/s²) - frame-rate independent
// Capped per-frame changes to prevent jumps at low frame rates
export const PLAYER_ACCELERATION = 60; // How fast we reach max speed
export const PLAYER_DECELERATION = 80; // How fast we stop (can be different from acceleration)
export const MAX_VELOCITY_CHANGE_PER_FRAME = 2.0; // Cap velocity change per frame (m/s) to prevent jumps
export const PLAYER_MAX_ANGULAR_VELOCITY = 4.0;
// Angular acceleration/deceleration rate (rad/s²) - frame-rate independent
export const PLAYER_ANGULAR_ACCELERATION = 10;
export const MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME = 0.3; // Cap angular velocity change per frame (rad/s)
// Input smoothing time constant (seconds to reach ~63% of target) - frame-rate independent
export const PLAYER_INPUT_SMOOTH_TIME = 0.15; // Increased for smoother input transitions

// Obstacle definitions - static data for bot AI and game logic
export interface ObstacleData {
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number]; // width, height, depth
}

export const OBSTACLES: ObstacleData[] = [
  // Center area obstacles
  {
    position: [30, 4, 20],
    rotationY: Math.PI / 4,
    size: [8, 8, 8],
  },
  {
    position: [-25, 4, 30],
    rotationY: Math.PI / 6,
    size: [8, 8, 8],
  },
  {
    position: [40, 4, -20],
    rotationY: Math.PI / 3,
    size: [8, 8, 8],
  },
  {
    position: [-35, 4, -25],
    rotationY: -Math.PI / 4,
    size: [8, 8, 8],
  },
  // Mid-range obstacles
  {
    position: [60, 4, 50],
    rotationY: Math.PI / 5,
    size: [8, 8, 8],
  },
  {
    position: [-50, 4, 60],
    rotationY: -Math.PI / 6,
    size: [8, 8, 8],
  },
  {
    position: [70, 4, -40],
    rotationY: Math.PI / 2,
    size: [8, 8, 8],
  },
  {
    position: [-60, 4, -50],
    rotationY: -Math.PI / 3,
    size: [8, 8, 8],
  },
  // Outer area obstacles
  {
    position: [90, 4, 80],
    rotationY: Math.PI / 4,
    size: [8, 8, 8],
  },
  {
    position: [-80, 4, 90],
    rotationY: -Math.PI / 5,
    size: [8, 8, 8],
  },
  {
    position: [100, 4, -70],
    rotationY: Math.PI / 3,
    size: [8, 8, 8],
  },
  {
    position: [-90, 4, -80],
    rotationY: -Math.PI / 4,
    size: [8, 8, 8],
  },
  // Additional scattered obstacles
  {
    position: [0, 4, 50],
    rotationY: Math.PI / 6,
    size: [8, 8, 8],
  },
  {
    position: [50, 4, 0],
    rotationY: -Math.PI / 4,
    size: [8, 8, 8],
  },
  {
    position: [-50, 4, 0],
    rotationY: Math.PI / 3,
    size: [8, 8, 8],
  },
  {
    position: [0, 4, -50],
    rotationY: -Math.PI / 6,
    size: [8, 8, 8],
  },
];

// Jump pad definitions - static data for bot AI and game logic
export interface JumpPadData {
  id: string;
  position: [number, number, number];
}

export const JUMP_PADS: JumpPadData[] = [
  // Center area jump pads
  {
    id: "jump-pad-1",
    position: [20, 0, 15],
  },
  {
    id: "jump-pad-2",
    position: [-15, 0, 25],
  },
  {
    id: "jump-pad-3",
    position: [30, 0, -15],
  },
  {
    id: "jump-pad-4",
    position: [-25, 0, -20],
  },

  // Mid-range jump pads
  {
    id: "jump-pad-5",
    position: [50, 0, 40],
  },
  {
    id: "jump-pad-6",
    position: [-40, 0, 50],
  },
  {
    id: "jump-pad-7",
    position: [60, 0, -30],
  },
  {
    id: "jump-pad-8",
    position: [-50, 0, -40],
  },

  // Outer area jump pads
  {
    id: "jump-pad-9",
    position: [80, 0, 70],
  },
  {
    id: "jump-pad-10",
    position: [-70, 0, 80],
  },
  {
    id: "jump-pad-11",
    position: [90, 0, -60],
  },
  {
    id: "jump-pad-12",
    position: [-80, 0, -70],
  },

  // Additional scattered jump pads
  {
    id: "jump-pad-13",
    position: [0, 0, 40],
  },
  {
    id: "jump-pad-14",
    position: [40, 0, 0],
  },
  {
    id: "jump-pad-15",
    position: [-40, 0, 0],
  },
  {
    id: "jump-pad-16",
    position: [0, 0, -40],
  },
];

// Jump pad constants
export const JUMP_PAD_RADIUS = 4;
export const JUMP_FORCE = 25;

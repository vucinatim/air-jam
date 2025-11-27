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

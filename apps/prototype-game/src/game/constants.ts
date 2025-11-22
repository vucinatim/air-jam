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

export const AIR_CAPTURE_SHIP_PREVIEW = {
  summary:
    "The standard playable ship unit used by controllers and bots during Air Capture matches.",
  accentColor: "#f97316",
  dimensions: {
    width: 4,
    height: 3,
    depth: 8,
  },
  camera: {
    position: [14, 8, 14],
    target: [0, 4.5, 0],
    fov: 34,
  },
} as const;

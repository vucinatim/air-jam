export const AIR_CAPTURE_FLAG_PREVIEW = {
  summary: "A team flag that can be carried, dropped, returned, and scored against bases.",
  accentColor: "#f97316",
  dimensions: {
    radius: 4.5,
    height: 6,
  },
  camera: {
    position: [10, 8, 10],
    target: [0, 3, 0],
    fov: 40,
  },
} as const;

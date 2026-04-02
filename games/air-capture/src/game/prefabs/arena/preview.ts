export interface AirCaptureArenaPrefabPreview {
  summary: string;
  accentColor: string;
  dimensions: {
    radius: number;
  };
}

export const AIR_CAPTURE_ARENA_PREVIEW: AirCaptureArenaPrefabPreview = {
  summary:
    "A large circular 3D arena with space lighting, forcefield bounds, obstacles, bases, flags, and jump pads.",
  accentColor: "#00e5ff",
  dimensions: {
    radius: 200,
  },
};

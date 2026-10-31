import { airCaptureTheme } from "../../theme";
export interface AirCaptureArenaPrefabPreview {
  summary: string;
  accentColor: string;
  dimensions: {
    radius: number;
  };
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
  };
}

export const AIR_CAPTURE_ARENA_PREVIEW: AirCaptureArenaPrefabPreview = {
  summary:
    "A large circular 3D arena with space lighting, forcefield bounds, obstacles, bases, flags, and jump pads.",
  accentColor: airCaptureTheme.colors.arenaPreviewAccent,
  dimensions: {
    radius: 200,
  },
  camera: {
    position: [180, 110, 180],
    target: [0, 0, 0],
    fov: 50,
  },
};

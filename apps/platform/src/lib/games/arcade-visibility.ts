import { z } from "zod";

export const arcadeVisibilityValues = ["hidden", "listed"] as const;
export type ArcadeVisibility = (typeof arcadeVisibilityValues)[number];
export const arcadeVisibilitySchema = z.enum(arcadeVisibilityValues);

export const getArcadeVisibilityLabel = (
  visibility: ArcadeVisibility,
): string => {
  switch (visibility) {
    case "listed":
      return "Listed in Arcade";
    case "hidden":
    default:
      return "Hidden from Arcade";
  }
};

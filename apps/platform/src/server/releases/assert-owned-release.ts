import { getReleaseDetails } from "./get-release-details";

export const assertOwnedRelease = async (releaseId: string, userId: string) => {
  const release = await getReleaseDetails(releaseId);
  if (!release) {
    throw new Error("Release not found or unauthorized");
  }

  if (release.game.userId !== userId) {
    throw new Error("Release not found or unauthorized");
  }

  return release;
};

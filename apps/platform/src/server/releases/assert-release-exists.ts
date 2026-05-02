import { getReleaseDetails } from "./get-release-details";

export const assertReleaseExists = async (releaseId: string) => {
  const release = await getReleaseDetails(releaseId);
  if (!release) {
    throw new Error("Release not found.");
  }

  return release;
};

import {
  getReleaseStorage,
  type CreateReleaseArtifactUploadTargetInput,
  type PutReleaseObjectInput,
  type ReleaseArtifactUploadTarget,
  type ReleaseStoredObjectHead,
  type ReleaseStorage,
} from "@/server/releases/release-storage";

export type GameMediaUploadTarget = ReleaseArtifactUploadTarget;
export type GameMediaStoredObjectHead = ReleaseStoredObjectHead;
export type CreateGameMediaUploadTargetInput =
  CreateReleaseArtifactUploadTargetInput;
export type PutGameMediaObjectInput = PutReleaseObjectInput;

export type GameMediaStorage = Pick<
  ReleaseStorage,
  "createArtifactUploadTarget" | "headObject" | "readObject" | "putObject"
>;

let gameMediaStorageSingleton: GameMediaStorage | null = null;

export const getGameMediaStorage = (): GameMediaStorage => {
  if (!gameMediaStorageSingleton) {
    gameMediaStorageSingleton = getReleaseStorage();
  }

  return gameMediaStorageSingleton;
};

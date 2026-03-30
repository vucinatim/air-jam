import { createR2ReleaseStorage } from "./release-storage-r2";

export type ReleaseArtifactUploadTarget = {
  key: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type ReleaseStoredObjectHead = {
  key: string;
  sizeBytes: number;
  contentType: string | null;
  etag: string | null;
  lastModifiedAt: Date | null;
  metadata: Record<string, string>;
};

export type CreateReleaseArtifactUploadTargetInput = {
  key: string;
  contentType: string;
  originalFilename: string;
};

export type PutReleaseObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
};

export interface ReleaseStorage {
  createArtifactUploadTarget(
    input: CreateReleaseArtifactUploadTargetInput,
  ): Promise<ReleaseArtifactUploadTarget>;
  headObject(key: string): Promise<ReleaseStoredObjectHead | null>;
  readObject(key: string): Promise<Buffer>;
  putObject(input: PutReleaseObjectInput): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

let releaseStorageSingleton: ReleaseStorage | null = null;

export const getReleaseStorage = (): ReleaseStorage => {
  if (!releaseStorageSingleton) {
    releaseStorageSingleton = createR2ReleaseStorage();
  }

  return releaseStorageSingleton;
};

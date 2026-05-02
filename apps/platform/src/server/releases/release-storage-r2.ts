import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import {
  type ReleaseStorage,
  type ReleaseStoredObjectHead,
} from "./release-storage";
import { getReleaseStorageConfig } from "./release-storage-config";

const METADATA_ORIGINAL_FILENAME_KEY = "original-filename";

const normalizeMetadata = (
  metadata: Record<string, string> | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

const createR2Client = (): S3Client => {
  const config = getReleaseStorageConfig();
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    // R2 browser uploads work reliably with presigned PUT URLs only when the SDK
    // does not opportunistically inject checksum signing parameters.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const bodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (typeof body === "object" && body !== null) {
    const bodyWithTransform = body as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };

    if (typeof bodyWithTransform.transformToByteArray === "function") {
      return Buffer.from(await bodyWithTransform.transformToByteArray());
    }
  }

  if (body instanceof Readable) {
    return streamToBuffer(body);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  throw new Error("Unsupported R2 object body type.");
};

export const createR2ReleaseStorage = (): ReleaseStorage => {
  const config = getReleaseStorageConfig();
  const client = createR2Client();

  const headObject = async (
    key: string,
  ): Promise<ReleaseStoredObjectHead | null> => {
    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );

      return {
        key,
        sizeBytes: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
        etag: response.ETag ?? null,
        lastModifiedAt: response.LastModified ?? null,
        metadata: normalizeMetadata(response.Metadata),
      };
    } catch (error) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        typeof error.name === "string"
          ? error.name
          : null;

      if (errorCode === "NotFound" || errorCode === "NoSuchKey") {
        return null;
      }

      throw error;
    }
  };

  return {
    async createArtifactUploadTarget({ key, contentType, originalFilename }) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          [METADATA_ORIGINAL_FILENAME_KEY]: originalFilename,
        },
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: config.uploadUrlTtlSeconds,
      });

      return {
        key,
        method: "PUT",
        url,
        headers: {
          "content-type": contentType,
        },
        expiresAt: new Date(
          Date.now() + config.uploadUrlTtlSeconds * 1_000,
        ).toISOString(),
      };
    },

    headObject,

    async readObject(key) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new Error(`Release storage object has no body: ${key}`);
      }

      return bodyToBuffer(response.Body);
    },

    async putObject({ key, body, cacheControl, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          CacheControl: cacheControl,
          ContentType: contentType,
        }),
      );
    },

    async deletePrefix(prefix) {
      let continuationToken: string | undefined;

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        const keys = (response.Contents ?? [])
          .map((item) => item.Key)
          .filter((value): value is string => Boolean(value));

        if (keys.length > 0) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: config.bucket,
              Delete: {
                Objects: keys.map((key) => ({ Key: key })),
                Quiet: true,
              },
            }),
          );
        }

        continuationToken = response.IsTruncated
          ? response.NextContinuationToken
          : undefined;
      } while (continuationToken);
    },
  };
};

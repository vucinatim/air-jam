const RELEASE_FILENAME_METADATA_VERSION = "utf8";

export const encodeReleaseFilenameMetadata = (filename: string): string =>
  `${RELEASE_FILENAME_METADATA_VERSION}.${Buffer.from(filename, "utf8").toString("base64url")}`;

export const decodeReleaseFilenameMetadata = (value: string): string => {
  const [version, encoded, ...extra] = value.split(".");
  if (
    version !== RELEASE_FILENAME_METADATA_VERSION ||
    !encoded ||
    extra.length > 0 ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw new Error("Release filename metadata is malformed.");
  }

  const filename = Buffer.from(encoded, "base64url").toString("utf8");
  if (encodeReleaseFilenameMetadata(filename) !== value) {
    throw new Error("Release filename metadata is not canonical UTF-8.");
  }
  return filename;
};

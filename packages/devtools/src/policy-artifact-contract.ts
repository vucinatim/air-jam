import { z } from "zod";

export const policyArtifactPathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.startsWith("/") &&
      value
        .split("/")
        .every((part) => part !== "" && part !== "." && part !== ".."),
    "Artifacts require canonical relative paths.",
  );
export const policyArtifactManifestSchema = z
  .object({
    version: z.literal(1),
    provenance: z.record(z.string().min(1).max(80), z.json()),
    files: z
      .array(
        z
          .object({
            path: policyArtifactPathSchema,
            bytes: z
              .number()
              .int()
              .positive()
              .max(4 * 1024 ** 3),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.files.map((file) => file.path)).size ===
        value.files.length &&
      value.files.reduce((bytes, file) => bytes + file.bytes, 0) <=
        4 * 1024 ** 3,
    "Artifact files must be unique and fit the 4 GiB bundle allowance.",
  );
export const policyArtifactReceiptSchema = z
  .object({
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    manifest: policyArtifactManifestSchema,
    verifyMs: z.number().finite().nonnegative(),
  })
  .strict();

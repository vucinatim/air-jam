import { z } from "zod";
import { dependencyInstallObservationSchema } from "./dependency-install-contract.js";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const gameBuildManifestSchema = z.object({
  version: z.literal(1),
  buildKey: digest,
  sourceHash: digest,
  lockfileHash: digest,
  distHash: digest,
  toolchain: z.object({
    node: z.string(),
    pnpm: z.string(),
    devtools: z.string(),
    platform: z.string(),
    architecture: z.string(),
    implementationHash: digest,
    environmentHash: digest,
    projectRoot: z.string().min(1),
    nodeAbi: z.string(),
  }),
  dependencies: z.object({
    installedTreeHash: digest,
    installedLockfileHash: digest,
    installation: dependencyInstallObservationSchema,
  }),
  createdAt: z.iso.datetime(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        bytes: z.number().int().nonnegative(),
        sha256: digest,
      }),
    )
    .min(1)
    .max(100_000),
  sourceArchive: z.object({
    bytes: z.number().int().nonnegative(),
    sha256: digest,
  }),
});
export const gameBuildIdentitySchema = gameBuildManifestSchema.omit({
  files: true,
  sourceArchive: true,
});
export const pinnedGameBuildSchema = z.object({
  rootDir: z.string().min(1),
  distDir: z.string().min(1),
  configPath: z.string().min(1),
  manifestPath: z.string().min(1),
  sourceArchivePath: z.string().min(1),
  manifest: gameBuildManifestSchema,
  reused: z.boolean(),
});
export type PinnedGameBuild = z.infer<typeof pinnedGameBuildSchema>;
export const gameBuildResultSchema = z.discriminatedUnion("ok", [
  z.object({
    type: z.literal("air-jam-game-build/v1"),
    ok: z.literal(true),
    build: pinnedGameBuildSchema,
  }),
  z.object({
    type: z.literal("air-jam-game-build/v1"),
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export const gameBuildMarkerSchema = z
  .object({ buildKey: digest, projectRoot: z.string().min(1) })
  .strict();

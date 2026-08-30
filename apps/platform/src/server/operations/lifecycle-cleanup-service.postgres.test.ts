import * as schema from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getOperationalJob,
  replayOperationalJob,
} from "../jobs/operational-job-service";
import {
  operationalJobExecutors,
  runOperationalJobWorkerCycle,
} from "../jobs/operational-job-worker";
import type {
  ReleaseStorage,
  ReleaseStoredObjectSummary,
} from "../releases/release-storage";
import { executeLifecycleCleanupJobAttempt } from "./lifecycle-cleanup-job-executor";
import {
  inspectLifecycleCleanupCandidates,
  scheduleLifecycleCleanup,
} from "./lifecycle-cleanup-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

describeWithPostgres("lifecycle cleanup PostgreSQL authority", () => {
  const client = postgres(databaseUrl!, { max: 6 });
  const database = drizzle(client, { schema });
  const suffix = crypto.randomUUID();
  const creatorId = `cleanup_creator_${suffix}`;
  const gameId = `cleanup_game_${suffix}`;
  const releaseId = `cleanup_release_${suffix}`;
  const generationId = `cleanup_generation_${suffix}`;
  const mediaId = `cleanup_media_${suffix}`;
  const baseTime = new Date("2020-01-01T00:00:00.000Z");
  const planningTime = new Date();
  const generationRoot = `games/${gameId}/releases/${releaseId}/generations/${generationId}`;
  const mediaRoot = `games/${gameId}/media/thumbnail/${mediaId}`;
  const objectsByPrefix = new Map<string, ReleaseStoredObjectSummary[]>([
    [
      generationRoot,
      [
        {
          key: `${generationRoot}/source/artifact.zip`,
          sizeBytes: 100,
          etag: "generation-etag",
          lastModifiedAt: baseTime,
        },
      ],
    ],
    [
      mediaRoot,
      [
        {
          key: `${mediaRoot}/source.png`,
          sizeBytes: 50,
          etag: "media-etag",
          lastModifiedAt: baseTime,
        },
      ],
    ],
  ]);
  let deletedKeys: string[] = [];
  let listedPrefixes: string[] = [];
  let failNextDelete = false;
  const storage: ReleaseStorage = {
    createArtifactUploadTarget: async () => {
      throw new Error("not used");
    },
    headObject: async () => null,
    readObject: async () => Buffer.alloc(0),
    putObject: async () => undefined,
    listObjects: async (prefix) => {
      listedPrefixes.push(prefix);
      return objectsByPrefix.get(prefix) ?? [];
    },
    deleteObjects: async (keys) => {
      if (failNextDelete) {
        failNextDelete = false;
        const partiallyDeletedKeys = keys.slice(0, 1);
        deletedKeys.push(...partiallyDeletedKeys);
        for (const [prefix, objects] of objectsByPrefix) {
          objectsByPrefix.set(
            prefix,
            objects.filter(
              (object) => !partiallyDeletedKeys.includes(object.key),
            ),
          );
        }
        throw new Error("simulated object-store outage");
      }
      deletedKeys.push(...keys);
      for (const [prefix, objects] of objectsByPrefix) {
        objectsByPrefix.set(
          prefix,
          objects.filter((object) => !keys.includes(object.key)),
        );
      }
    },
    deletePrefix: async () => undefined,
  };
  const executors = {
    ...operationalJobExecutors,
    cleanup: (input: Parameters<typeof executeLifecycleCleanupJobAttempt>[0]) =>
      executeLifecycleCleanupJobAttempt({ ...input, storage }),
  };

  beforeAll(async () => {
    await database.insert(schema.users).values({
      id: creatorId,
      name: "Lifecycle cleanup creator",
      email: `${creatorId}@example.invalid`,
      emailVerified: true,
      createdAt: baseTime,
      updatedAt: baseTime,
    });
    await database.insert(schema.games).values({
      id: gameId,
      userId: creatorId,
      name: "Lifecycle cleanup game",
      config: {},
      createdAt: baseTime,
      updatedAt: baseTime,
    });
  });

  beforeEach(async () => {
    await database
      .delete(schema.operationalJobs)
      .where(eq(schema.operationalJobs.creatorId, creatorId));
    await database
      .delete(schema.operationalJobCommands)
      .where(
        inArray(schema.operationalJobCommands.actor, [
          "test:lifecycle-cleanup",
          "test:lifecycle-replay",
        ]),
      );
    await database
      .delete(schema.gameMediaAssets)
      .where(eq(schema.gameMediaAssets.gameId, gameId));
    await database
      .delete(schema.gameReleases)
      .where(eq(schema.gameReleases.gameId, gameId));
    await database.insert(schema.gameReleases).values({
      id: releaseId,
      gameId,
      sourceKind: "upload",
      status: "failed",
      createdAt: baseTime,
      checkedAt: baseTime,
    });
    await database.insert(schema.gameReleaseGenerations).values({
      id: generationId,
      releaseId,
      sequence: 1,
      status: "failed",
      originalFilename: "game.zip",
      contentType: "application/zip",
      declaredSizeBytes: 100,
      zipObjectKey: `${generationRoot}/source/artifact.zip`,
      createdAt: baseTime,
      failedAt: baseTime,
    });
    await database.insert(schema.gameMediaAssets).values({
      id: mediaId,
      gameId,
      kind: "thumbnail",
      status: "archived",
      originalFilename: "thumbnail.png",
      mimeType: "image/png",
      sizeBytes: 50,
      storageKey: `${mediaRoot}/source.png`,
      inactiveAt: baseTime,
      createdAt: baseTime,
      updatedAt: baseTime,
    });
    objectsByPrefix.set(generationRoot, [
      {
        key: `${generationRoot}/source/artifact.zip`,
        sizeBytes: 100,
        etag: "generation-etag",
        lastModifiedAt: baseTime,
      },
    ]);
    objectsByPrefix.set(mediaRoot, [
      {
        key: `${mediaRoot}/source.png`,
        sizeBytes: 50,
        etag: "media-etag",
        lastModifiedAt: baseTime,
      },
    ]);
    deletedKeys = [];
    listedPrefixes = [];
    failNextDelete = false;
  });

  afterAll(async () => {
    await database
      .delete(schema.operationalJobs)
      .where(eq(schema.operationalJobs.creatorId, creatorId));
    await database
      .delete(schema.operationalJobCommands)
      .where(
        inArray(schema.operationalJobCommands.actor, [
          "test:lifecycle-cleanup",
          "test:lifecycle-replay",
        ]),
      );
    await database
      .delete(schema.gameMediaAssets)
      .where(eq(schema.gameMediaAssets.gameId, gameId));
    await database
      .delete(schema.gameReleases)
      .where(eq(schema.gameReleases.gameId, gameId));
    await database.delete(schema.games).where(eq(schema.games.id, gameId));
    await database.delete(schema.users).where(eq(schema.users.id, creatorId));
    await client.end();
  });

  it("previews exact bytes, schedules idempotently, and tombstones both resource classes", async () => {
    const preview = await inspectLifecycleCleanupCandidates({
      database,
      storage,
      now: planningTime,
    });
    expect(
      preview.candidates.map((candidate) => ({
        resourceKind: candidate.resourceKind,
        objectCount: candidate.objectCount,
        bytes: candidate.bytes,
      })),
    ).toEqual([
      { resourceKind: "release_generation", objectCount: 1, bytes: 100 },
      { resourceKind: "game_media_asset", objectCount: 1, bytes: 50 },
    ]);

    const scheduled = await scheduleLifecycleCleanup({
      database,
      actor: "test:lifecycle-cleanup",
      reason: "Prove exact lifecycle cleanup.",
      idempotencyKey: `${suffix}:cleanup-batch`,
      now: planningTime,
    });
    const replayed = await scheduleLifecycleCleanup({
      database,
      actor: "test:lifecycle-cleanup",
      reason: "Prove exact lifecycle cleanup.",
      idempotencyKey: `${suffix}:cleanup-batch`,
      now: planningTime,
    });
    expect(scheduled.replayed).toBe(false);
    expect(replayed.replayed).toBe(true);
    expect(replayed.jobs).toEqual(scheduled.jobs);

    for (let index = 0; index < 2; index += 1) {
      await expect(
        runOperationalJobWorkerCycle({
          kind: "lifecycle_cleanup",
          workerId: `worker:lifecycle:${index}`,
          database,
          executors,
        }),
      ).resolves.toMatchObject({ status: "succeeded" });
    }
    expect(deletedKeys.sort()).toEqual(
      [
        `${generationRoot}/source/artifact.zip`,
        `${mediaRoot}/source.png`,
      ].sort(),
    );
    const [generation, media, jobs] = await Promise.all([
      database.query.gameReleaseGenerations.findFirst({
        where: (table, { eq }) => eq(table.id, generationId),
      }),
      database.query.gameMediaAssets.findFirst({
        where: (table, { eq }) => eq(table.id, mediaId),
      }),
      database.query.operationalJobs.findMany({
        where: (table, { eq }) => eq(table.kind, "lifecycle_cleanup"),
      }),
    ]);
    expect(generation?.storageDeletedAt).toBeInstanceOf(Date);
    expect(media?.storageDeletedAt).toBeInstanceOf(Date);
    expect(jobs.map((job) => job.result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bytesDeleted: 100, objectCount: 1 }),
        expect.objectContaining({ bytesDeleted: 50, objectCount: 1 }),
      ]),
    );
  });

  it("retains a failed deletion manifest and replays cleanup safely", async () => {
    await database
      .update(schema.gameMediaAssets)
      .set({
        storageDeletedAt: planningTime,
        storageCleanupStartedAt: planningTime,
      })
      .where(eq(schema.gameMediaAssets.id, mediaId));
    const scheduled = await scheduleLifecycleCleanup({
      database,
      actor: "test:lifecycle-cleanup",
      reason: "Prove retry-safe cleanup.",
      idempotencyKey: `${suffix}:cleanup-retry`,
      now: planningTime,
    });
    expect(scheduled.jobs).toHaveLength(1);
    failNextDelete = true;
    const first = await runOperationalJobWorkerCycle({
      kind: "lifecycle_cleanup",
      workerId: "worker:lifecycle:retry-one",
      database,
      executors,
    });
    expect(first.status).toBe("retried");
    const jobId = scheduled.jobs[0]!.id;
    const failedAttempt = await getOperationalJob({ database, jobId });
    expect(failedAttempt.attempts[0]?.privateData.hasOutputManifest).toBe(true);
    objectsByPrefix.set(generationRoot, [
      {
        key: `${generationRoot}/late-object.txt`,
        sizeBytes: 25,
        etag: "late-etag",
        lastModifiedAt: planningTime,
      },
    ]);

    const replay = await replayOperationalJob({
      database,
      jobId,
      actor: "test:lifecycle-replay",
      reason: "Explicitly replay terminal cleanup only if needed.",
      idempotencyKey: `${suffix}:not-terminal-yet`,
      now: planningTime,
    }).catch((error: unknown) => error);
    expect(replay).toBeInstanceOf(Error);

    await database
      .update(schema.operationalJobs)
      .set({ availableAt: new Date("2020-01-01T00:00:00.000Z") })
      .where(eq(schema.operationalJobs.id, jobId));
    await expect(
      runOperationalJobWorkerCycle({
        kind: "lifecycle_cleanup",
        workerId: "worker:lifecycle:retry-two",
        database,
        executors,
      }),
    ).resolves.toMatchObject({ status: "succeeded" });
    expect(
      listedPrefixes.filter((prefix) => prefix === generationRoot),
    ).toHaveLength(1);
    expect(deletedKeys).not.toContain(`${generationRoot}/late-object.txt`);
    expect(objectsByPrefix.get(generationRoot)).toEqual([
      expect.objectContaining({ key: `${generationRoot}/late-object.txt` }),
    ]);
  });

  it("schedules and replays cleanup through the canonical repo CLI", () => {
    const runCli = () =>
      JSON.parse(
        execFileSync(
          "pnpm",
          [
            "--silent",
            "run",
            "repo",
            "--",
            "platform",
            "operations",
            "lifecycle",
            "cleanup",
            "--actor",
            "test:lifecycle-cleanup",
            "--reason",
            "Prove the canonical agent cleanup path.",
            "--idempotency-key",
            `${suffix}:cleanup-cli`,
            "--apply",
            "--json",
          ],
          {
            cwd: repoRoot,
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: databaseUrl! },
          },
        ),
      ) as Record<string, unknown>;

    const first = runCli();
    expect(first).toMatchObject({
      command: "lifecycle-cleanup",
      applied: true,
      result: {
        replayed: false,
        candidates: [
          {
            resourceKind: "release_generation",
            privateData: { hasStorageRootKey: true },
          },
          {
            resourceKind: "game_media_asset",
            privateData: { hasStorageRootKey: true },
          },
        ],
        jobs: [
          { kind: "lifecycle_cleanup", resourceKind: "release_generation" },
          { kind: "lifecycle_cleanup", resourceKind: "game_media_asset" },
        ],
      },
    });
    expect(JSON.stringify(first)).not.toContain(generationRoot);
    expect(JSON.stringify(first)).not.toContain(mediaRoot);
    expect(runCli()).toMatchObject({
      result: { replayed: true },
    });
  });
});

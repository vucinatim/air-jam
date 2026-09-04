import { platformSchemaHead } from "@/db/platform-schema-head.generated";
import { describe, expect, it, vi } from "vitest";
import {
  classifyPlatformSchemaHead,
  readPlatformSchemaCompatibility,
} from "./platform-schema-compatibility";

describe("platform schema compatibility", () => {
  it("accepts only the exact generated migration head", () => {
    expect(
      classifyPlatformSchemaHead({
        createdAt: platformSchemaHead.createdAt,
        hash: platformSchemaHead.hash,
      }),
    ).toMatchObject({ status: "ready", compatible: true, reason: null });

    expect(
      classifyPlatformSchemaHead({
        createdAt: platformSchemaHead.createdAt - 1,
        hash: platformSchemaHead.hash,
      }),
    ).toMatchObject({
      status: "behind",
      compatible: false,
      reason: "database_schema_behind",
    });

    expect(
      classifyPlatformSchemaHead({
        createdAt: platformSchemaHead.createdAt,
        hash: "0".repeat(64),
      }),
    ).toMatchObject({
      status: "drifted",
      compatible: false,
      reason: "migration_hash_mismatch",
    });
  });

  it("distinguishes a corrupt journal head from unavailable authority", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([{ relation: "drizzle.__drizzle_migrations" }])
      .mockResolvedValueOnce([{ hash: "bad", created_at: "not-a-number" }]);

    await expect(
      readPlatformSchemaCompatibility({ database: { execute } as never }),
    ).resolves.toMatchObject({
      status: "drifted",
      compatible: false,
      reason: "migration_journal_corrupt",
    });
  });
});

import { platformDatabaseClient } from "@/db";
import postgres from "postgres";

type PlatformDatabaseClient = ReturnType<typeof postgres>;

const migrationLifecycleLockScope = "airjam:platform-schema-migration";

export const acquirePlatformSchemaMigrationLock = async ({
  client = platformDatabaseClient,
}: {
  client?: PlatformDatabaseClient;
} = {}): Promise<() => Promise<void>> => {
  const connection = await client.reserve();
  let acquired = false;
  try {
    const [row] = await connection<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${migrationLifecycleLockScope})) as acquired
    `;
    if (!row?.acquired) {
      throw new Error(
        "Another platform schema migration lifecycle operation is in progress.",
      );
    }
    acquired = true;
  } catch (error) {
    await connection.release();
    throw error;
  }

  return async () => {
    if (!acquired) return;
    acquired = false;
    try {
      await connection`
        select pg_advisory_unlock(hashtext(${migrationLifecycleLockScope}))
      `;
    } finally {
      await connection.release();
    }
  };
};

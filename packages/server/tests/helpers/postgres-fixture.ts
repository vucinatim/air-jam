import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { randomUUID } from "node:crypto";
import { connect, createServer, type Socket } from "node:net";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

export const validateLocalDatabaseUrl = (value: string | undefined): URL => {
  if (!value)
    throw new Error(
      "Set AIR_JAM_TEST_DATABASE_URL to a local PostgreSQL connection with CREATE DATABASE permission.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PostgreSQL fixtures require a valid loopback URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    [...url.searchParams.keys()].some((key) =>
      ["host", "hostaddr", "port", "dbname", "database"].includes(key),
    )
  ) {
    throw new Error(
      "PostgreSQL fixtures accept only an explicit loopback target without routing overrides.",
    );
  }
  return url;
};

// This proxy owns only the new fixture database's client path. Its fault switch
// cannot pause the shared PostgreSQL server or disrupt normal development.
export const createDatabaseFaultProxy = async (target: URL) => {
  validateLocalDatabaseUrl(target.toString());
  const sockets = new Set<Socket>();
  let interrupted = false;
  const proxy = createServer((socket) => {
    if (interrupted) {
      socket.destroy();
      return;
    }
    const upstream = connect({
      host: target.hostname.replace(/^\[|\]$/g, ""),
      port: Number(target.port || 5432),
    });
    for (const peer of [socket, upstream]) {
      sockets.add(peer);
      peer.on("error", () => {
        socket.destroy();
        upstream.destroy();
      });
      peer.on("close", () => {
        sockets.delete(peer);
        socket.destroy();
        upstream.destroy();
      });
    }
    socket.pipe(upstream).pipe(socket);
  });
  await new Promise<void>((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", resolve);
  });
  const address = proxy.address();
  if (!address || typeof address === "string")
    throw new Error("Database proxy did not bind.");
  const url = new URL(target);
  url.hostname = "127.0.0.1";
  url.port = String(address.port);
  return {
    url: url.toString(),
    interrupt: () => {
      interrupted = true;
      for (const socket of sockets) socket.destroy();
    },
    restore: () => {
      interrupted = false;
    },
    close: async () => {
      interrupted = true;
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
};

/** Owns a fresh migrated database, without application-specific seed data. */
export const createDisposablePostgresDatabase = async (
  baseUrl: URL,
  runId: string,
) => {
  validateLocalDatabaseUrl(baseUrl.toString());
  const name = `airjam_test_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const onnotice = (notice: postgres.Notice) =>
    console.error(`[postgres-fixture] ${notice.message}`);
  const admin = postgres(adminUrl.toString(), {
    max: 1,
    onnotice,
    connection: { application_name: `${runId}:setup` },
  });
  let created = false;
  let observer: ReturnType<typeof postgres> | undefined;
  const cleanup = async () => {
    try {
      await observer?.end({ timeout: 5 });
      if (created) {
        // Name is generated here, never a caller-provided or existing database.
        await admin`set lock_timeout = '5s'`;
        await admin.unsafe(`drop database "${name}"`);
        created = false;
      }
    } finally {
      await admin.end({ timeout: 5 });
    }
  };
  try {
    await admin.unsafe(`create database "${name}"`);
    created = true;
    const url = new URL(baseUrl);
    url.pathname = `/${name}`;
    observer = postgres(url.toString(), {
      max: 1,
      onnotice,
      connection: { application_name: `${runId}:observer` },
    });
    await migrate(drizzle(observer), {
      migrationsFolder: fileURLToPath(
        new URL("../../../../apps/platform/drizzle", import.meta.url),
      ),
    });
    return { name, url, observer, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

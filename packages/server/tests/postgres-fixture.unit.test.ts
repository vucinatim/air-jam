import { once } from "node:events";
import { connect, createServer, type Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDatabaseFaultProxy,
  createDisposablePostgresDatabase,
  validateLocalDatabaseUrl,
} from "./helpers/postgres-fixture.js";

const mocks = vi.hoisted(() => ({ postgres: vi.fn(), migrate: vi.fn() }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: (client: unknown) => client,
}));
vi.mock("drizzle-orm/postgres-js/migrator", () => ({ migrate: mocks.migrate }));

const fakeClient = () =>
  Object.assign(
    vi.fn(async () => []),
    {
      unsafe: vi.fn(async (_query: string) => []),
      end: vi.fn(async (_options: { timeout: number }) => undefined),
    },
  );

describe("disposable PostgreSQL fixture safety", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["127.0.0.1", "localhost", "[::1]"])(
    "accepts explicit loopback %s",
    (host) => {
      expect(
        validateLocalDatabaseUrl(
          `postgresql://user:secret@${host}:55432/dev?sslmode=disable`,
        ).hostname,
      ).toBe(host);
    },
  );

  it.each([
    undefined,
    "postgres://user:secret@[broken/dev",
    "https://user:secret@localhost/dev",
    "postgres://user:secret@database.example/dev",
    "postgres://user:secret@127.0.0.1.evil.example/dev",
    ...["host", "hostaddr", "port", "dbname", "database"].map(
      (key) => `postgres://user:secret@localhost/dev?${key}=remote`,
    ),
  ])(
    "rejects unsafe targets without retaining their credentials (%#)",
    (value) => {
      let error: unknown;
      try {
        validateLocalDatabaseUrl(value);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain("secret");
      expect(JSON.stringify(error)).not.toContain("secret");
      expect(error).not.toHaveProperty("input");
      expect(error).not.toHaveProperty("cause");
    },
  );

  it("revalidates exported IO entrypoints before opening clients", async () => {
    const remote = new URL("postgres://user:secret@database.example/dev");
    await expect(
      createDisposablePostgresDatabase(remote, "test-run"),
    ).rejects.toThrow("loopback");
    await expect(createDatabaseFaultProxy(remote)).rejects.toThrow("loopback");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });

  it("migrates and drops only its generated database, with notices on stderr", async () => {
    const admin = fakeClient(),
      observer = fakeClient();
    mocks.postgres.mockReturnValueOnce(admin).mockReturnValueOnce(observer);
    const base = new URL(
      "postgres://user:secret@127.0.0.1:55432/existing_dev?sslmode=disable",
    );
    const original = base.toString();
    const fixture = await createDisposablePostgresDatabase(base, "test-run");
    expect(fixture.name).toMatch(/^airjam_test_[a-f0-9]{32}$/);
    expect(base.toString()).toBe(original);
    expect(new URL(mocks.postgres.mock.calls[0]![0]).pathname).toBe(
      "/postgres",
    );
    expect(new URL(mocks.postgres.mock.calls[1]![0]).pathname).toBe(
      `/${fixture.name}`,
    );
    expect(fixture.url.pathname).toBe(`/${fixture.name}`);
    expect(fixture.url.search).toBe(base.search);
    expect(admin.unsafe).toHaveBeenCalledExactlyOnceWith(
      `create database "${fixture.name}"`,
    );
    expect(mocks.migrate).toHaveBeenCalledExactlyOnceWith(observer, {
      migrationsFolder: fileURLToPath(
        new URL("../../../apps/platform/drizzle", import.meta.url),
      ),
    });
    expect(observer).not.toHaveBeenCalled(); // No application-specific seeds.
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const call of mocks.postgres.mock.calls)
        call[1].onnotice({ message: "migration notice" });
      expect(stderr).toHaveBeenCalledTimes(2);
    } finally {
      stderr.mockRestore();
    }
    await fixture.cleanup();
    expect(observer.end).toHaveBeenCalledExactlyOnceWith({ timeout: 5 });
    expect(admin.unsafe).toHaveBeenLastCalledWith(
      `drop database "${fixture.name}"`,
    );
    expect(admin.end).toHaveBeenCalledExactlyOnceWith({ timeout: 5 });
  });

  it("cleans up its new database when migrations fail", async () => {
    const admin = fakeClient(),
      observer = fakeClient();
    mocks.postgres.mockReturnValueOnce(admin).mockReturnValueOnce(observer);
    const failure = new Error("migration failed");
    mocks.migrate.mockRejectedValueOnce(failure);
    await expect(
      createDisposablePostgresDatabase(
        new URL("postgres://localhost/dev"),
        "test-run",
      ),
    ).rejects.toBe(failure);
    const created = admin.unsafe.mock.calls[0]![0];
    expect(admin.unsafe).toHaveBeenLastCalledWith(
      created.replace("create database", "drop database"),
    );
    expect(observer.end).toHaveBeenCalledOnce();
    expect(admin.end).toHaveBeenCalledOnce();
  });

  it("does not drop any database after CREATE fails", async () => {
    const admin = fakeClient();
    mocks.postgres.mockReturnValueOnce(admin);
    admin.unsafe.mockRejectedValueOnce(new Error("create denied"));
    await expect(
      createDisposablePostgresDatabase(
        new URL("postgres://localhost/dev"),
        "test-run",
      ),
    ).rejects.toThrow("create denied");
    expect(admin.unsafe).toHaveBeenCalledOnce();
    expect(admin.end).toHaveBeenCalledOnce();
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it("closes the admin client even if observer cleanup fails", async () => {
    const admin = fakeClient(),
      observer = fakeClient();
    mocks.postgres.mockReturnValueOnce(admin).mockReturnValueOnce(observer);
    const fixture = await createDisposablePostgresDatabase(
      new URL("postgres://localhost/dev"),
      "test-run",
    );
    observer.end.mockRejectedValueOnce(new Error("observer close failed"));
    await expect(fixture.cleanup()).rejects.toThrow("observer close failed");
    expect(admin.end).toHaveBeenCalledOnce();
  });
});

describe("PostgreSQL fixture fault proxy", () => {
  it("interrupts only proxied sockets and restores fresh connections", async () => {
    const sockets = new Set<Socket>();
    const upstream = createServer((socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
      socket.pipe(socket);
    });
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const address = upstream.address();
    if (!address || typeof address === "string")
      throw new Error("Echo fixture did not bind");
    const target = new URL(
      `postgres://user:secret@127.0.0.1:${address.port}/isolated_fixture?sslmode=disable`,
    );
    const proxy = await createDatabaseFaultProxy(target);
    const clients: Socket[] = [];
    const open = async (url: URL) => {
      const socket = connect({ host: url.hostname, port: Number(url.port) });
      clients.push(socket);
      socket.on("error", () => {});
      socket.setTimeout(2000, () =>
        socket.destroy(new Error("Echo fixture timeout")),
      );
      await once(socket, "connect");
      return socket;
    };
    const echo = async (socket: Socket, text: string) => {
      const received = once(socket, "data");
      socket.write(text);
      expect(String((await received)[0])).toBe(text);
    };
    let closed = false;
    try {
      const proxied = new URL(proxy.url);
      expect(proxied.pathname).toBe(target.pathname);
      expect(proxied.search).toBe(target.search);
      expect(proxied.password).toBe(target.password);
      const direct = await open(target);
      const active = await open(proxied);
      await echo(active, "before interruption");
      const activeClosed = once(active, "close");
      proxy.interrupt();
      await activeClosed;
      const rejected = await open(proxied);
      await once(rejected, "close");
      await echo(direct, "upstream is unaffected");
      proxy.restore();
      const restored = await open(proxied);
      await echo(restored, "after recovery");
      const restoredClosed = once(restored, "close");
      await proxy.close();
      closed = true;
      await restoredClosed;
      await expect(open(proxied)).rejects.toMatchObject({
        code: "ECONNREFUSED",
      });
    } finally {
      for (const socket of clients) socket.destroy();
      if (!closed) await proxy.close();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setImmediate } from "node:timers/promises";
import postgres from "postgres";
import {
  createDatabaseFaultProxy,
  validateLocalDatabaseUrl,
} from "../helpers/postgres-fixture.js";

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

async function main() {
  const target = validateLocalDatabaseUrl(
    process.env.AIR_JAM_TEST_DATABASE_URL,
  );
  assert.match(target.pathname, /^\/airjam_test_[a-f0-9]{32}$/);
  const proxy = await createDatabaseFaultProxy(target);
  let closed = deferred();
  const dispatched = deferred();
  const shutdown = process.argv[2].startsWith("shutdown-");
  const interruptedQueries =
    process.argv[2] === "shutdown-partial-reuse" ? 3 : 1;
  let dispatchedQueries = 0;
  const driver: typeof postgres =
    process.argv[3] === "cjs"
      ? (createRequire(import.meta.url)("postgres") as typeof postgres)
      : postgres;
  // postgres-js supports this pipeline cap but omits it from its Options type.
  const options: postgres.Options<Record<string, never>> & {
    max_pipeline: number;
  } = {
    max: shutdown ? 10 : 1,
    max_pipeline: 1,
    connect_timeout: 2,
    backoff: () => 0,
    onclose: () => closed.resolve(),
    debug: (_connection, query) => {
      if (
        query === "select pg_sleep(2)" &&
        ++dispatchedQueries === interruptedQueries
      )
        dispatched.resolve();
    },
  };
  const sql = driver(proxy.url, options);
  const disconnected = async () => {
    const signal = closed.promise;
    proxy.interrupt();
    await signal;
    process.stdout.write("connection closed\n");
    closed = deferred();
    proxy.restore();
  };

  try {
    switch (process.argv[2]) {
      case "shutdown-pending":
      case "shutdown-healthy": {
        const healthy = process.argv[2] === "shutdown-healthy";
        const outcome = sql.unsafe("select pg_sleep(2)").then(
          () => true,
          () => false,
        );
        await dispatched.promise;
        await setImmediate();
        let ended = false;
        const ending = sql.end().then(() => {
          ended = true;
        });
        await setImmediate();
        assert.equal(
          ended,
          false,
          "normal shutdown must wait for the active query",
        );
        if (!healthy) await disconnected();
        assert.equal(
          await outcome,
          healthy,
          "healthy query must finish; interrupted query must reject",
        );
        process.stdout.write("waiting for pending shutdown\n");
        await ending;
        break;
      }
      case "shutdown-disconnected":
      case "shutdown-partial-reuse": {
        const outcomes = Promise.allSettled(
          Array.from({ length: interruptedQueries }, () =>
            sql.unsafe("select pg_sleep(2)").execute(),
          ),
        );
        await dispatched.promise;
        await setImmediate();
        await disconnected();
        assert(
          (await outcomes).every((result) => result.status === "rejected"),
          "every interrupted query must reject before shutdown",
        );
        if (interruptedQueries > 1) {
          assert.equal((await sql`select 42 as value`)[0]!.value, 42);
        }
        // Exercise normal production shutdown, not the forced timeout: 0 used
        // in fixture cleanup. Unreused closed slots must not await a phantom query.
        process.stdout.write("ending disconnected pool\n");
        await sql.end();
        process.stdout.write("disconnected pool ended\n");
        break;
      }
      case "rollback": {
        // The failed query makes postgres-js's transaction scope attempt rollback.
        // Its old connection has already closed; rollback must reject, not write
        // into that dead socket or leave the transaction hanging indefinitely.
        const outcome = sql
          .begin(async (transaction) => {
            await transaction.unsafe("select pg_sleep(2)");
          })
          .then(
            () => null,
            (error) => error as unknown,
          );
        await dispatched.promise;
        await setImmediate();
        await disconnected();
        const failure = await outcome;
        assert(failure instanceof Error, "interrupted transaction must reject");
        await setImmediate();
        await setImmediate();
        const recovered = await sql`select 42 as value`;
        assert.equal(recovered[0]!.value, 42);
        break;
      }
      case "stale-transaction": {
        // Use a real table: reconnecting intentionally loses session-local state.
        await sql`create table if not exists reconnect_ownership_proof(value text)`;
        await sql`truncate reconnect_ownership_proof`;
        const entered = deferred();
        const resume = deferred();
        const attempted = deferred<unknown>();
        const outcome = sql
          .begin(async (transaction) => {
            entered.resolve();
            await resume.promise;
            try {
              await transaction`insert into reconnect_ownership_proof values ('stale')`;
              attempted.resolve(null);
            } catch (error) {
              attempted.resolve(error);
            }
            // Returning also attempts COMMIT through the now-stale scoped handle.
          })
          .then(
            () => null,
            (error) => error as unknown,
          );
        await entered.promise;
        await disconnected();
        assert(
          (await outcome) instanceof Error,
          "old transaction must reject on disconnect",
        );
        await sql.begin(async (fresh) => {
          const before = await fresh`select txid_current()::text as id`;
          resume.resolve();
          assert(
            (await attempted.promise) instanceof Error,
            "stale write must reject after connection reuse",
          );
          await setImmediate();
          await setImmediate();
          const after = await fresh`select txid_current()::text as id`;
          assert.equal(
            after[0]!.id,
            before[0]!.id,
            "stale COMMIT must not end the fresh transaction",
          );
          await fresh`insert into reconnect_ownership_proof values ('fresh')`;
        });
        assert.deepEqual(
          Array.from(await sql`select value from reconnect_ownership_proof`),
          [{ value: "fresh" }],
        );
        break;
      }
      case "reserved-release": {
        const reserved = await sql.reserve();
        process.stdout.write("reservation acquired\n");
        await reserved`select 1`;
        process.stdout.write("reserved query completed\n");
        await disconnected();
        reserved.release();
        process.stdout.write("old reservation released\n");
        const fresh = await sql.reserve();
        process.stdout.write("fresh reservation acquired\n");
        try {
          assert.equal((await fresh`select 42 as value`)[0]!.value, 42);
          // A delayed duplicate release must not release someone else's lease.
          reserved.release();
          assert.equal((await fresh`select 43 as value`)[0]!.value, 43);
        } finally {
          fresh.release();
        }
        assert.equal((await sql`select 44 as value`)[0]!.value, 44);
        break;
      }
      case "queued-transaction":
      case "queued-reserved": {
        const runQueued = async (
          connection: postgres.TransactionSql | postgres.ReservedSql,
        ) => {
          const queries = [
            connection.unsafe("select pg_sleep(2)").execute(),
            connection`select 2`.execute(),
            connection`select 3`.execute(),
            connection`select 4`.execute(),
          ];
          const outcomes = Promise.allSettled(queries);
          await dispatched.promise;
          await setImmediate();
          await disconnected();
          const results = await outcomes;
          assert(
            results.every((result) => result.status === "rejected"),
            "all in-flight and privately queued queries must reject",
          );
        };
        if (process.argv[2] === "queued-reserved") {
          const reserved = await sql.reserve();
          process.stdout.write("queued reservation acquired\n");
          try {
            await runQueued(reserved);
          } finally {
            reserved.release();
          }
        } else {
          let completion: Promise<void> | undefined;
          const outcome = sql
            .begin((connection) => (completion = runQueued(connection)))
            .then(
              () => null,
              (error) => error as unknown,
            );
          // begin rejects on close even if its callback's private queue hangs;
          // separately awaiting callback completion proves every query settles.
          assert((await outcome) instanceof Error);
          await completion;
        }
        assert.equal((await sql`select 42 as value`)[0]!.value, 42);
        break;
      }
      default:
        throw new Error("Unknown reconnect regression scenario");
    }
    process.stdout.write("reconnect regression passed\n");
  } finally {
    await sql.end({ timeout: 0 });
    await proxy.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted]")
      : "Reconnect regression failed",
  );
  process.exitCode = 1;
});

# Dependency repairs

## postgres 3.4.7: connection ownership and closure

`postgres@3.4.7.patch` corrects the database driver's ownership boundary, without
changing Air Jam's SQL, schema, room contracts, or database adapter.

An interrupted transaction can attempt rollback through its dead connection.
A previously released reserved handle can also put that connection back into
the open pool, or interfere with a newer owner after reconnection. The patch:

- checks the exact reservation identity before scoped queries and release
- rejects stale queries with the driver's existing `CONNECTION_CLOSED` error
- settles privately queued queries when their connection closes
- clears settled query/result state on socket closure and completes a pending
  shutdown, so unused disconnected pool slots cannot wait for a phantom query
- applies the same correction to ESM, CommonJS, and Cloudflare source variants

This intentionally does not suppress `socket.write` errors or add retries.
Rejecting invalid ownership preserves failure semantics and lets the ordinary
pool establish a fresh connection. Upstream context:
[issue 1066](https://github.com/porsager/postgres/issues/1066) and
[PR 1168](https://github.com/porsager/postgres/pull/1168). The null-write guard
proposed there alone does not prove settlement or prevent stale transaction
work from reaching a reused connection.

The pnpm lockfile pins the patch. Deployment dependency stages copy this
directory before frozen installation. The published server bundles the driver
and its Drizzle adapter; npm consumers must not depend on a patch installed only
in the maintainer's checkout. Postgres.js uses the Unlicense; its upstream
package source and version remain authoritative outside this explicit diff.

Regression proof is opt-in because it creates a fresh disposable database and
deliberately faults subprocess connections. With a loopback
`AIR_JAM_TEST_DATABASE_URL` configured:

```bash
AIR_JAM_POSTGRES_DRIVER_RECONNECT=1 pnpm --filter @air-jam/server exec vitest run tests/postgres-reconnect.postgres.test.ts
```

The matrix covers both ESM and CommonJS: rollback, stale transaction ownership,
reserved release, queued work, shutdown after partial/no pool reuse, shutdown
already waiting during disconnection, and healthy in-flight query draining.

Before changing the driver version or removing this patch, run that regression,
the actual launch-load recovery smoke, and the server artifact proof. A newer
version or an absent crash alone does not prove that stale work rejects and
fresh transactions remain intact. Never restore the unpatched runtime path
for one delivery surface while retaining the correction in another.

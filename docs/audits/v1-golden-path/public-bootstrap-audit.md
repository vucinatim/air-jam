# Public Bootstrap Audit

Last updated: 2026-08-29

Status: Gate `G2-02` independently reviewed and re-proved

## Question

Can the exact Air Jam 1.0 candidate package graph be installed and discovered
from outside the monorepo without `workspace:`, `link:`, `file:`, private path,
or unpublished-package fallback behavior?

## Important Registry Distinction

The current public npm release is not the candidate architecture:

1. `create-airjam@0.9.2`, `@air-jam/sdk@0.9.2`,
   `@air-jam/mcp-server@0.9.2`, and `@air-jam/server@0.9.2` exist on npm
2. `@air-jam/cli` does not yet exist on npm
3. a direct public probe successfully installed, typechecked, tested, and built
   the old `create-airjam@0.9.2` minimal project, but that project still gives
   ongoing lifecycle ownership to `@air-jam/server`

That probe is useful historical evidence, but it cannot certify the
post-canonicalization candidate. Publishing `@air-jam/cli` or changing public
dist-tags is an external release action and was intentionally not performed in
this autonomous gate.

The candidate proof therefore uses a fresh loopback npm registry. The exact
public package tarballs produced by the candidate are published to that
run-scoped registry, while all non-Air-Jam dependencies are proxied from
`registry.npmjs.org`. The registry explicitly does not proxy `@air-jam/*` or
`create-airjam`, so a missing candidate package fails instead of silently
falling back to an old public version.

This proves package contents, published manifests, registry resolution,
installation, generated-project contracts, and machine discovery. Gate 6 and
the final release rehearsal still own proof against the real public npm
registry and supported OS/Node matrix.

## Canonical Machine Proof

```bash
pnpm --silent run repo -- golden-path bootstrap --json
```

The command owns the complete disposable lifecycle:

1. build and pack the five public packages
2. start an authenticated run-scoped Verdaccio registry on loopback
3. publish only the exact candidate tarballs
4. create and install the `minimal` scaffold through registry package specs
5. positively bind registry metadata and every installed Air Jam package to
   the SHA-512 integrity of the exact packed tarball
6. reject forbidden dependency specs and private monorepo paths
7. discover CLI, root dev, session, release, MCP doctor, and project-scoped
   Codex configuration surfaces
8. initialize raw MCP STDIO and verify all `24` standalone tools, including the
   required semantic-session tools
9. start, inspect, and stop the managed root development loop on a run-owned
   Vite port
10. pass generated-project typecheck, lint, tests, and production build
11. stop the registry and remove the run-owned workspace unless retention was
    explicitly requested

Progress is written to stderr. With `pnpm --silent` and `--json`, stdout is one
stable JSON result document.

## Measured Passing Run

The independently reviewed candidate proof passed again on 2026-08-29 with:

1. all five candidate packages at version `0.9.2`
2. registry metadata integrity equal to each newly packed tarball and generated
   lockfile integrity equal to the exact four installed Air Jam package
   tarballs; an ambient scoped-registry override can no longer produce a false
   pass against old public bytes
3. no workspace, link, file, run-owned, or monorepo path resolution
4. generated `dev`, `status`, `reset:local`, `mcp`, and `lint` scripts asserted
   as required rather than filtered into the report
5. a present portable MCP declaration and a valid project-scoped Codex profile
6. raw MCP initialization plus exactly `24` discovered Air Jam tools, including
   inspect, open/read/invoke/close semantic session operations
7. MCP server identity reporting the actual installed package version instead
   of a hard-coded future version
8. managed dev start/status/stop on a run-owned Vite port and generated-project
   typecheck/lint/test/build
9. bounded command, MCP request, registry metadata, and workspace-build lock
   waits with explicit spawn, signal, parse, and timeout failures
10. automatic removal of the disposable workspace and registry

The initial proof attempts also found and closed harness defects rather than
being discarded: tarball path normalization happened too early, registry auth
was not configured, Verdaccio's default request-size ceiling was below the
candidate package, pnpm 9 did not accept a registry flag in the attempted
position, and the expected project mode was named incorrectly. Independent
review then found that the original result checked configured registry and
installed versions but did not bind installed bytes to the newly packed
tarballs. `G2-02` was reopened until the positive integrity proof above passed.

The proof also exposed one product contract defect: MCP initialization reported
hard-coded version `1.0.0` while the installed package was `0.9.2`. The server
now reads its identity from its shipped package manifest, and an MCP client test
prevents version drift.

The reviewed replay exposed another product contract defect: standalone dev
honored a configured `VITE_PORT`, while `airjam topology` discarded that parsed
value and advertised port `5173`. This made managed readiness wait on a URL that
did not belong to the process it started. Topology now derives host,
controller, socket, and public URLs from the same runtime port, with a direct
regression test.

## Package Measurements

| Package               | Candidate tarball bytes |
| --------------------- | ----------------------: |
| `@air-jam/sdk`        |               1,234,331 |
| `@air-jam/cli`        |                 364,299 |
| `@air-jam/mcp-server` |                 639,017 |
| `@air-jam/server`     |                 151,319 |
| `create-airjam`       |              87,264,876 |

`create-airjam` is large because it embeds all six scaffold archives, led by
the asset-heavy `air-capture` template. This did not block the functional
bootstrap proof, but it is material installation friction and must be judged
with explicit package-size and cold-install budgets in Gate 6. It is not hidden
as a generic suggestion or treated as already acceptable.

## Code Defects Closed

The repository's immutable local candidate-package helper omitted
`@air-jam/cli` even though generated projects require it. The candidate package
set now derives the same five package names as the canonical public release
graph, with a contract test preventing future drift.

The shared MCP STDIO probe now rejects malformed stdout through the requesting
promise and always stops its child instead of throwing from an event handler.
Both the candidate bootstrap and packed-scaffold smoke use that one probe.

The package-build lock and every bootstrap subprocess now have bounded waits,
and a managed dev process is marked cleanup-eligible before its JSON result is
parsed. Autonomous runs therefore fail explicitly instead of hanging forever
or leaking a successfully started process after malformed output.

## Residual Boundary

Gate `G2-02` proves the exact candidate package graph and bootstrap contract
without local dependency shortcuts. It does not claim:

1. that the candidate packages have already been published to npm
2. that the 87 MB scaffold package has acceptable final launch ergonomics
3. that Codex has completed the full Signal Relay authoring loop
4. that Claude Desktop's current extension packaging has passed
5. that hosted staging release and verification have passed

Those are intentionally owned by Gates `G2-03` through `G2-05`, Gate 6, and
the final immutable release rehearsal.

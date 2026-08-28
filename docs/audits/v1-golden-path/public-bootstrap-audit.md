# Public Bootstrap Audit

Last updated: 2026-08-28

Status: Gate `G2-02` evidence

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
5. reject forbidden dependency specs and private monorepo paths
6. discover CLI, root dev, session, release, MCP doctor, and project-scoped
   Codex configuration surfaces
7. initialize raw MCP STDIO and verify the required semantic-session tools
8. start, inspect, and stop the managed root development loop
9. pass generated-project typecheck, tests, and production build
10. stop the registry and remove the run-owned workspace unless retention was
    explicitly requested

Progress is written to stderr. With `pnpm --silent` and `--json`, stdout is one
stable JSON result document.

## Measured Passing Run

The candidate proof passed on 2026-08-28 with:

1. all five candidate packages at version `0.9.2`
2. no workspace, link, file, or monorepo path resolution
3. generated `dev`, `status`, `reset:local`, and `mcp` scripts
4. a present portable MCP declaration and a valid project-scoped Codex profile
5. raw MCP initialization plus `24` discovered Air Jam tools, including
   inspect, open/read/invoke/close semantic session operations
6. MCP server identity reporting the actual installed package version instead
   of a hard-coded future version
7. managed dev start/status/stop and generated-project typecheck/test/build
8. automatic removal of the disposable workspace and registry

The initial proof attempts also found and closed harness defects rather than
being discarded: tarball path normalization happened too early, registry auth
was not configured, Verdaccio's default request-size ceiling was below the
candidate package, pnpm 9 did not accept a registry flag in the attempted
position, and the expected project mode was named incorrectly. These were
harness classifications, not hidden product workarounds.

The proof also exposed one product contract defect: MCP initialization reported
hard-coded version `1.0.0` while the installed package was `0.9.2`. The server
now reads its identity from its shipped package manifest, and an MCP client test
prevents version drift.

## Package Measurements

| Package               | Candidate tarball bytes |
| --------------------- | ----------------------: |
| `@air-jam/sdk`        |               1,234,331 |
| `@air-jam/cli`        |                 362,580 |
| `@air-jam/mcp-server` |                 384,905 |
| `@air-jam/server`     |                 151,299 |
| `create-airjam`       |              87,264,734 |

`create-airjam` is large because it embeds all six scaffold archives, led by
the asset-heavy `air-capture` template. This did not block the functional
bootstrap proof, but it is material installation friction and must be judged
with explicit package-size and cold-install budgets in Gate 6. It is not hidden
as a generic suggestion or treated as already acceptable.

## Code Defect Closed

The repository's immutable local candidate-package helper omitted
`@air-jam/cli` even though generated projects require it. The candidate package
set now derives the same five package names as the canonical public release
graph, with a contract test preventing future drift.

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

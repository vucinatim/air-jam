# Public Package Support Contract

Last updated: 2026-08-30

Status: canonical 1.0 candidate contract

## Public Package Graph

Air Jam publishes one coordinated five-package graph:

1. `@air-jam/sdk`
2. `@air-jam/cli`
3. `@air-jam/mcp-server`
4. `@air-jam/server`
5. `create-airjam`

All five packages use one version during the 1.0 release line. Generated
projects receive mutually compatible versions from the packaged scaffold
manifest. The publish workflow orders the graph so a package is never released
before its Air Jam dependencies exist.

The public package graph may not contain `workspace:`, `link:`, `file:`, a
private monorepo path, or a dependency on an unpublished Air Jam package after
packing.

## Certified Runtime Matrix

Air Jam 1.0 certifies the following matrix:

| Operating-system family | GitHub proof runner | Node.js 22 LTS | Node.js 24 LTS |
| ----------------------- | ------------------- | -------------- | -------------- |
| Linux                   | `ubuntu-latest`     | required       | required       |
| macOS                   | `macos-latest`      | required       | required       |
| Windows                 | `windows-latest`    | required       | required       |

Node.js 20 is not part of the 1.0 contract because it reached end of life in 2026. Node.js 22 and 24 are the supported LTS release lines at the time of this
decision. The package manifests declare `node >=22.0.0`; newer Node versions are
not artificially rejected, but a non-LTS or future release is not certified
until it joins the matrix. See the Node.js project's
[release lifecycle](https://nodejs.org/en/about/previous-releases).

The operating-system claim covers the current GitHub-hosted runner family and
the architecture recorded in each evidence document. It does not claim every
historical OS version or CPU architecture.

## Canonical Machine Proof

The support contract is discoverable and executable without reading workflow
YAML:

```bash
pnpm --silent run repo -- release install-matrix spec --json
pnpm --silent run repo -- release install-matrix verify --json
pnpm --silent run repo -- release install-matrix aggregate \
  --evidence-root <downloaded-cell-evidence> \
  --json
```

The canonical source is
`scripts/repo/programs/public-install-matrix.json`. The GitHub workflow runs
all six cells and retains one JSON document per cell plus one aggregate
document. Aggregation fails unless every cell proves the same exact commit.

Each candidate cell must prove:

1. the exact five public packages build and pack
2. candidate bytes publish to a run-scoped registry
3. the registry never proxies `@air-jam/*` or `create-airjam`
4. `npx --yes create-airjam@<candidate-version>` creates and installs a clean
   project
5. installed lockfile integrity matches the exact packed tarballs
6. no local dependency spec or private repository path survives
7. `create-airjam`, `airjam`, `air-jam-server`, and `airjam-mcp` report their
   installed version
8. CLI help, JSON doctor/config, and MCP initialization/tool discovery work
9. managed development start, status, and stop work
10. generated-project typecheck, lint, tests, and production build pass
11. package-size, scaffold-install, and total-cell budgets pass

## Candidate Versus Public npm

The matrix intentionally proves unpublished candidate bytes before any public
mutation. It uses a fresh registry with npm only as the upstream for non-Air
Jam dependencies. This makes pull-request proof repeatable and prevents an old
public Air Jam version from producing a false pass.

The final release rehearsal publishes one immutable candidate to the npm
prerelease channel under explicit production approval, reruns the same
installation contract against those public bytes, and verifies SHA-512 and
provenance before promotion. Candidate proof does not claim that an unpublished
version already exists on npm.

## Budgets

The machine manifest owns launch budgets rather than prose or CI YAML:

1. per-package tarball byte ceilings
2. one total public-graph tarball ceiling
3. a ten-minute cold scaffold-and-install ceiling per cell
4. a thirty-minute complete cell ceiling

`create-airjam` currently carries the six version-matched templates and has a
larger explicit ceiling than the runtime packages. The measured value remains
visible in every run; growth cannot occur silently. Reducing that package is a
product optimization, while crossing the declared ceiling is a release failure.

## Compatibility And Upgrade Policy

After 1.0:

1. documented public exports, commands, JSON schemas, MCP tools, and error
   semantics follow semantic versioning
2. a supported Node LTS line is removed only in a major Air Jam release or
   after its upstream end-of-life with an announced support change
3. generated projects upgrade the coordinated Air Jam package graph together
4. private modules and undocumented behavior receive no compatibility promise
5. the self-hosted development/runtime lane must continue to work without an
   Air Jam platform account; Arcade publication remains an optional hosted
   capability

# Air Jam Public Package Release Workflow

Last updated: 2026-09-04

Status: canonical workflow

Related docs:

1. [Public Package Release Trust Contract](../contracts/public-package-release-trust-contract.md)
2. [Public Package Support Contract](../contracts/public-package-support-contract.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)

## Canonical Model

Air Jam releases the complete five-package public graph as one immutable
candidate. GitHub Actions builds and packs the graph once, retains its identity
and dependency evidence, sends those exact bytes through all six supported
installation-matrix cells, and publishes only those bytes through npm trusted
publishing.

There is one path:

1. merge the reviewed release commit to `main`
2. manually dispatch `publish-packages.yml` from `main`
3. let the workflow create one immutable candidate
4. validate the same candidate on Linux, macOS, and Windows with Node.js 22 and
   24
5. publish its exact tarballs using npm OIDC and provenance
6. verify registry integrity, provenance, and the requested dist-tag
7. create package tags and GitHub releases only after the complete graph is
   verified

Partial package releases, tag-triggered publishing, local npm-token publishing,
and rebuilds inside the privileged job are not supported.

## Coordinated Package Graph

The release unit is:

1. `@air-jam/sdk`
2. `@air-jam/mcp-server`
3. `@air-jam/cli`
4. `@air-jam/server`
5. `create-airjam`

All five packages use one version. Publication follows dependency order so an
Air Jam package is never published before its public Air Jam dependency.

## One-Time npm Configuration

npm trusted publishing must be configured independently for all five package
names. For each package, configure:

1. provider: GitHub Actions
2. organization or user: `vucinatim`
3. repository: `air-jam`
4. workflow filename: `publish-packages.yml`
5. environment: blank unless the workflow and every npm trusted-publisher
   record are deliberately migrated together

The workflow requires npm CLI 11.5.1 or newer for trusted publishing. Air Jam
pins the exact npm version used by the release workflow rather than resolving a
mutable `latest` version. npm's current setup requirements are documented in
[Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/).

After trusted publishing is proven, no `NPM_TOKEN` repository secret or legacy
automation token should remain.

## Prepare The Release Commit

Update all five package versions intentionally and keep the public graph
coordinated. Before merging, run the normal staged development gates and the
final release gate required by the release process.

The workflow itself runs the remote publish gate before it creates a candidate:

```bash
pnpm check:release:publish
```

Candidate creation then records:

1. the exact full source commit
2. Node.js, npm, pnpm, and package-manager versions
3. root manifest and lockfile digests
4. prepared public dependency declarations
5. a normalized production dependency inventory
6. a production license inventory with no missing entries, including
   exact-version npm metadata for platform-specific packages absent from the
   candidate runner
7. a bounded OSV batch query over the exact resolved production inventory that
   blocks any known finding
8. every tarball's name, size, SHA-256 digest, and npm SHA-512 integrity
9. one deterministic candidate digest over all immutable identity fields

The creator requires a clean tracked checkout before and after building. It
writes through a private staging directory and exposes the candidate only after
strict validation succeeds.

## Agent And Maintainer Interface

Discover the complete machine surface through:

```bash
pnpm run repo -- release --help
pnpm run repo -- release candidate --help
```

Useful read and proof commands are:

```bash
pnpm --silent run repo -- release candidate verify \
  --candidate <candidate-directory> \
  --expected-commit <full-git-sha> \
  --json

pnpm --silent run repo -- release install-matrix spec --json

pnpm --silent run repo -- release install-matrix verify \
  --candidate <candidate-directory> \
  --expected-os <linux|macos|windows> \
  --expected-node <22|24> \
  --json
```

Normal release dispatch:

```bash
pnpm run repo -- release trigger --channel latest
```

The trigger command always targets `main` and always dispatches the complete
public graph.

## Workflow Trust Boundaries

The jobs deliberately have different authority:

1. `candidate` can read source, install dependencies, build, audit, and upload
   the immutable candidate artifact; it has no npm OIDC or source-write access
2. `verify` cells can read source and candidate bytes, install into isolated
   registries, and upload evidence; they have no publish authority
3. `aggregate` rejects missing, duplicate, unexpected, mixed-commit,
   mixed-candidate, or mixed-package-digest cell evidence
4. `publish` has npm OIDC but only source read access; it installs no repository
   dependencies and runs the small standalone exact-tarball publisher
5. `finalize` receives source write access only after npm publication and
   verification complete

All third-party GitHub Actions are pinned to full commit SHAs with readable
version comments. Dependabot proposes action updates for normal reviewed
changes.

## Retry And Partial External State

A workflow retry may reconcile state; it may not redefine it.

For every already-existing package version, the publisher requires npm's
reported integrity to equal the candidate's exact integrity and requires a
valid npm provenance attestation. Different bytes at the same version are a
hard failure. A missing or stale dist-tag may be reconciled only after exact
package identity is proven.

New package versions are first published under one candidate-specific temporary
tag. The requested `next` or `latest` channel is reconciled only after all five
versions have exact integrity and provenance, then the temporary tag is
removed. A failed publish may therefore leave an immutable version discoverable
by its exact version or candidate tag, but it cannot partially move the public
coordinated channel.

Tags must resolve to the candidate commit. Existing GitHub releases are updated
with the retained candidate, matrix, and publication evidence rather than
silently pointing at a different source identity.

## Emergency Release

An emergency release uses the same workflow:

```bash
pnpm run repo -- release trigger \
  --channel latest \
  --emergency-reason "Describe the active incident and why release is urgent"
```

The reason is retained in publication evidence and must be meaningful. Urgency
may shorten observation time, but it does not bypass source review, candidate
creation, matrix proof, OIDC, provenance, or post-publish verification.

If GitHub Actions or npm trusted publishing is unavailable, publication waits.
There is no local token fallback. A compromised existing version can be
deprecated or its access revoked through explicit npm account operations while
the corrected version follows this same path.

## Final 1.0 Rehearsal Boundary

The first real prerelease and the later `latest` promotion are Gate 7 production
checkpoints. Their retained evidence must prove:

1. all npm trusted-publisher records were configured for the exact workflow
2. all six matrix cells consumed the same candidate digest and package bytes
3. npm integrity equals the candidate integrity for all five packages
4. provenance exists for every published package
5. the requested dist-tag resolves to the coordinated version
6. package tags and GitHub releases resolve to the candidate commit

Candidate and workflow implementation makes this proof executable; it does not
pre-claim success before the registry rehearsal actually runs.

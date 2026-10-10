# Public Package Release Trust Contract

Last updated: 2026-10-10

Status: canonical 1.0 release contract

## Purpose

An Air Jam public-package release is one immutable six-package candidate. The
bytes that pass validation are the only bytes npm may receive. A release retry
may reconcile already-completed external state, but it may not rebuild,
silently replace, or partially redefine the candidate.

This contract closes the trust boundary between source, GitHub Actions, npm,
the public installation matrix, and the agent-facing guidance shipped inside
the CLI.

## Release Unit

The release unit is the complete coordinated graph:

- `@air-jam/sdk`
- `@air-jam/devtools`
- `@air-jam/mcp-server`
- `@air-jam/cli`
- `@air-jam/server`
- `create-airjam`

This inventory is not a publication sequence. Publication order is owned by
`scripts/release/public-packages.mjs` and checked against package dependencies.

Devtools owns the Node authoring and evaluation harness, shared by CLI and MCP.
Environment validation is an internal build helper, not a published package.

All packages have one version. Partial package selection is not a supported
release mode because it can expose a graph that Air Jam never validated as a
whole.

## Immutable Candidate

The canonical candidate creator must:

1. require a clean checkout at one full Git commit, including no ordinary
   untracked files that could enter package contents
2. run the release validation gate before packing
3. build the public graph once in dependency order
4. pack every public package once
5. record the exact source commit, toolchain, lockfile digest, public dependency
   graph, filenames, byte sizes, SHA-256 digests, and npm SHA-512 integrity
6. install the six retained tarballs together in an isolated consumer project
   with lifecycle scripts disabled, then record the exact materialized
   production dependency and license inventory; registry metadata may fill a
   license only when an installed package manifest omits it
7. query OSV's batch API for the exact resolved production inventory with a
   bounded timeout, retain the normalized result, and reject any known finding
8. write the candidate through a staging directory and expose it only after
   every file and invariant passes
9. derive one candidate digest from the immutable identity fields rather than
   from wall-clock metadata

The candidate directory contains only the manifest, evidence documents, and
the six tarballs named by the manifest. Validation rejects missing, extra,
traversing, duplicate, or digest-mismatched files.

The vulnerability query follows OSV's documented
[`POST /v1/querybatch`](https://google.github.io/osv.dev/post-v1-querybatch/)
contract. An unavailable, malformed, paginated, or non-empty result fails
candidate creation rather than silently weakening the release gate.

Candidate creation and inspection are repo-owned machine contracts discoverable
through:

```bash
pnpm run repo -- release candidate --help
```

`repo release publish` is inspection-only. The sole apply-capable publisher is
the standalone verifier invoked inside the GitHub OIDC job; there is no local
apply flag or token-based alternate path.

## Validation And Publication

The six-cell public installation matrix downloads the one candidate artifact.
Each cell publishes those exact tarballs to its isolated registry and exercises
the normal public bootstrap. No cell rebuilds or repacks the graph. Aggregate
evidence fails unless every cell reports the same source commit, candidate
digest, and package digests.

The privileged npm job:

1. starts only after the candidate gate and all matrix cells pass
2. checks out the reviewed workflow commit to obtain the publisher and installs
   no repository dependencies; retained candidates keep their original source identity
3. downloads and validates the immutable candidate artifact
4. publishes the tarball paths with npm trusted publishing and provenance under
   a candidate-specific temporary tag
5. treats an existing version as reconcilable only when npm reports the exact
   candidate integrity
6. verifies registry integrity and provenance after every publish
7. updates `next` or `latest` only after the complete npm graph is verified,
   then removes the temporary tag
8. creates source tags and GitHub releases only after the complete npm graph is
   verified
9. attaches the candidate manifest and aggregate evidence to the GitHub release

The npm publishing job has `id-token: write` and no long-lived npm token. Source
tag and GitHub-release mutation is isolated in a later job with `contents:
write`; the npm job itself does not receive that permission.

The publishing toolchain pins npm 12.2.0, including its array-shaped `view --json`
contract and OIDC distribution-tag support. Every package's trusted publisher must
allow both direct publication and distribution-tag management. These are separate
permissions in [npm's configuration](https://docs.npmjs.com/trusted-publishers/).
Registry ingestion may lag a successful upload; verification waits within one
bounded ten-minute window after publishing the missing packages, without changing
channel tags until the entire graph is visible with exact integrity and provenance.

Candidate construction also serves installation qualification, including changes
after a version has already been released. Only a fresh publication runs
`repo release candidate check-versions` before construction; installation tests
must not require unpublished versions. Both candidate-building workflows pin
the same npm metadata contract. Publication still rejects any existing version
whose bytes do not match its retained candidate.

When the publisher itself needs repair, recover through the same workflow with
`pnpm run repo -- release trigger --channel next --candidate-run-id <original-run>`.
Recovery accepts only a completed failed main run of this first-party workflow
whose source is an ancestor of the current reviewed checkout. It downloads and
validates that run's original candidate and re-aggregates all six retained cell
proofs. It neither rebuilds tarballs nor repeats their installation matrix.
The current package graph must still match the candidate, and source tags remain
bound to its original commit. Ordinary failed-job retries remain sufficient when
no verifier/toolchain change is needed.

## Workflow Integrity

Every third-party GitHub Action is referenced by a full commit SHA with a human-
readable version comment. A repository contract test rejects mutable action
references. Workflow jobs declare the smallest permissions their responsibility
requires.

Tool versions that affect candidate identity are fixed rather than installed
from mutable `latest` tags. The manifest records the observed versions.

## Agent Guidance Integrity

Local agent guidance is updated only from the snapshot packaged inside the
installed `@air-jam/cli` artifact. The npm artifact and its provenance are the
trust anchor; a mutable hosted response is not allowed to rewrite repository
instructions.

The AI-pack lifecycle must:

1. validate its manifest strictly
2. verify every managed file against its declared digest before any write
3. reject version rollback and same-version content drift
4. stage the complete update and commit it atomically, restoring the prior
   state on failure
5. expose status, diff, update, and repair through the repo-aware CLI

Hosted AI-pack files may remain a readable documentation surface, but they are
not an update authority.

## Privacy Evidence

Release trust includes proof that public privacy claims match executable
behavior. The retained evidence must map each claim to its ingestion schema,
redaction or minimization boundary, retention policy, deletion path, and
operator projection. A claim with no executable owner is a release finding,
not documentation completeness.

Hosted reporter contact, product telemetry and their operator projections are
private product responsibilities. Moving their implementation does not weaken
the privacy contract. Public tooling must keep credential and diagnostic
redaction at its own ingestion and output boundaries.

## Emergency Release

Urgency may shorten observation time; it may not weaken authorship, review,
candidate identity, package validation, trusted publishing, provenance, or
post-publish verification.

The emergency path is the normal workflow with an explicit emergency reason in
the retained evidence. There is no local token-based fallback and no direct
tag-triggered publish path. If GitHub Actions or npm trusted publishing is
unavailable, package publication waits. Existing compromised versions are
deprecated or access is revoked through explicit npm account operations while
the replacement candidate follows the normal path.

## External Configuration Checkpoint

Before the first 1.0 prerelease, the maintainer must confirm npm trusted
publishers for all six packages name `publish-packages.yml` exactly. Enabling a
GitHub deployment environment is a separate external configuration change and
must not be added to the workflow until the matching npm trusted-publisher
configuration exists.

### First publication of new package names

Before running the privileged publish job, all six names must already exist
and have the matching trusted publisher. npm requires an existing package
before [`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/) can
configure its publisher. Candidate creation may still qualify unpublished
names locally; the apply-capable publisher checks the complete graph before
making any registry mutation, so a missing name cannot leave a partial release.

First-name setup is an external checkpoint, not permission for branch-based
token publication. npm's [staged first-publication flow](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
can establish a placeholder name before approval. Use reviewed package bytes,
settle that staged upload without releasing an implementation, then configure
and read back the canonical GitHub publisher. Do not register superseded
package names or advance release tags to reserve a name.

Registration checks use `npm access get status`, which supports public names
before an installable version exists. A version lookup may return 404 for a
registered placeholder; that is not evidence of missing registration. The
coordinated implementation and its provenance must still be published by the
normal exact-candidate workflow. Actual setup history belongs in the delivery
ledger, not in this stable contract.

## Evidence Boundary

Candidate manifests, installation-matrix artifacts and GitHub release
attachments retain the exact public-package proof. The private product retains
earlier whole-product supply-chain audits and the coordinated launch program.
Registry rehearsal and promotion remain unfinished until the exact candidate
has passed those operations; local package qualification does not establish
publication or provenance on npm.

# Production Immutable Release Generations Proof

Last updated: 2026-08-30
Status: Gate `G3-02` immutable-generation foundation implemented and locally proven

## Outcome

Air Jam release uploads, extracted sites, screenshots, checks, and public
serving now use immutable generation identity. A release is the stable product
record; each upload attempt creates a new generation; and only one ready
generation may be explicitly promoted for serving.

This removes the previous release-wide artifact row and mutable storage-key
model. Retried or concurrent uploads no longer share an object identity, a
stale finalizer cannot promote a superseded generation, and public serving
never falls back to whichever artifact row happens to exist.

The release pipeline remains request-driven in this slice. Durable worker
adapters follow only after their versioned payload/result contracts and
lease-aware executor boundary are implemented. This proof closes the storage
identity prerequisite; it does not claim that Gate `G3-02` or the job migration
is complete.

## Canonical Model

Every generation persists:

1. stable generation and parent-release identity
2. a release-local monotonic sequence
3. `awaiting_upload`, `processing`, `ready`, `failed`, or `abandoned` state
4. creator-declared filename, content type, and byte count
5. a unique source ZIP object key
6. first-observed object size, content type, ETag, and last-modified time
7. a unique extracted-site root plus size, file count, entry path, and SHA-256
8. explicit upload, processing, ready, failed, and abandoned timestamps

The release stores two same-release foreign keys:

1. `candidate_generation_id` identifies the only upload currently allowed to
   advance
2. `promoted_generation_id` identifies the only ready output eligible for
   publishing and serving

Database checks make impossible lifecycle combinations unrepresentable.
Composite foreign keys prevent a release or check from pointing at a generation
owned by another release. Release checks require generation provenance.

## Upload And Promotion Fencing

Requesting an upload target transactionally locks the release, abandons any
replaceable candidate, assigns the next sequence, creates a generation, and
sets it as the current candidate. The source key contains the generation ID,
and signed upload requests require create-only object semantics.

Finalization requires both release and generation identity. It:

1. verifies the generation is still the current candidate
2. records and compares first-observed object facts with the declaration
3. reads the exact observed ETag conditionally
4. validates and extracts the archive into a unique output root
5. uses create-only writes for every extracted object
6. transactionally promotes only the still-current generation
7. attaches trusted checks and moderation evidence to that generation

If another upload replaces the candidate, the stale generation cannot claim,
promote, or fail the newer work. Validation failure fails only the current
generation and release. A generation that has already produced a valid
immutable output remains `ready` if a later moderation provider step fails;
the release records the failed checking outcome without falsifying artifact
integrity.

## Serving, Quotas, And Inspection

Public routing resolves only the release's explicit promoted generation and
requires that generation to be `ready`. Public paths include the generation ID,
so immutable cache policy cannot confuse an old deployment with a newer one.
There is no generation-neutral or legacy artifact fallback. Publishing has the
same promoted-ready requirement.

Managed-storage quota accounting includes every retained generation, including
failed, abandoned, and unpromoted uploads. It reserves the greater of declared
and observed source bytes plus extracted bytes, so incomplete work cannot evade
accounting merely by failing before promotion. Dashboard, operations, machine
API, SDK, CLI, and MCP projections expose candidate, promoted, and historical
generation identity. Private ZIP/extracted-site keys and raw internal check
payloads remain absent from creator and operator projections.

The old release-wide finalize endpoint was removed. Submission preserves the
generation returned by upload-target creation and finalizes through:

```text
/api/cli/releases/{releaseId}/generations/{generationId}/finalize
```

The all-in-one submit flow consumes that schema, while explicit `release
upload` and `release finalize` CLI operations—and matching
`airjam.release_upload` and `airjam.release_finalize` MCP tools—let an agent
resume the exact lifecycle boundary without guessing generation identity.

## Legacy Migration

Migration `0027_immutable_release_generations.sql` removes the old artifact
table after translating admissible state:

1. migration preflight rejects ordinary legacy artifacts unless their required
   text, source size, extracted size, file count, SHA-256, and storage identities
   satisfy the new model
2. complete legacy artifacts become ready generation `1`; their eligible
   release keeps its status and receives the promoted pointer
3. the one canonical seeded preview placeholder is hidden, archived, and
   removed rather than being presented as real production evidence
4. interrupted uploading/checking releases receive a failed generation so
   existing checks have mandatory provenance
5. ready, live, or quarantined releases with no artifact metadata abort the
   migration rather than silently inventing a playable output
6. drafts without upload history remain drafts without generations

This is intentionally fail-closed. Except for the exact historical preview
placeholder, incompatibility aborts the migration transaction with the affected
artifact IDs. Preflight runs before data mutation, so remediation happens
against the unchanged legacy model.

## Validation

A native isolated PostgreSQL 14 cluster proved three migration shapes:

1. all migrations from `0000` through `0028` apply to an empty database
2. a database stopped at `0026` migrates a valid live artifact to a ready,
   promoted generation while keeping its game listed
3. the canonical preview placeholder becomes hidden and archived with no
   fabricated generation
4. interrupted upload/check state becomes failed with generation-scoped checks
5. a draft without upload history remains unchanged
6. the old artifact table is absent and check generation identity is non-null
7. an ordinary incomplete live artifact aborts with its exact ID while its live
   status, publication timestamp, artifact table, and pre-generation schema all
   remain unchanged

A read-only Railway SSH preflight then evaluated the same predicates against
the production PostgreSQL database without applying migrations or changing
state:

1. 34 legacy artifacts account for 271,634,465 source bytes and 312,885,457
   extracted bytes
2. the only artifact with missing hash, extracted-size, or file-count evidence
   is the exact `preview-artifact-001` placeholder
3. excluding that canonical placeholder, zero artifact IDs violate the complete,
   unique integrity predicate
4. zero ready, live, or quarantined releases lack artifact metadata

The currently deployed production data is therefore admissible under the
fail-closed migration contract. Deployment still requires the normal migration
review and rollout authority; this preflight was inspection only.

Focused real-PostgreSQL generation, release-status, and quota cases passed. The
generation cases specifically proved:

1. replacement abandons the old candidate
2. only the current candidate can promote
3. every output root is unique
4. finalization reads the first-observed ETag conditionally
5. trusted checks retain exact generation provenance
6. declared-versus-observed object mismatch fails closed
7. a missing source ETag fails closed
8. concurrent duplicate finalization cannot fail the legitimate worker
9. only one active generation can exist per release
10. release pointers must match generation lifecycle state
11. ready paths cannot be empty
12. check evidence prevents direct generation deletion but still cascades when
    its owning release is deleted
13. cross-release candidate or promoted pointers are rejected by PostgreSQL

Generation-aware application, machine-projection, CLI/devtools, and storage-key
tests also passed. Final validation passed:

1. workspace typecheck and lint
2. 280 platform cases, including 37 real-PostgreSQL cases
3. 260 SDK cases
4. 134 server cases, with 2 intentional skips
5. 78 repo-contract cases with PostgreSQL enabled
6. 54 CLI, 54 devtools-core, and 9 MCP-server cases
7. the complete workspace production build
8. the hermetic platform deployment contract
9. the multiplayer performance sanity gate, including zero failed reconnects
   and zero resume misses

Changed-file formatting and `git diff --check` also passed. The repository-wide
Prettier command remains blocked by pre-existing vendored files and a missing
Svelte formatter plugin outside this change; every file changed by this work is
formatted and clean.

## Required Next Layer

Immutable generations make external side effects safely addressable; they do
not yet make execution durable. The next production-valid layer must:

1. define runtime-validated payload, progress, result, and error contracts for
   artifact processing, browser validation, and image moderation
2. include generation ID and job-attempt identity in every executor contract
3. make outputs attempt-scoped where a job may retry
4. allow only the active lease owner to stage and commit an executor outcome
5. replace request-lifetime finalize/moderation execution with enqueue and
   inspect semantics across HTTP, UI, machine API, SDK, CLI, and MCP
6. run the executor in a separately deployable platform worker with health,
   drain, lease heartbeat, cancellation, retry, and repair behavior

Only after every hosted release path exclusively uses that authority can the
concurrent-job quota become available and the old synchronous path be removed.

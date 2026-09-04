# Supply-Chain, Telemetry Privacy, And Emergency Release Proof

Last updated: 2026-09-04

Status: Gate `G5-03` implementation complete; GitHub candidate proof,
production retention activation, and Gate 7 npm registry rehearsal pending

## Outcome

Air Jam now has one public-package release architecture: build the coordinated
five-package graph once from an exact clean commit, retain the candidate and its
dependency evidence, validate those same bytes across the certified support
matrix, and give only the final publisher npm OIDC authority. The publisher
cannot rebuild the graph and refuses an existing version whose registry bytes
do not exactly match the candidate.

The same change removes the mutable hosted AI-pack update authority. Agent
guidance can now be installed only from the snapshot inside the provenance-
bound `@air-jam/cli` package, with strict content validation, rollback
protection, explicit repair, and transactional replacement.

The privacy proof is deliberately narrower than a generic privacy-policy claim.
It proves the implemented product-telemetry contract, including the scheduled
retention capability and an activation-aware public disclosure. It does not
claim the worker is already running in production or that the separate account,
OAuth, runtime-usage, report, or media deletion work owned by `G5-02` is
complete.

## Exact Candidate Lifecycle

The repo CLI owns candidate creation and inspection:

```bash
pnpm run repo -- release candidate --help
pnpm --silent run repo -- release candidate create \
  --output <new-candidate-directory> \
  --json
pnpm --silent run repo -- release candidate verify \
  --candidate <candidate-directory> \
  --expected-commit <full-git-sha> \
  --json
```

`scripts/repo/lib/public-release-candidate.mjs` enforces:

1. a clean checkout at one full commit before and after creation, including no
   ordinary untracked files
2. the remote release gate before packing
3. one dependency-ordered build and pack of the complete public graph
4. prepared public dependency declarations with no local workspace specifier
5. exact root-manifest and lockfile digests
6. normalized production dependency and complete license inventories
7. a bounded OSV query over the exact resolved inventory with no known finding
8. SHA-256 and npm SHA-512 identity for every tarball and retained evidence
9. strict candidate directory contents and regular-file boundaries
10. semantic validation of dependency, license, and audit evidence rather than
    trusting only their file hashes

The candidate digest excludes wall-clock metadata and binds every immutable
identity field. Output is staged privately and renamed into place only after
the complete candidate validates.

## Workflow Authority Separation

`.github/workflows/publish-packages.yml` accepts manual dispatch from `main`
only and publishes no partial graph. Its authority is separated by job:

| Job         | Capability                                                                 | Explicitly absent                              |
| ----------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `candidate` | Read source, install, build, inventory, audit, pack, upload                | npm OIDC and source writes                     |
| `verify`    | Download the candidate and test exact bytes in six isolated-registry cells | npm publication                                |
| `aggregate` | Reject incomplete or mixed candidate evidence                              | npm publication and source writes              |
| `publish`   | Read the exact verifier, use npm OIDC, publish and verify tarballs         | dependency install, rebuild, and source writes |
| `finalize`  | Reconcile tags/releases after npm verification                             | npm OIDC                                       |

Every third-party action in every workflow is pinned to a full 40-character
commit SHA and retains a readable version comment. Dependabot owns reviewed
GitHub Actions update proposals. The release workflow pins its npm CLI version
instead of installing a mutable `latest` tool.

An existing npm version is accepted only when its registry integrity equals the
candidate and its npm provenance attestation is present. New versions publish
under a candidate-specific temporary tag; `next` or `latest` changes only after
the complete graph succeeds, then the temporary tag is removed. Package tags
must resolve to the exact candidate commit, and GitHub releases retain
candidate, matrix, and publication evidence.

## AI-Pack Trust Boundary

`@air-jam/cli` now generates and validates one schema-2 manifest for the
guidance snapshot shipped inside its own npm tarball. The updater has no remote
manifest URL, file override, or hosted fallback.

Before any repository write, the CLI verifies the exact managed file set,
relative paths, byte sizes, individual SHA-256 values, and aggregate content
digest. It rejects older versions, rejects same-version drift during ordinary
update, and exposes a separate explicit repair operation for restoring trusted
same-version bytes. Updates are staged as a complete tree, preserve unowned
files, remove obsolete formerly managed files, fail closed on symlinks, and
restore the previous state if commit fails.

The trust anchor is therefore the installed npm artifact plus npm provenance,
not a mutable response served by the Air Jam platform. Hosted copies may remain
readable documentation but have no write authority over a creator repository.

## Product-Telemetry Privacy Proof

The public `/privacy` page now states the same narrow facts as the executable
product-telemetry contract:

| Claim                                                     | Executable owner                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Browser events use a closed, bounded schema               | `apps/platform/src/lib/product-telemetry-contract.ts`                                |
| Full URLs and referrers are reduced before ingestion      | `apps/platform/src/lib/product-telemetry-client.ts`                                  |
| Raw IP and full user agent are not persisted              | `apps/platform/src/server/product-telemetry/normalization.ts` and persistence schema |
| Browser session identity is memory-only                   | `apps/platform/src/lib/product-telemetry-client.ts`                                  |
| Raw events and session contributions expire after 90 days | `apps/platform/src/server/product-telemetry/persistence.ts`                          |
| Retention scheduling affects readiness when worker runs   | `apps/platform/src/server/jobs/operational-job-worker-service.ts`                    |
| Browser reporting is aggregate and ops-authorized         | product-telemetry reporting service and API router                                   |

When deployed, the worker applies the existing canonical retention service
immediately on startup and every 15 minutes by default. The cadence is
configurable, while the 90-day policy stays in the telemetry domain. A failed
run degrades the named `telemetryRetention` readiness authority; shutdown
drains an in-flight run. The public page explicitly says this worker is not yet
active in production; `G3-08` owns activation and observation. Agents retain the
same preview/apply service through:

```bash
pnpm --silent run repo -- platform telemetry health --json
pnpm --silent run repo -- platform telemetry retain --json
pnpm --silent run repo -- platform telemetry retain --apply --json
```

`/privacy` explicitly says that its disclosure covers public product telemetry
only. That boundary prevents this work from laundering unresolved account,
OAuth, runtime, report, media, export, or deletion behavior into a stronger
public promise.

## Emergency Release Procedure

Emergency publication is a mode of the normal workflow, not a second path:

```bash
pnpm run repo -- release trigger \
  --channel latest \
  --emergency-reason "Describe the incident and why publication is urgent"
```

Both the repo CLI and workflow reject a non-empty reason shorter than 12
characters. The publisher retains the normalized reason in publication
evidence. Review, exact candidate identity, matrix validation, npm OIDC,
provenance, registry verification, and final tags/releases remain mandatory.

If GitHub Actions or npm trusted publishing is unavailable, publication waits.
There is no token-based local fallback. Deprecating or revoking a compromised
existing package is an explicit npm account operation and does not authorize an
unverified replacement.

## Threat Register Disposition

| Finding      | This implementation                                                                                                                              | Remaining release proof                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `AJ-SEC-010` | Exact build-once candidate, semantic evidence validation, SHA-pinned actions, least-privilege jobs, publish-exact bytes, provenance verification | Configure all five trusted publishers and run the real npm prerelease rehearsal in Gate 7   |
| `AJ-SEC-011` | Mutable hosted update authority removed; packaged provenance-bound snapshot, strict manifest, rollback protection, atomic update and repair      | Prove the final published CLI artifact through the same registry rehearsal                  |
| `AJ-SEC-012` | Product-telemetry disclosure and scheduled readiness-owned 90-day retention capability implemented                                               | `G3-08` owns production activation; `G5-02` owns the remaining data-plane privacy lifecycle |
| `AJ-SEC-017` | Resource budgets remain part of each exact-candidate matrix cell                                                                                 | Complete the GitHub six-cell candidate run and final real-registry rehearsal                |

The broader findings stay open wherever the final column is not yet proven. In
particular, this document does not mark `AJ-SEC-012` closed as a whole.

## Local Validation

The implementation has passed:

1. public candidate and install-matrix contract tests
2. full repo contract tests
3. CLI typecheck and all CLI tests
4. platform typecheck and lint
5. operational worker service tests, including telemetry-retention readiness

The final pre-push gate, GitHub candidate run, and PR-native review are retained
with the pull request rather than pre-claimed here.

## External Checkpoints

Before the first 1.0 prerelease:

1. confirm npm trusted-publisher configuration for all five package names
2. retain the first successful six-cell candidate and aggregate evidence
3. publish the coordinated prerelease through the workflow and retain registry
   integrity and provenance evidence
4. finish the broader privacy and deletion work in `G5-02`
5. activate and observe recurring production retention through `G3-08`
6. repeat the exact path for the approved `latest` promotion in Gate 7

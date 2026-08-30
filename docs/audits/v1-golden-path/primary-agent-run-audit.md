# Primary Agent Run Audit

Last updated: 2026-08-29

Status: Gate `G2-03` reopened after independent review; Gate `G2-05` input

## Question

Can a new Codex process, with no Air Jam repository access or maintainer
credentials, discover the candidate packages, create a polished game, operate
its complete lifecycle through machine contracts, repair a controlled fault,
and submit a hidden release to isolated staging?

The answer is not yet a certified yes. The clean-room runs have proved most of
the local authoring path and found concrete faults at the boundaries that only
an external agent exercises. Those failures are retained as product evidence;
they are not converted into a success claim.

## Safety And Isolation Boundary

Every valid attempt uses:

1. an empty temporary workspace outside the Air Jam monorepo
2. a run-scoped Verdaccio registry containing the exact five candidate
   packages, with fallback to old public Air Jam packages disabled
3. a new ephemeral Codex process with ambient credentials removed
4. a controller-run Codex sandbox preflight that proves repository reads are
   denied, workspace writes are allowed, undeclared network access is denied,
   and the run-scoped registry is reachable before the agent starts
5. writes limited to the workspace and run-owned evidence, state, temporary,
   cache, npm-cache, and pnpm-store roots
6. network access limited through Codex's managed proxy to loopback and the
   exact isolated Railway staging hostname
7. production publication and public Arcade visibility requested as forbidden;
   actual release state must be independently inspected before it can count as
   proof
8. a redacted, reconciled evidence mirror under
   `.airjam/golden-path-runs/<run-id>/evidence`

Attempts `a4` through `a9` targeted the then-active isolated Railway PR
environment at `air-jam-platform-air-jam-pr-52.up.railway.app`. Production was
not changed by any run. On the 2026-08-29 replay preflight, that hostname still
returned the platform health response while the provider API reported zero
ephemeral environments. The hostname is therefore no longer admissible staging
identity and no new primary run was started against it.

The controller now accepts Railway project and environment identities instead
of a URL. It resolves the environment, platform deployment, distinct public
domain, environment-variable identity, distinct Postgres instance, distinct
release-storage bucket and credentials, distinct release-pipeline tokens,
non-reused production-sensitive values, and health response through
provider-owned state; rejects the primary/base environment; and retains the
non-secret provider attestation without passing Railway credentials to the
external agent.

Pull request `#61` subsequently caused Railway to create a fresh ephemeral
environment with a distinct Postgres instance. Safe provider comparisons found
that the environment cloned the production R2 bucket, R2 credentials,
release-worker tokens, and other production-sensitive values. The controller
therefore still cannot admit it, and no external agent was started. The
repo-loaded Railway credential also cannot read the bot-created environment;
the provider's account-scoped CLI identity can inspect it without exposing
secret values.

## Independent Review Correction

Claude's stacked-PR review found that the first retained-proof implementation
still crossed three trust boundaries incorrectly:

1. agent-authored command text could satisfy post-repair quality criteria
2. an MCP close event could count without proving that the tool call succeeded
3. hidden-release state and sandbox isolation were recorded as facts without
   controller-owned observations

It also found that the only `G2-03` artifact reference pointed into ignored
`.airjam` state. That location is useful operator memory but is not durable
repository evidence another reviewer can retrieve. `G2-03` was therefore
reopened on 2026-08-29. The hardened controller now reruns all four quality
gates before fault injection and after repair, rejects failed MCP closes,
preflights the installed Codex sandbox, and refuses to pass until the platform
release is independently verified as ready, hidden, and non-production. A
passing replay plus durable redacted artifact still remains before this gate
can close again.

## Attempt Ledger

| Attempt             | Terminal classification       | Furthest trustworthy stage | Material finding                                                                                                                                                                                                                                                                                                                        | Retained proof                                                                                                                                        |
| ------------------- | ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `g2-03-20260828-a1` | invalid harness attempt       | preflight                  | The first controller combined obsolete/incompatible Codex sandbox and approval flags. The agent never started.                                                                                                                                                                                                                          | Partial controller bundle under `.airjam/golden-path-runs/g2-03-20260828-a1/evidence`; its empty indexes are not success evidence.                    |
| `g2-03-20260828-a2` | invalid isolation             | create                     | The temporary project lived below the monorepo, so pnpm correctly inherited the ancestor workspace. That violated the clean-room contract.                                                                                                                                                                                              | Partial transcript and workspace under `.airjam/golden-path-runs/g2-03-20260828-a2`.                                                                  |
| `g2-03-20260828-a3` | failed environment attempt    | build/evaluate             | The agent independently built Signal Relay and passed typecheck, lint, focused tests, and build. `pnpm run dev` then failed because the default Codex workspace profile denied local TCP binding. A user interruption also proved that evidence retained only in the temporary root was not durable.                                    | Operator-observed only; the interrupted temporary evidence did not survive and is not admissible completion proof.                                    |
| `g2-03-20260829-a4` | failed environment attempt    | create                     | The hardened profile worked, but the sanitized `PATH` selected an FNM/Corepack shim. Its empty run cache tried to resolve pnpm from the external npm registry, which the network allowlist correctly denied. Concurrent recovery installs also showed that generated guidance needs an explicit one-install-at-a-time rule.             | Partial transcript under `.airjam/golden-path-runs/g2-03-20260829-a4/evidence`.                                                                       |
| `g2-03-20260829-a5` | blocked environment attempt   | build                      | The agent created and implemented Signal Relay, repaired its own contract mistakes, passed all four quality gates, and started the managed dev stack. Semantic-session open failed because the managed profile denied the `tsx` Unix socket.                                                                                            | Complete controller result, transcript, runtime log, manifest, and verifier report under `.airjam/golden-path-runs/g2-03-20260829-a5/evidence`.       |
| `g2-03-20260829-a6` | failed product/client attempt | control                    | With run-scoped Unix sockets allowed, the built helper was still launched through the `tsx` CLI. Its IPC listener collided with the managed profile (`EADDRINUSE`). The agent retried through supported broker controls, preserved both failures, refused to edit installed package internals, and stopped without an unproven release. | Complete normalized transcript, manifest, project state, and verifier report under `.airjam/golden-path-runs/g2-03-20260829-a6/evidence`.             |
| `g2-03-20260829-a7` | blocked environment attempt   | control                    | The helper fix advanced session startup into the actual Playwright browser. Bundled Chromium and system Chrome were both denied macOS Mach-port registration inside the managed Codex process profile. The new prompt produced all six meaningful evidence indexes and preserved the blocker correctly.                                 | Twenty-seven indexed files, including complete stage indexes and failure classification, under `.airjam/golden-path-runs/g2-03-20260829-a7/evidence`. |
| `g2-03-20260829-a8` | blocked client attempt        | create                     | The first package-manager pin read `create-airjam`'s own packed `package.json`; npm strips that field while packing, so the initializer rejected the otherwise valid candidate before creating a project. The attempt also exposed that early blockers need exact failure keys and valid empty downstream indexes.                      | Eighteen files under `.airjam/golden-path-runs/g2-03-20260829-a8/evidence`; the original verifier report is retained as failure evidence.             |
| `g2-03-20260829-a9` | blocked environment attempt   | control                    | The shipped template manifest fixed creation and the agent independently produced the complete game, passed typecheck, lint, five domain tests, and build, and started managed dev. Semantic-session open then reproduced the bundled/system Chromium Mach-port denial. The corrected verifier preserved the terminal blocker.          | Twenty-five manifest-indexed artifacts plus the verifier report under `.airjam/golden-path-runs/g2-03-20260829-a9/evidence`.                          |

## What The Agent Proved

Across the retained runs, an external agent with no monorepo source context was
able to:

1. find the candidate packages through registry and package metadata
2. discover the correct `airjam` CLI, MCP server, generated docs, and generated
   skills
3. recover the intended architecture: pure domain rules, host-authoritative
   replicated transitions, explicit untrusted controller actions, thin UI
   compositions, and one semantic agent contract
4. implement a polished two-to-four-player Signal Relay game from the minimal
   scaffold
5. diagnose type-level and contract-level mistakes from public SDK types rather
   than private examples
6. pass typecheck, lint, focused domain tests, and production build
7. start and inspect the real managed local dev stack through `pnpm run dev`
8. initialize and inspect the public MCP protocol
9. use status, unified logs, broker status/stop, and session commands as one
   coherent machine operating surface
10. stop safely when the supported contract could not prove a required stage

This is strong evidence for the central product theory: the generated harness,
not a mandatory hosted Studio, can carry an agent from an empty directory to a
substantial game. The remaining failures are concentrated in lifecycle edges,
not in the game framework's basic ability to support agent-authored products.

## Defects Closed During G2-03

### Harness And Isolation

1. replaced invalid Codex automation flags with the current custom permission
   profile contract
2. moved the clean workspace outside the monorepo and attested that boundary
3. denied child reads of the Air Jam repository while retaining only declared
   run-owned writes
4. enabled loopback TCP binding and only the run-owned Unix-socket root
5. put the pinned host pnpm binary ahead of user-level Corepack shims
6. isolated `TMPDIR`, Air Jam state, Corepack, XDG, npm, and pnpm caches
7. mirrored transcripts and evidence during execution instead of only at exit
8. made durable controller-state writes atomic
9. delayed the declared fault until all four initial quality gates are rerun by
   the controller and one successfully closed semantic session is observed;
   the controller reruns the same four gates after repair
10. exposed every agent-owned evidence index and its minimum schema in the
    primary prompt; placeholder success records are explicitly forbidden
11. made the independent verifier distinguish `invalid`, `blocked`, `failed`,
    and `passed`; preserve the first structurally valid blocker; and report
    downstream criteria as not evaluated instead of failed
12. replaced assertion-only sandbox evidence with deterministic deny/allow
    probes against the installed Codex CLI
13. made retained evidence snapshots prune stale files, replace the retained
    bundle atomically with rollback, redact every valid UTF-8 artifact before
    mirroring, and reject binary evidence that cannot be safely inspected

### Product And Scaffold

1. built JavaScript helpers now run directly under Node; authored TypeScript
   helpers use Node's `--import` loader path instead of starting the `tsx` CLI
   IPC server
2. the same helper-launch contract now covers semantic control, agent-contract
   inspection, AI configuration inspection, and visual capture
3. generated projects now retain a canonical `lint` script
4. generated projects pin the repository's canonical pnpm version through a
   shipped template manifest that survives npm packing
5. scaffold smoke tests now require and execute the same lint gate that the
   external-agent contract requires
6. the isolated bootstrap now asserts the package-manager and lint contracts
   and executes typecheck, lint, tests, and build
7. generated agent guidance serializes scaffold/package-manager mutations so
   one installation owns the workspace at a time
8. early classified blockers can carry empty downstream indexes without being
   misreported as missing product work

## Independent Integration Review Closeout

The cumulative `#61` review found that several early hardening assertions were
narrower than their evidence names. The corrected controller now:

1. proves Docker manifest copies in the dependency stage before the frozen
   install, with Dockerfile discovery rather than a hand-maintained file list
2. compares rendered variables across every deployed Air Jam Railway service,
   requires distinct service instances, and fails closed on an equal production
   value unless its name is explicitly classified as safe configuration
3. requires a remote browser endpoint to resolve to the staging worker while
   preserving the runtime contract that its token is conditional on that
   endpoint
4. composes `publicOriginDistinct` only after the independent public-domain
   comparison succeeds
5. bounds the primary Codex process and final managed-dev cleanup, uses one
   process-tree shutdown primitive, and reports a missing Codex/toolchain binary
   directly
6. consumes one canonical MCP tool-name manifest instead of relying on a magic
   count and brings both the CLI and MCP package tests into root CI
7. validates artifact evidence as a Git commit, Git range, or durable
   repository file instead of accepting an opaque formatted string

These corrections improve the trustworthiness of the next replay but do not
change the gate result: the current Railway preview is still derived from
production storage and credentials, so no external agent may start against it.

## Remaining Closure Work

The following are Gate `G2-05` inputs unless a later `G2-03` replay proves that
they are already satisfied:

1. provision or select a real isolated Railway staging environment under the
   cost policy, then provide a canonical run-scoped platform machine identity
   without copying a maintainer credential, opening a production backdoor, or
   requiring an informal human approval during the autonomous proof
2. provide a canonical browser runtime or broker that can complete
   open/read/invoke/close from the exact managed Codex profile without widening
   the entire agent sandbox
3. prove visible host and controller captures through a CLI-usable visual path;
   a system `open` command is not inspection evidence
4. validate every referenced digest, not only the index envelope
5. improve npm search and binary-name discoverability: broad `air jam` search
   and the intuitive `air-jam` spelling both produced recoverable friction
6. set a launch budget for the `87,264,876` byte `create-airjam` candidate
   tarball instead of accepting the asset-heavy package size implicitly
7. replay the exact immutable scenario after all blockers close, then retain a
   terminal passing bundle in a durable repository or CI artifact location

## Architectural Assessment

The strongest part of the product is contract convergence. Generated docs,
skills, CLI, MCP, replicated state, semantic actions, unified logs, and release
commands describe the same operating model. The external agents repeatedly
recovered the intended host-authoritative architecture without private source
access.

The weakest part is lifecycle composition at clean-room boundaries. Individual
capabilities exist, but package-manager selection, process ownership, helper
transport, browser availability, evidence ownership, and staging identity were
not yet one frictionless autonomous path. This is exactly why the clean-room
gate is valuable: normal monorepo development and maintainer credentials hide
these seams.

The correct 1.0 response is not to add a second hosted Studio or a parallel
operator model. It is to finish the single CLI/MCP harness so creation,
inspection, evaluation, publication, evidence, and safe cleanup remain one
canonical lifecycle for humans and agents.

## Gate Boundary

`G2-03` owns the retained Codex primary run and its findings. `G2-04` separately
owns Claude Desktop packaging, discovery, and semantic-session proof. `G2-05`
owns the browser/staging lifecycle fixes and exact terminal passing replay.
Re-completing `G2-03` requires the primary attempt and findings to be durably
captured outside ignored operator state. It does not certify the complete
scenario or production readiness, and no attempt in this audit authorizes
publication.

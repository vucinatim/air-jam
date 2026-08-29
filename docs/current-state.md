# Current State

Last updated: 2026-08-29
Status: current snapshot

This is the canonical quick-read status surface for the Air Jam repo.

Use this file for:

1. current focus
2. what is structurally done
3. what is still open
4. the small set of plans that govern current work
5. immediate next steps

Do not use this file as a running work log.

Update it only at:

1. phase closures
2. meaningful reprioritizations
3. repo operating system changes that affect how the repo should be read

For historical progress, use [work-ledger.md](./work-ledger.md).

## Current Focus

Air Jam is now governed by the
[1.0 release roadmap](./plans/v1-release-roadmap-plan.md).

The focus has moved from a narrow final-proof-and-publish pass to a deliberate
1.0 re-baseline shaped by six months of progress in general-purpose coding
agents, MCP, CLI operability, and Air Jam's own harness.

The current priorities are:

1. execute the ratified public 1.0 contract: one `Air Jam` product, a complete
   agent-operable development harness, and no separate mandatory hosted editor
2. audit and canonicalize the codebase before public API stability is promised
3. prove the complete lifecycle through an external agent from a clean
   environment
4. harden production capacity, recovery, security, alerts, incident handling,
   and bounded automated remediation before inviting launch traffic
5. finish package, documentation, demo, article, and distribution work against
   one exact release candidate
6. launch with a free creation harness and useful hobby cloud inside an explicit
   cost envelope, rather than tying sustainability to signup count

## What Is Structurally Done

These are now baseline truths, not open architecture debates:

1. the framework, platform, realtime server, and browser-worker split is established
2. the dashboard and hosted release model are real:
   1. game records
   2. release records
   3. release artifacts
   4. managed media
   5. public hosted release serving
3. the hosted release machine lane is real:
   1. CLI auth
   2. CLI release submit / inspect / publish
   3. MCP release submit / inspect / publish
4. the Railway-first deploy model is real:
   1. the platform now deploys on Railway alongside the realtime server and browser worker
   2. Railway native PR environments are the canonical preview model
   3. the repo now owns deploy inspection instead of a second preview control plane
5. the release architecture and public product direction are already substantially defined in:
   1. [vision.md](./vision.md)
   2. [discoverability-vision.md](./discoverability-vision.md)
   3. [framework-paradigm.md](./framework-paradigm.md)
   4. [strategy/public-arcade-release-strategy.md](./strategy/public-arcade-release-strategy.md)
6. the full implemented surface is now easier to recover through:
   1. [capability-inventory.md](./capability-inventory.md) for current capability breadth
   2. [documentation-taxonomy.md](./documentation-taxonomy.md) for the live docs category map
   3. explicit reference docs for:
      1. the platform control plane
      2. the platform docs surface
      3. the hosted release pipeline
      4. platform identity and auth
      5. documentation and AI-pack delivery
      6. runtime topology and inspection
      7. semantic agent sessions
      8. game metadata and media presentation
      9. local, hosted-release, and agent development loops
7. Last Band Standing now has a much stronger quiz-content baseline:
   1. one canonical row per song with inline category ownership
   2. one canonical quiz category and a curated 1-through-5 difficulty for
      every song
   3. same-quiz-category answer pools with four unique visible labels and no
      permissive fallback
   4. Unicode-safe canonical normalization
   5. deterministic catalog validation and randomized option-generation tests
   6. 206 canonical songs across ten independently playable categories
   7. 59 Slovenian songs and 26 Balkan songs
   8. explicit deterministic clip timing on every catalog entry
   9. complete two-, six-, and ten-player ten-round semantic match proofs
   10. a clean host answer reveal, controller-owned all-player between-round
       rankings, and scrollable ten-player final standings
8. the Android Auto road-trip implementation is structurally in place:
   1. Arcade owns an exact typed `?qr=open` launch contract
   2. Arcade and Last Band Standing respond to short-wide dimensions and safe
      areas without Android/user-agent branches
   3. Last Band Standing has a compact ten-player gameplay strip
   4. the private wrapper uses the URL contract instead of DOM button matching
   5. the wrapper is rebuilt on Android for Cars App Library 1.7.0 with focused
      host-navigation tests and zero Android lint errors
9. the road-trip platform-foundation goal is complete locally:
   1. the public preview-controller launcher is contextual and disappears
      during phone-connected gameplay
   2. semantic Arcade sessions resolve epoch-scoped embedded stores through
      authoritative `arcade.surface` state
   3. local bootstrap and 16-player Arcade capacity are re-proven
   4. the top-center controller menu consumes the real phone safe-area inset
   5. the Android wrapper carries the canonical installed Air Jam icon
10. first-party product telemetry is now part of the platform baseline:
    1. one closed, versioned event contract covers canonical page views and
       meaningful public intent
    2. same-origin browser ingestion is bounded, rate-limited, idempotent, and
       non-blocking to product UX
    3. agent-facing resources record server-observed reach without changing
       their public response contracts
    4. append-only raw evidence projects deterministically into daily event and
       ephemeral-session metrics
    5. the ops-only report keeps product telemetry, platform lifecycle facts,
       and authoritative runtime activity visibly separate
    6. anonymous identity is memory-only and the system does not fingerprint or
       persist raw IP addresses, full user agents, full URLs, query strings, or
       raw referrers
    7. the dormant external website-analytics integration and its environment
       and CSP contract are fully removed
    8. the full operator lifecycle is available through the repo CLI with
       stable JSON reads, health inspection, and explicit preview/apply
       maintenance commands backed by the same domain services as the ops UI
11. Gate 1 tooling and public-contract convergence is complete:
    1. `create-airjam` is one-shot bootstrap only
    2. installed project lifecycle has one owner in `@air-jam/cli`
    3. the server binary owns only signal-server start and unified logs
    4. CLI and MCP operate the same semantic sessions and typed services
    5. managed framework references cannot overwrite project-owned instructions
       or skills
    6. all six scaffold games pass semantic store/action conformance
    7. a packed clean-room project proves CLI discovery, MCP protocol startup,
       semantic session control, typecheck, tests, and production build
12. Gate 1 platform application authority convergence is complete:
    1. release and managed-media lifecycle bypasses are removed
    2. human and machine adapters share actor-aware application services
    3. PostgreSQL enforces one live release and valid active media assignments
    4. platform and realtime server compile against one shared physical-table
       contract while platform alone owns migrations
    5. Arcade lifecycle events are planned by one stateless orchestrator without
       replacing replicated surface state or the local capability reducer
13. Gate 1 clean-checkout crystallization is complete:
    1. all published CLI entrypoints bootstrap correctly without ignored build
       output or populated-worktree hoisting
    2. generated-artifact validation derives and compares output from authored
       sources instead of trusting ignored hosted files
    3. the full release, browser, scaffold, and strict realtime matrix passes
       from the exact canonicalization head
    4. authored production source, tests, and guidance are `6,050` lines net
       smaller than the exact pre-canonicalization baseline
14. Gate 2 now has one canonical external-agent proof contract:
    1. a repo-validated JSON manifest fixes the clients, isolation boundary,
       ten ordered lifecycle stages, hidden-staging publication policy, and
       machine evidence paths
    2. Codex owns the complete create-through-release proof; Claude Desktop
       owns a separate independent install, discovery, and semantic-session
       proof
    3. a deterministic three-to-two win-score mutation exercises the bounded
       inspect-diagnose-repair loop without claiming general self-healing
    4. `pnpm --silent run repo -- golden-path spec|validate --json` makes the
       scenario discoverable and rejects malformed or production-unsafe specs
    5. the exact candidate package graph now passes an isolated-registry
       bootstrap proof with no local dependency specs or private repository
       paths
    6. the generated project discovers the canonical CLI, all `24` MCP tools,
       project-scoped Codex configuration, managed dev lifecycle, typecheck,
       lint, tests, and production build
    7. the MCP server reports its shipped package version rather than a
       hard-coded version
    8. `create-airjam` currently packs to `87,264,876` bytes because it embeds
       all six scaffold archives; Gate 6 must set and prove the final package
       size and cold-install budget
    9. the retained Codex primary run independently built the full Signal Relay
       game, passed all four quality gates, and reached semantic-session control
       before both supported Chromium paths hit the same macOS Mach-port denial
    10. independent review reopened `G2-03`: the retained local run remains
        useful diagnostic evidence, but its ignored artifact path was not
        independently retrievable and the controller could trust agent-authored
        verification claims
    11. the corrected controller now owns isolation probes, quality gates,
        cleanup, and release-verification authority; `G2-03` requires a new
        durable replay before completion, `G2-04` owns independent Claude
        Desktop proof, and `G2-05` owns browser/staging closure

## What Is Still Open

The roadmap now organizes the remaining work into explicit evidence gates:

1. external-agent golden-path proof
2. launch-scale reliability, backpressure, cost, backup, restore, and rollback
3. operational events, synthetics, alerts, incident correlation, GitHub issue
   policy, and bounded remediation
4. security, abuse, privacy, and supply-chain trust
5. public package, installation, documentation, demo, and article proof
6. one immutable release rehearsal and final go/no-go decision

## Active Now

The 1.0 release roadmap is the governing product plan:

1. [plans/v1-release-roadmap-plan.md](./plans/v1-release-roadmap-plan.md)

The subordinate execution plan and machine manifest own dependency-aware daily
work state without becoming a second product authority:

1. [plans/v1-release-execution-plan.md](./plans/v1-release-execution-plan.md)

The current pull-request stack is in integration closeout, not public-launch
closeout. Pull requests `#52` through `#60` remain focused review slices, while
their cross-stack corrections will be merged through one cumulative integration
pull request to avoid deploying known-incomplete intermediate states. After that
merge, remaining 1.0 work returns to small independently production-valid pull
requests. Production code is delivered incrementally; stable package promotion,
public release visibility, final docs, the launch article, and distribution are
coordinated only after one exact candidate passes rehearsal.

Canonical agent reads are:

```bash
pnpm --silent run repo -- readiness status --json
pnpm --silent run repo -- readiness next --json
```

The discoverability plan is a subordinate launch checklist and cannot redefine
the 1.0 contract:

1. [plans/discoverability-and-launch-promotion-plan.md](./plans/discoverability-and-launch-promotion-plan.md)

## Recent Closures

Gate 0 is closed with the product name, development-harness contract, supported
client profiles, free-cloud allowances, cost ceilings, capacity target, and
autonomy ceiling ratified on `2026-08-28`.

Gate 1 bundles `R1` through `R5` are closed. They removed duplicate topology,
obsolete visual/control paths, copied project CLI implementations, unsafe
guidance ownership, accidental public runtime exports, platform lifecycle
bypasses, duplicate physical-table declarations, unenforced release/media
invariants, and Arcade callback-ref lifecycle synchronization. The exact
clean-checkout release matrix passes at `da835f6`, and authored source, tests,
and guidance are `6,050` lines net smaller than the Gate 1 baseline.

Gate `G2-01` is closed with the
[external-agent golden-path contract](./contracts/external-agent-golden-path-contract.md),
its exact Signal Relay prompt, versioned evidence format, and repository-owned
validator. Current Anthropic guidance makes Desktop Extensions the preferred
Claude Desktop packaging path, so the older raw JSON setup remains explicitly
uncertified until the independent `G2-04` proof settles and canonicalizes it.

Gate `G2-02` is closed at `511ee85` with the
[public bootstrap audit](./audits/v1-golden-path/public-bootstrap-audit.md).
The exact five-package candidate graph was built, packed, published to a fresh
loopback registry with Air Jam upstream fallback disabled, installed from a
clean scaffold, exercised through CLI and raw MCP, and removed after all
generated-project quality gates passed. No npm package or production system was
changed.

The previous narrow v1 closeout plan was superseded by the 1.0 roadmap and is
preserved in the
[2026-08-26 pre-roadmap snapshot](./archive/2026-08-26-v1-release-plan-pre-roadmap.md).

The first-party telemetry implementation, Android Auto road-trip release,
preview system closeout, Railway API control-surface replacement, and repo
operating system reset are closed.

The telemetry implementation plan is preserved in the
[2026-08-26 telemetry archive](./archive/2026-08-26-first-party-product-telemetry-plan.md).
Other closed plans are archived according to the repository documentation
taxonomy.

They should no longer compete with launch execution.

## Planned Next

Execute the roadmap in dependency order:

1. keep the ratified Gate 0 contract frozen
2. keep the now-closed Gate 1 boundaries stable
3. parallelize independent golden-path,
   reliability, operations, security, and public-surface work
4. retain evidence for every gate and integrate through one central validation
   pass
5. keep [strategy/post-v1-topology-roadmap.md](./strategy/post-v1-topology-roadmap.md)
   non-current unless a measured release risk requires part of it

## Immediate Next Steps

1. agents select and claim from the canonical readiness queue
2. run the complete Codex Signal Relay authoring, semantic-control, repair,
   evaluation, and hidden-staging lifecycle against the fixed scenario
3. continue the dependency-ready reliability inventory, operational-event
   contract, and threat model
4. preserve Gate 1 contracts while those independent implementation lanes run
5. complete or block work only through evidence-backed readiness transitions

## Current Caveats

1. the repo has enough implemented infrastructure that the main risk is now
   committing to stale assumptions or freezing accidental complexity
2. production launch confidence has not yet been demonstrated through a defined
   capacity envelope, recovery drill, and incident-automation proof
3. product telemetry anonymous-session and actor-class counts are approximate
   discovery measures, not durable people or identity proof
4. full code-changing self-healing is a post-1.0 direction; 1.0 requires strong
   detection, automated triage, and only bounded reversible remediation
5. monetization mechanics are intentionally deferred until activation or
   requested value is real, but cost metering, quotas, queues, spend alerts,
   degradation, and kill switches are launch requirements

## Canonical Read Order

For a fast orientation pass:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. this file
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the currently relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed

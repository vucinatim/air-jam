# Current State

Last updated: 2026-10-04
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

The architecture re-baseline is complete. On `2026-09-09`, the remaining
program was narrowed around the shortest trustworthy path to a polished 1.0:
prevent serious harm, prove the public agent promise, make the creator/player
experience feel finished, communicate it clearly, and launch one exact
candidate. Mature-company operational completeness is not the pre-adoption
release bar.

Interactive intermediate delivery resumed on `2026-10-03` after a three-week
pause. Pending launch work is preserved at `564e7034`, and the host-authority
branch is integrated locally at `80499490` on `codex/intermediate-delivery`.
Migration history now preserves the applied host `0040` exactly, removes its
cross-clock constraint in `0041`, and orders evidence indexes and private report
changes through `0044`. Both PostgreSQL upgrade paths pass; Drizzle reports no
schema drift. The built ARM64 browser-worker image passes real isolated capture,
HTTP/HTTPS and WS/WSS, private-header driver fetch, denied private egress, and
process cleanup. This is local proof, not reviewed production delivery or 1.0
release completion. GitHub integration, guarded production migration, exact
provider rollout and live validation are the current delivery boundary. Public
package promotion, final phone/demo proof and launch remain separate work.

Reviewed production delivery remains pending. The Canonicalizer attempt
could not authenticate; no review ran through that tool. Tim subsequently
authorized a separate GPT-6.1 Sol reviewer because Claude is out of credits;
independent source review of `36551396` against production `db85cdea` completed
with no new actionable source defects under the batch-specific
[review substitution](./working-agreements.md#review-stacks-and-integration).
This is pre-push source review, not the later green-PR GitHub review or production
proof. The isolated Railway AMD64 image built, but its pre-deploy capture proof failed. A bounded
non-root probe confirmed `unshare: unshare failed: Permission denied` in the
new worker container. Local image success and September's older-container
feasibility do not establish support for this new deployment. A subsequent owned
actual-service-runtime deployment, not a pre-deploy job, denied the same
unchanged non-root namespace probe and ended `FAILED`. Tim approved a disposable
worker proof on bee. The same reviewed AMD64 worker passed there, including a
read-only filesystem, real capture/egress/process isolation, service health and
authentication, public HTTPS capture, and graceful shutdown. No host security
settings changed, and all owned test containers are removed. See the
[retained worker evidence](./audits/v1-security/2026-10-03-bee-worker-image-proof.json).
Tim rejected production capture on the core private bee host. Railway's
ordinary containers and disposable isolated VM denied the namespaces required
by the self-hosted browser; the VM and owned trial containers were removed.
On `2026-10-04`, Tim accepted Cloudflare managed browser isolation and authorized
reviewed delivery and release when confidence is established. Railway remains
the product/job host. No independently enforced browser private-IP/DNS firewall
is claimed. The privileged asset-fetch owner remains public-only and DNS-pinned;
inspection credentials remain generation-scoped and never enter browser headers.

The working branch now wires screenshot capture to dedicated Cloudflare session
acquisition and cleanup and removes the obsolete custom worker package. Staging
provisioning uses the same path with distinct production/preview tokens. The
production legacy service remains untouched until the replacement is verified.
Scoped machine-token creation consent, actual unpublished R2 capture, isolated
hosted proof and final reviewed rollout remain pending. The old staging hostname
has a TLS mismatch and cannot supply current uploaded-release proof. Fresh built
Pong and owned HTTPS/WSS probes already pass through the hardened routing owner;
these establish compatibility, not deployed capture or provider network guarantees.
See the
[built-game proof](./audits/v1-security/2026-10-04-cloudflare-game-capture-proof.json),
[routing proof](./audits/v1-security/2026-10-03-cloudflare-routing-proof.json),
[provider proof](./audits/v1-security/2026-10-03-capture-provider-proof.json) and
[managed capture plan](./plans/release-browser-worker-containment-plan.md).
No permanent bee service, tunnel, DNS change or production worker switch is live.
Final GitHub review, exact package/artifact compatibility and coordinated live
cutover remain unproven. Production code and database are unchanged.

The four creator recovery surfaces are preserved at `315a273c`; private asset
fetching and the unwired managed-session candidate are preserved at `cbe41501`.
The integrated local batch passes, and the authorized Sol review of the new
delta found no actionable source blockers. Its browser regression coverage gap
is restored and passes. Local confidence is not hosted or production sign-off.
The integration is now [draft PR 112](https://github.com/vucinatim/air-jam/pull/112)
with auto-merge off. Its first CI passed five confidence lanes, including database
tests, but rejected a stale public-ID-only reconnect benchmark. The benchmark is
corrected without weakening the strict profile. The CLI approval, account draft
and analytics recovery batch is now pushed at `11a76bf6`. Its authorized Sol
review found one account identity race, corrected with two red/green regressions;
all 55 creator recovery tests and source/test typechecking/lint pass. All six
[CI lanes](https://github.com/vucinatim/air-jam/actions/runs/37169046827) and the
[public installation matrix](https://github.com/vucinatim/air-jam/actions/runs/37169046830)
passed on that revision. The aggregate confirms the same immutable package set
on Linux, macOS and Windows with Node 22 and 24. Candidate `b4389cb8` is GitHub's
test merge of production `db85cdea` and PR head `11a76bf6`, not a production
merge or package publication. See the
[reviewed creator recovery evidence](./audits/v1-public-release/creator-entrypoint-audit.md#reviewed-account-identity-ownership).
The PR remains draft. Hosted/mobile proof, the pending managed-isolation choice,
final integration, the single final GitHub review and production cutover remain
open; no production state changed.

The validated machine program now reports `80%` estimate-weighted progress and
`39–77` remaining agent-hours, with 30 of 46 work items complete. These are
planning estimates, not a release-date promise. They include product polish that the
older infrastructure-heavy plan failed to own explicitly.

The current priorities are:

1. execute the ratified public 1.0 contract: one `Air Jam` product, a complete
   agent-operable development harness, and no separate mandatory hosted editor
2. finish the launch-critical host-authority boundary without changing the
   ordinary room-code experience
3. explicitly polish homepage, Arcade, mobile joining, reconnect, representative
   games, and public failure states
4. build on the completed Claude Desktop interoperability proof and run one
   final reusable external-agent lifecycle
5. build on the locally proven spend brake, emergency pause, and bounded
   evidence retention; finish the honest operating envelope and residual
   security risk
6. finish package, documentation, demo, article, and distribution work against
   one exact release candidate
7. launch with a free creation harness and useful hobby cloud inside an explicit
   cost envelope, rather than tying sustainability to signup count
8. keep development fast through the canonical
   [check layers](./working-agreements.md#development-check-layers), then use the
   [review and merge rules](./working-agreements.md#review-stacks-and-integration)
   and
   [production-delivery rules](./working-agreements.md#production-delivery-and-public-launch)

The launch-load recovery smoke now passes after correcting a reproduced usage-
projection race and a database-driver reservation-ownership defect. The driver
repair is included in the server bundle and deployment dependency stages.
The extracted artifact also exposed and now passes a disconnected-pool shutdown
regression; all 18 focused driver cases pass, including healthy query draining.
The full drill is complete: 100 rooms / 30 minutes and 200 rooms / five minutes
met their latency/cadence checks with zero message loss. The strict command
still failed at the 300-room admission ceiling (78/103 ms input/state p95 versus
50 ms). Room 301 was safely rejected and database recovery took 4.4 seconds.
This supports a bounded local envelope, not a 300-room performance promise.
No production change was made.
See the [rehearsal evidence](./audits/v1-reliability/launch-load-rehearsal-proof.md).
The full local batch and its single Canonicalizer review passed. The bounded
operating envelope, recovery limits, outage analytics loss, and cost exclusions
are published in that evidence; `G3-04` and `G3-05` are complete. Return to the
remaining security/creator work and reviewed delivery rather than expanding
this measurement into another scale program. Do not infer deployed release
readiness from local measurements.

## What Is Structurally Done

These are now baseline truths, not open architecture debates:

Player participation and host ownership are now separate in the local source.
Room codes still join normally; they cannot authorize fabricated host actions
or take over another player's slot using public IDs. Agent-owned browsers use
the existing host-local dispatcher through private IPC, with real standalone
and embedded Pong proof. See the
[session contract](./contracts/agent-session-contract.md#player-participation-and-host-ownership)
and [security evidence](./audits/v1-security/threat-model-audit.md#aj-sec-005--room-code-and-optional-controller-capability-grant-excessive-authority).
This is not deployed security-gate closure: browser-worker containment, abuse/
privacy findings, and coordinated reviewed delivery remain open.

The second supported agent client is now proven locally: Claude Desktop
independently discovered the registry-installed candidate, started its runtime,
opened a semantic session, changed and re-read authoritative game state, and
closed everything it started. See the
[retained client proof](./audits/v1-golden-path/claude-desktop-interop-audit.md).
This does not claim a frozen final candidate, public package promotion, or
production rollout; current launch-experience changes remain on the local
working branch.

The practical platform controls and supply-chain reconciliation are locally
complete. Shared admission rules now cover new costly work, with one atomic
emergency-pause command and selective recovery; see the
[control proof](./audits/v1-reliability/platform-spend-brake-proof.md). The
[trust handoff](./audits/v1-security/supply-chain-release-trust-proof.md)
explicitly leaves final npm registry/provenance and production observation to
the exact-candidate rehearsal. Neither local closure is a deployment claim.

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
    6. the generated project discovers the canonical CLI, all `27` MCP tools,
       project-scoped Codex configuration, managed dev lifecycle, typecheck,
       lint, tests, and production build
    7. the MCP server reports its shipped package version rather than a
       hard-coded version
    8. the standalone MCP tool set now has one canonical machine-readable
       contract shared by server registration and clean-room verification
    9. `create-airjam` packs to `87,164,321` bytes because it embeds all six
       scaffold archives; Gate 6 now enforces that value beneath a 100 MiB
       package ceiling and proves cold scaffold installation below ten minutes
       on every supported cell
    10. early retained Codex runs independently built the full Signal Relay
        game and turned browser, session, evaluation, evidence, staging, and
        upload failures into classified product findings
    11. independent review reopened `G2-03`: the retained local run remains
        useful diagnostic evidence, but its ignored artifact path was not
        independently retrievable and the controller could trust agent-authored
        verification claims
    12. the corrected controller owns isolation probes, quality gates, cleanup,
        and release-verification authority; the new durable `a22` replay passed
        the complete create, control, inspect, fault-repair, visual, evaluation,
        hidden-release, verification, and cleanup lifecycle
    13. the integration review further made staging isolation environment-wide
        and fail-closed, made evidence retention rollback-safe and extension
        independent, and bounded external-agent plus cleanup process lifetimes
    14. `G2-04` still owns independent Claude Desktop proof, and `G2-05` owns
        final replay plus residual-friction closure across both supported clients
    15. the final PR review's four delivery findings are closed: deployed staging
        credentials can rotate after expiry, `G2-03` names the actual deployed
        commit, semantic sessions no longer gain an implicit browser controller,
        and Unicode release filenames use an ASCII-safe signed metadata contract
    16. production R2 browser-upload CORS now targets `https://airjam.io`, and a
        real presigned preflight returns the expected origin, methods, and exact
        signed upload headers
15. Gate 4 now has one agent-operable operational authority contract:
    1. product telemetry, authoritative lifecycle/runtime facts, and durable
       incidents remain separate evidence planes
    2. deterministic fingerprints bind incident identity to exact normalized
       failure scope
    3. runbook preview/apply binds exact descriptor, parameters, context,
       expiry, actions, and blast radius through SHA-256 digests
    4. approval, bounded automation, verification, rollback, and terminal
       evidence rules fail closed
    5. all fourteen schema families are inspectable as Draft 7 JSON Schema and
       runtime-validatable through the canonical repo CLI
16. Gate 4 now also has one durable reliability loop:
    1. authoritative producers persist events through a transactional outbox
       and immutable event store instead of relying on process memory
    2. bounded leases, retries, dead-letter state, audited requeue, and expired-
       lease repair make delivery safe to operate through the repo CLI
    3. six launch-critical synthetic stories continuously feed four explicit
       SLO evaluations and durable alert state
    4. platform, server, and hosted-runtime failure producers emit structured,
       redacted evidence with server-owned authority and identity
    5. worker and platform readiness report their true release dependencies
       while process liveness remains an independent deployment signal
17. Gate `G5-01` now has one ranked threat model:
    1. public, privileged, artifact, runtime, agent, provider, privacy, and
       supply-chain boundaries were independently reviewed and centrally
       deduplicated
    2. the audit identified one critical launch blocker—creator executable
       releases falling back to the authenticated platform origin—which the
       first `G5-02` slice has since removed
    3. thirteen high-priority threat groups now have exact ownership, canonical
       end states, and hostile proof requirements
    4. production browser-worker credentials are present, so the worker finding
       is a fail-open architecture and egress gap rather than an unsupported
       claim of current anonymous exposure
    5. implementation remains in `G5-02` and `G5-03`, with one final batched
       human residual-risk review in `G5-04`
18. the first `G5-02` implementation slice is now merged and production-valid:
    1. hosted game code has no authenticated-platform-origin fallback
    2. production requires an explicit cross-site release origin outside Better
       Auth trust, and build/runtime platform identity drift fails readiness
       while liveness remains process-only
    3. incoming `Host` authority, not Next's server-derived request URL, owns
       platform-versus-release routing; release, platform, and unknown hosts
       fail into explicit lanes
    4. host and controller frames share one sandbox and Permissions Policy
       contract
    5. the repo CLI can inspect local or deployed `ready`, `disabled`, and
       `invalid` state as stable JSON
    6. unit, real-Next-server Host routing, and hostile-browser proofs cover the
       local contract
    7. a second repo-CLI surface can attest an exact deployed host/controller
       pair without executing creator code: it pins DNS, bounds requests and
       TLS, independently checks cookie-site separation, redirects, exact
       response policy, Better Auth and protected-endpoint CORS isolation,
       stable deployment identity, and the exact Railway project/current
       service deployment/both-domain binding
    8. only provider-authenticated public-HTTPS runs can become production
       evidence; loopback, missing project identity, and missing provider
       authority stay explicitly diagnostic
    9. the selected dedicated production domain, `games.air-jam.app`, is now
       provisioned, deployed, and attested end to end; the separate observation,
       rollback-proof, and legacy-host work remains governed by
       `docs/plans/hosted-release-domain-cutover-plan.md`
    10. corrective PR `#76` passed exact-head Canonicalizer and Claude Opus
        review, CI, standalone-artifact proof, Railway previews, and an exact
        production rollout: platform deployment
        `8dbde4b3-3059-4bfd-8ba6-93deccbde995` reached terminal `SUCCESS`, and
        live liveness reported merged revision
        `e122a52c1da49ef409364c93fb675df56a4e639d`
19. the production hosted-release cutover is complete and evidence-backed:
    1. all six public catalog games use `https://games.air-jam.app` while public
       links, rooms, controllers, QR codes, and reconnect remain on `airjam.io`
    2. production schema drift from migration `0020` to `0033` was recovered
       after an isolated PostgreSQL 17 restore rehearsal, exact write drain,
       and fresh checksummed backup
    3. merged revision `ebf63d8a0d5587f27ba59adf48213fb71f20340b`
       is live on terminal-success Railway deployment
       `e65c8e41-3f72-4078-9ce0-443695d296a2`
    4. the browser smoke matrix passes `7/7` and the canonical production
       attestation passes `20/20` with verified Railway identity and
       `productionEvidenceEligible: true`
    5. the exact outcome, provider identifiers, recovery facts, and remaining
       scope are retained in the
       [hosted-release cutover evidence](./audits/v1-security/hosted-release-domain-cutover-evidence.md)
20. the production recovery surface is complete and live-proven:
    1. Railway recurring backups have exact daily, weekly, and monthly policy
       with provider read-back
    2. a fresh PostgreSQL 17 snapshot restored into a disposable Railway
       PostgreSQL 18 environment with exact schema-head and all-table-count
       verification; the environment and local proxy were removed afterward
    3. durable job replay preserves exact lineage, actor intent, correlation,
       resource scope, and one audited replay event, while ineligible replay
       fails with a structured escalation bundle
    4. deployment recovery is preview-first and fences exact project,
       environment, service, current deployment, target revision or image,
       provider result, exact public deployment identity, actor, and reason;
       Railway rollback instances report no runtime revision, so the provider
       record remains revision authority
    5. the final production backward rollback verified in 10,526 ms and forward
       recovery verified in 8,248 ms; production was left on the newest reviewed
       revision
    6. the complete measurements, safe discovery failures, provider IDs, and
       evidence digests live in the
       [production recovery proof](./audits/v1-reliability/production-recovery-proof.md)

## What Is Still Open

The roadmap now organizes the remaining work into explicit evidence gates:

1. external-agent golden-path proof
2. remaining launch-scale reliability, backpressure, cost, and overload proof
3. exact-candidate observation of the deployed operational sensors and
   production delivery proof for the deduplicated GitHub issue bridge
4. security, abuse, privacy, and supply-chain trust
5. final public documentation, demo, article, npm prerelease, and promotion
   proof
6. one immutable release rehearsal and final go/no-go decision

## Active Now

The 1.0 release roadmap is the governing product plan:

1. [plans/v1-release-roadmap-plan.md](./plans/v1-release-roadmap-plan.md)

The subordinate execution plan and machine manifest own dependency-aware daily
work state without becoming a second product authority:

1. [plans/v1-release-execution-plan.md](./plans/v1-release-execution-plan.md)

The foundation integration through PR `#61`, the production-health recovery in
PR `#76`, the public install matrix in PR `#74`, and the durable reliability
loop in PR `#75` are merged. The later
[production realtime admission proof](./audits/v1-reliability/production-realtime-admission-proof.md)
records the coordinated platform, realtime, and operational-worker rollout,
schema head `0039`, and initial healthy worker readiness with a complete
synthetic batch. Current deployment identity comes from the live
`/api/readiness` machine contract; retained deployment proof is not a fresh
health check. Live browser smoke covers the landing page, direct Arcade
navigation, branding, and game-card hover behavior. The operational worker is
deployed; a complete recurring-retention observation window and final
operational rehearsal remain `G3-08` / `G7-03` work.
Production code is delivered incrementally; stable package promotion, public
release visibility, final docs, the launch article, and distribution are
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

Gate `G2-02` is independently re-closed after review found that the first
bootstrap run proved package versions and registry configuration without
positively binding installed bytes to that run's packed candidates. The proof
now compares SHA-512 integrity across the tarballs, registry metadata, and
generated lockfile; requires all lifecycle scripts and all `27` MCP tools; uses
bounded command, protocol, registry, and workspace-lock waits; and passes a
fresh managed-dev plus typecheck, lint, test, and build run. That replay also
fixed standalone topology so a configured Vite port is advertised consistently
to hosts, controllers, sockets, and readiness tooling.

Gate `G6-01` is closed by the
[public install matrix audit](./audits/v1-public-release/public-install-matrix-audit.md).
The exact five-package candidate graph passed clean `npx` creation, CLI and all
27 MCP tool discovery, managed development, and generated-project typecheck,
lint, tests, and build on Linux, macOS, and Windows across Node.js 22 and 24.
All six cells stayed inside explicit package, install-time, cell-time, and
archive-extraction budgets. The proof used a fallback-free candidate registry
and empty cache, so neither an old npm package nor the monorepo could satisfy
it; npm and production were not changed.

Gate `G2-03` now has a terminal passing Codex primary run. The external agent
started in an empty workspace without repository access, maintainer/provider
credentials, or undeclared network access; discovered the five public
candidate packages; implemented Signal Relay; passed the complete quality
evaluation; operated two controllers through semantic sessions; diagnosed and
repaired the declared win-score fault; captured and inspected host/controller
visuals; submitted a ready hidden release to provider-attested isolated
staging; and cleaned every run-owned process and identity. The complete
sanitized transcript and decisive machine evidence are retained in
[the primary-agent audit](./audits/v1-golden-path/primary-agent-run-audit.md).
`G2-04` remains the independent Claude Desktop proof, and `G2-05` remains the
final settled-client replay and residual-friction closeout.

Gate `G2-02` is closed at `511ee85` with the
[public bootstrap audit](./audits/v1-golden-path/public-bootstrap-audit.md).
The exact five-package candidate graph was built, packed, published to a fresh
loopback registry with Air Jam upstream fallback disabled, installed from a
clean scaffold, exercised through CLI and raw MCP, and removed after all
generated-project quality gates passed. No npm package or production system was
changed.

Gate `G5-01` is closed by the
[ranked security threat model](./audits/v1-security/threat-model-audit.md). Its
highest-priority result is that creator-controlled executable game bytes must
move to a dedicated cookieless origin with strict iframe and browser policies
before 1.0. The audit deliberately leaves implementation open in `G5-02` and
`G5-03`; it does not treat documenting a threat as fixing it.
Gate `G4-01` is closed with the
[operational events and incidents contract](./contracts/operational-events-and-incidents-contract.md)
and its [proof](./audits/v1-operations/operational-contract-proof.md). The
private runtime package, TypeScript declarations, JSON Schema export, and repo
CLI now share one versioned model for events, correlation, incident state,
runbook descriptors, immutable previews, invocations, and action audit records.
Gates `G4-02` and `G4-07` are closed by the production-valid reliability layer
and its foundation hardening through the
[operational reliability contract](./contracts/operational-reliability-contract.md)
and its [proof](./audits/v1-operations/operational-reliability-proof.md): durable
event delivery, structured platform/server/runtime failures, six synthetics,
four SLOs, durable alerts, truthful worker readiness, and one agent-operable CLI
surface. Retained failure details now use an adversarial recursive redaction
vocabulary, event and failure identities share one normalized code, synthetic
chronology is database-owned, each scheduled check is isolated and reported,
and older SLO evaluations cannot regress newer alert state. Scheduling is a
separate orchestration module rather than another responsibility in the
persistence service. The
[production worker proof](./audits/v1-reliability/production-operational-job-worker-proof.md)
records the deployed worker and its initial healthy readiness. Final
observation, drain, rollback, and cost evidence remain in the exact-candidate
rehearsal rather than a second activation project.
Gate `G4-03` is closed by the
[operational alert issue projection contract](./contracts/operational-alert-issue-projection-contract.md)
and its
[proof](./audits/v1-operations/operational-alert-issue-projection-proof.md).
Each alert key now owns one leased, bounded, deduplicated GitHub issue
projection with create, update, recovery close, recurrence reopen, marker-based
reconciliation, preserved discussion, inspectable dead letters, and a complete
preview-first repo CLI lifecycle. The issue-only GitHub App identity belongs
only on the operational worker.
`G3-07` is locally complete with the approved 30-day history / 90-day command
policy, protected incident evidence, and one indexed collector shared by the
existing worker and cursor-capable repo CLI. The
[retention proof](./audits/v1-reliability/operational-evidence-retention-proof.md)
includes real concurrent-writer tests and a 1.2-million-row month-sized fixture.
The full-document benchmark exposed buffered-index lookup cost; configuring
the four evidence indexes for direct updates fixed it. Final preview took
2.3 seconds and apply 0.7 seconds, retaining all 299,000 recent runs.
Migration `0040`, reviewed
delivery, and live observation remain separate: no production cleanup has run
as part of this work. Remaining observation dependencies gate `G3-08` closure.
Initial worker health does not prove a complete recurring evaluation window
or production GitHub issue delivery. A generic incident lifecycle and governed
automatic-remediation engine are intentionally not 1.0 requirements: smart
local agents should use the shared evidence and focused Air Jam, Railway,
GitHub, and local tools instead.

Gate `G3-01` is closed with the
[production capacity, cost, and recovery audit](./audits/v1-reliability/production-capacity-cost-and-recovery-audit.md).
Production currently costs about `$8` per Railway cycle, uses little database
and object-storage capacity, and showed no `5xx` in the sampled seven-day
traffic. At the time it was captured, the audit identified synchronous release
work, dynamic release delivery, process-local realtime authority, no recurring
database backup, no app-specific spend brake, incomplete lifecycle cleanup,
and no continuously proven alert/rollback path. Recurring backup and exact
rollback have since been closed by `G3-03`; the remaining gaps retain their
current owners. No production state was changed by the original audit.

Gate `G3-02` is active. Its first production-valid slice establishes the
[production control contract](./contracts/production-control-contract.md),
persistent and audited lane modes, typed fail-closed admission decisions, and
preview-first CLI operation. Release submission, artifact ingestion, release
processing, browser validation, moderation, media ingestion, and telemetry now
share that application-service authority. Its second slice adds the
[production budget evidence proof](./audits/v1-reliability/production-budget-evidence-proof.md):
Railway project usage now flows through immutable evidence, reviewed thresholds,
derived state, freshness reporting, idempotent replay, and the canonical repo
CLI. Its third slice adds the
[production shadow quota proof](./audits/v1-reliability/production-shadow-quota-proof.md):
the ratified allowances now live in one versioned source catalog, lifecycle and
runtime records produce creator/game usage, and the canonical CLI explains
shadow versus enforced decisions. Durable jobs, application-service wiring,
cleanup, realtime admission, and overload proof remain part of the same
unfinished gate. Its fourth slice adds the
[production durable job authority proof](./audits/v1-reliability/production-durable-job-authority-proof.md):
PostgreSQL now owns bounded queues, fair transactional claims, fenced leases,
heartbeats, absolute deadlines, retries, cancellation, replay lineage, repair,
global immutable command replay, and append-only job events. Claims honor the
persisted lane mode, release checks cannot cross release scope, and the repo CLI
uses redacted operator projections rather than lease-bearing worker records.
The fifth slice adds the
[production immutable release generations proof](./audits/v1-reliability/production-immutable-release-generations-proof.md):
every upload now has immutable generation identity, first-observed object
facts, create-only source and output keys, explicit candidate/promoted pointers,
generation-scoped checks, and fail-closed legacy migration. Public serving,
publishing, quotas, dashboard, machine API, SDK, CLI, and MCP now agree on that
generation model. Its sixth slice adds the
[production operational job worker proof](./audits/v1-reliability/production-operational-job-worker-proof.md):
finalize now enqueues a strict generation-scoped three-stage job graph, a
separate drainable worker owns execution, attempts isolate retry outputs, and
dashboard, API, SDK, CLI, and MCP share enqueue, inspect, wait, and publish
semantics. The old synchronous finalizer is gone. Its seventh slice adds the
[production lifecycle cleanup proof](./audits/v1-reliability/production-lifecycle-cleanup-proof.md):
the operational worker now schedules and executes exact, resource-scoped
cleanup for terminal release generations and inactive unassigned media. The
first object manifest survives partial deletion and retries, database
tombstones control quota accounting, and the canonical CLI provides redacted
preview/apply plus resource-filtered inspection. Superseded unpublished
generations now also have a PostgreSQL-enforced 180-day lifecycle with a
durable seven-day warning, creator export through dashboard/API/CLI/MCP, and
retention renewal when exported or published. Its eighth slice adds the
[production realtime admission proof](./audits/v1-reliability/production-realtime-admission-proof.md):
PostgreSQL now owns global hosted room and controller admission, lease expiry,
single-replica rolling handoff, graceful drain, and creator/game shadow policy
without changing the player-facing room-code flow. Protected PR `#109` passed
the full CI and public-install matrix, Canonicalizer, and one GitHub-native Opus
review before merging. Platform, realtime, and operational-worker production
deployments all converged on merge revision
`e6f03c1fd0f97d5f591ab99f6d2d98042da7e28b`; platform schema and hosted-release
boundaries were ready, realtime accepted work with required budget authority,
and the worker reported fresh budget evidence, no degraded required authority,
and a clean `6/6` synthetic batch. `G3-02` remains open only for deliberate
load/overload/recovery and remaining spend-guard/kill-switch closure evidence.

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

The canonical architecture and delivery order now lives in
[the remaining-1.0 section of the execution plan](./plans/v1-release-execution-plan.md#remaining-10-architecture).
In short:

1. finish review and coordinated delivery of the existing host-authority branch
2. complete the new `G6-07` creator/player experience pass before more
   infrastructure expansion
3. build on completed Claude Desktop discovery/session bootstrap, then run one
   final golden path whose evidence also becomes the launch demo source
4. use the locally completed spend brake, emergency pause, and bounded evidence
   protection in one honest load/dependency-recovery drill (`G3-04`)
5. use the reconciled supply-chain proof and present the residual security
   checkpoint
6. finish docs/demo/story against the polished shipped behavior, then cut and
   rehearse one immutable 1.0 candidate
7. reuse completed recovery, migration, alerting, install-matrix, and Codex
   proofs rather than rebuilding them
8. agents continue to claim, complete, or block work only through the canonical
   readiness manifest

## Current Caveats

1. the repo has enough implemented infrastructure that the main risk is now
   committing to stale assumptions or freezing accidental complexity
2. the production baseline and recovery path are measured; launch still
   requires `100` concurrent rooms and `400` controllers sustained for `30`
   minutes, a `5`-minute two-times admission attempt, safe overload behavior,
   and one dependency-recovery proof
3. product telemetry anonymous-session and actor-class counts are approximate
   discovery measures, not durable people or identity proof
4. self-healing should emerge from smart agents running against strong sensors,
   shared evidence, and focused tools; a generic runbook or code-changing
   automation engine is post-1.0 and must be justified by real incidents
5. monetization mechanics are intentionally deferred until activation or
   requested value is real; existing metering, bounded queues, admission, and
   alerts need only one practical spend brake and emergency stop path for 1.0

## Canonical Read Order

For a fast orientation pass:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. this file
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the currently relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed

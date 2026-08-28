# Tooling and Public Contracts Canonicalization Audit

Last updated: 2026-08-28
Status: complete; cross-reviewed
Finding range: `CAN-200` through `CAN-299`

This lane follows [audit-contract.md](./audit-contract.md). It reviews the
public bootstrap and project tooling, the MCP adapter, shared devtools services,
repository automation, generated guidance, package contracts, and the paths an
external developer or agent actually receives.

## Lane Map

### Public bootstrap and project commands

- `packages/create-airjam/src/index.ts` is the `create-airjam` and `airjam`
  binary composition root. It currently combines one-shot scaffolding with AI
  pack management, hosted game and media management, release operations,
  machine authentication, MCP configuration, local status/reset, dev, secure
  setup, and topology.
- `packages/create-airjam/src/scaffold.ts` turns repo-owned game archives into
  standalone projects and normalizes their scripts and package dependencies.
- `packages/server/src/cli.ts` is the installed `air-jam-server` binary. In
  addition to server start and logs, it currently owns the generated project's
  dev, secure-init, topology, status, and reset commands.
- `packages/create-airjam/runtime/` and
  `packages/server/src/project-cli/` both contain project-runtime command
  implementations. Several pairs are byte-identical, and the others differ
  primarily in command labels and error-boundary text.

### Shared services and adapters

- `packages/devtools-core/src/` contains the private shared operations for
  project/game inspection, dev lifecycle, semantic game sessions, logs,
  quality, hosted auth, games, media, releases, and visual tooling.
- `packages/mcp-server/src/tools.ts` adapts those operations to MCP tools.
  `packages/mcp-server/src/server.ts` selects tools by project mode and owns
  MCP registration and task-backed execution.
- `packages/create-airjam/src/index.ts` also adapts the same hosted auth, game,
  media, release, status, and reset services to terminal commands, although its
  outputs are not governed by one machine-output contract.

### Repository operations

- `scripts/repo/cli.mjs` is the canonical maintainer composition root.
- `scripts/repo/commands/` owns maintenance domains such as workspace, release,
  readiness, Railway, content, scaffold verification, standards, and smoke
  tests.
- `scripts/workspace/` is a thin repo adapter over
  `packages/devtools-core/runtime/`, but several `scripts/workspace/lib/*.mjs`
  modules are now one-line re-export paths retained between the command and its
  actual owner.

### Templates and generated guidance

- Repo games and their `airjam-template.json` manifests are the source for
  deterministic archives under `packages/create-airjam/scaffold-templates/`.
- `packages/create-airjam/template-assets/base/` adds the generated project's
  `AGENTS.md`, client note, MCP config, docs, and skills.
- `content/docs/` is the source of 13 generated Markdown references, while
  additional operational docs and skills are authored directly in the base
  pack.
- `.airjam/ai-pack.json` and the hosted AI-pack manifests define file hashes,
  versions, channels, and update locations.

### Public package and release boundary

- `scripts/release/public-packages.mjs` defines four public packages:
  `@air-jam/sdk`, `@air-jam/server`, `@air-jam/mcp-server`, and
  `create-airjam`.
- `scripts/release/prepare-public-package-manifest.mjs` resolves workspace
  protocols and removes private workspace dependencies from published
  manifests.
- `create-airjam` bundles private `@air-jam/devtools-core`; MCP separately
  bundles it. This is the intended mechanism for sharing private domain
  services without publishing the private package.

## What Is Already Canonical

1. The repo maintainer surface has one discoverable entrypoint. `pnpm run repo
-- --help` exposes bounded command domains, and readiness reads provide
   stable JSON. The readiness contract tests cover status, next, inspection,
   mutation preview, evidence, and manifest validation.
2. Template source ownership is sound. `games/*` remains the editable source,
   `generate-scaffold-sources.mjs` produces deterministic zip archives, and
   `check-scaffold-sources.mjs` compares the manifest, archives, config, and
   semantic agent-contract presence against every scaffoldable source game.
3. The MCP gameplay surface has already converged on high-level semantic game
   sessions. Registered tools expose open, send input, read, invoke, and close;
   low-level controller, raw snapshot, and harness actions are intentionally
   absent from the registered public surface and tests assert that boundary.
4. Hosted operations mostly reuse shared services instead of reimplementing
   HTTP business rules in adapters. Both the terminal and MCP adapters call
   `@air-jam/devtools-core` for auth status, game/release inspection, release
   validation/bundling/submission/publication, status, reset, and topology.
5. The MCP tool selection is mode-aware. Unknown directories expose only
   project inspection, monorepo mode avoids standalone bundle/submit tools, and
   standalone projects receive the local release lifecycle.
6. AI-pack drift is explicit and hash-based. Status and diff are compare-first,
   updates are declared as replacement rather than merge, scaffold identity is
   preserved in the local manifest, and generated public-doc snapshots have a
   freshness check.
7. Public package selection and version unification have one release source in
   `scripts/release/public-packages.mjs`, with registry, tarball, and scaffold
   smoke lanes already represented in repository scripts.

## Findings

### CAN-200 — Fresh projects do not contain the documented `airjam` project CLI

- Category: canonicality
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/create-airjam/package.json` publishes both
  `create-airjam` and `airjam` from `dist/index.js`;
  `packages/create-airjam/src/index.ts:1292-1942` combines scaffolding and all
  ongoing project/platform commands; `packages/create-airjam/src/scaffold.ts`
  `normalizeScaffoldPackageJson` adds only `@air-jam/server` and
  `@air-jam/mcp-server`, and writes dev/topology/secure/status/reset scripts
  against `air-jam-server`; `packages/create-airjam/template-assets/base/AGENTS.md`
  directs agents to `pnpm exec airjam mcp doctor`, `airjam mcp init`,
  `airjam status`, and `airjam reset local`; the base docs also direct users to
  `airjam ai-pack` and `airjam release`; `README.md` describes
  `create-airjam` only as the scaffolder. A consumer search found no generated
  project dependency on `create-airjam`.
- Current behavior: `npx create-airjam` temporarily runs the bootstrap package,
  but the created project does not install that package. The generated
  project's actual ongoing CLI is `air-jam-server`, while its agent contract,
  docs, AI-pack workflow, and hosted-release guide repeatedly invoke an absent
  `airjam` binary. At the same time, the one-shot scaffolder carries an ongoing
  CLI implementation that users do not retain.
- Architectural harm: the advertised agent-first front door fails at the first
  clean-project boundary, and command ownership is split across a scaffolder
  and a server package. This is not a documentation typo: AI-pack management,
  MCP doctor/init, hosted games/media/releases, and auth have no installed
  terminal owner in a normal generated project. Agents must rediscover package
  internals or install an undocumented package to proceed.
- Canonical end state: one installed Air Jam project CLI owns the complete
  post-scaffold developer and operator lifecycle. The one-shot scaffolder only
  creates projects. The server binary only owns server-specific runtime and log
  behavior. The project CLI and MCP adapter invoke shared domain services and
  use the same nouns and result contracts.
- Change: establish the canonical installed CLI package/binary, add it to every
  generated project, move all ongoing commands out of `create-airjam`, remove
  duplicate project-runtime commands from the non-owning packages, and purge
  the obsolete aliases and copied implementations with no compatibility path.
  Generate documentation examples from the final command catalog rather than
  maintaining competing command names.
- Dependencies and blast radius: public package policy and release automation,
  `create-airjam`, `@air-jam/server`, `@air-jam/mcp-server`,
  `@air-jam/devtools-core`, scaffold normalization, all template archives,
  generated docs/skills, platform developer commands, registry smoke tests, and
  Gate 2 clean-room proofs.
- Validation: a registry-only clean scaffold installs once and can discover and
  execute the documented `airjam` lifecycle without the Air Jam monorepo or a
  global binary; consumer tests exercise MCP setup, status/reset, topology,
  AI-pack status, hosted auth/game/media/release operations, and prove that only
  one source implementation owns each project-runtime command.

### CAN-201 — The terminal surface is not a complete stable machine contract

- Category: agent-operability
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `pnpm --filter create-airjam exec tsx src/index.ts --help` exposes no
  global `--json` or output-mode option; `packages/create-airjam/src/index.ts`
  prints colorized prose for hosted game, media, release, auth, doctor, and
  AI-pack reads, while only selected status/reset/topology paths print JSON;
  the same CLI has no start/stop managed-dev commands and no semantic game
  session commands. `packages/mcp-server/src/tools.ts` exposes structured
  `start_dev`, `stop_dev`, and the five semantic game-session operations over
  shared services. The CLI runtime test suite in
  `packages/create-airjam/runtime/cli.test.mjs` asserts help text, not stable
  result documents. `docs/plans/v1-release-roadmap-plan.md` defines terminal and
  MCP profiles as portable machine contracts.
- Current behavior: a terminal agent can use a few JSON reads, but completing
  the lifecycle requires parsing human prose or switching to MCP. The service
  layer already returns typed values; the loss of structure occurs in the CLI
  adapter.
- Architectural harm: terminal agents are a launch-supported profile, not an
  emergency fallback. Human formatting as the only output for important reads
  prevents reliable composition, automated recovery, evidence capture, and
  lifecycle agents. The incomplete CLI also makes MCP appear to be a separate
  product instead of another adapter over the same capability catalog.
- Canonical end state: the installed project CLI exposes the full supported
  semantic lifecycle with versioned structured results. Reads and mutations
  have stable JSON output; human presentation is an explicit adapter or mode.
  CLI and MCP need not have character-for-character names, but every supported
  lifecycle capability must be discoverable, invocable, inspectable, and
  safely closable from both portable profiles through the same services.
- Change: define one typed command/result catalog, add CLI adapters for managed
  dev start/stop and semantic game sessions, add a consistent JSON contract to
  hosted and local commands, separate rendering from orchestration, and add
  contract tests that compare CLI and MCP semantics rather than only help text.
- Dependencies and blast radius: the canonical CLI decision from CAN-200,
  `@air-jam/devtools-core` result types, MCP tools, auth and hosted release
  services, docs, error envelopes, shell automation, and Gate 2 replay/evidence
  capture.
- Validation: a clean terminal-only agent completes inspect, dev start/status,
  session open/read/invoke/close, quality, auth, game/media, release
  submit/inspect/publish, and dev stop using JSON that passes published schemas;
  parity tests prove CLI and MCP adapters reach the same service behavior and
  return equivalent domain identities and states.

### CAN-202 — The published MCP bundle resolves an undeclared runtime dependency

- Category: public-contract
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/devtools-core/src/agent.ts`, `controller.ts`, `visual.ts`,
  and `tooling/airjam-agent-inspection.ts` resolve `tsx/package.json` at runtime
  to execute TypeScript consumer config/contract helpers;
  `packages/mcp-server/tsup.config.ts` bundles `@air-jam/devtools-core` but does
  not bundle `tsx`; a local MCP build leaves four
  `require.resolve("tsx/package.json")` calls in each published entry such as
  `packages/mcp-server/dist/server.js`; `packages/mcp-server/package.json` lists
  `tsx` only in `devDependencies`. Workspace MCP tests run with the root
  dependency graph and therefore cannot detect an isolated consumer install.
- Current behavior: the published MCP server can start without touching these
  paths, but agent-contract inspection, game-session setup, controller helpers,
  and visual/config inspection can fail in an isolated production install when
  they attempt to resolve `tsx`.
- Architectural harm: the package advertises these tools as supported while
  omitting a module required by their runtime implementation. Workspace
  hoisting hides the defect, so release tests can pass while a clean npm user
  fails inside the core agent workflow.
- Canonical end state: every external module resolved by the published MCP
  runtime is either bundled or declared as a production dependency. Consumer
  TypeScript loading has one explicit owner and one tested packaging strategy.
- Change: choose and document the consumer-config execution strategy, bundle
  the required loader or declare it as a production dependency, and add an
  isolated packed-package MCP test that does not inherit workspace modules.
- Dependencies and blast radius: `@air-jam/mcp-server` package/build config,
  private devtools bundling, helper subprocesses, semantic game contracts,
  release config loading, npm release smoke tests, and public install size.
- Validation: install the packed MCP package with production dependencies only
  in an empty directory, scaffold or provide a TypeScript Air Jam config, and
  successfully call project inspection, agent-contract inspection, session
  open/read/close, and release doctor without resolving anything from the
  monorepo.

### CAN-203 — Generated agent guidance duplicates policy and ships an invalid required skill

- Category: simplicity
- Complexity: duplicated-capability
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/create-airjam/template-assets/base/` currently contains
  26 docs files, 11 skill/index files, `AGENTS.md`, and `CLAUDE.md`, totaling
  4,540 lines. The same preview-managed launch rule appears in `AGENTS.md`,
  `CLAUDE.md`, `docs/agent-gold-path.md`, generated quick start, and the
  `airjam-mcp` skill; the stale-runtime reset rule appears in six authored
  surfaces; semantic contract and raw-Vite rules are similarly repeated.
  `packages/create-airjam/template-assets/base/skills/airjam-mcp/SKILL.md` is
  the only skill in the pack without YAML `name` and `description` frontmatter,
  although `packages/create-airjam/scripts/ai-pack-contract.mjs` marks it
  required. `check-ai-pack.mjs` validates existence, manifest shape, generated
  file set, and freshness, but not skill metadata, links, commands, or semantic
  duplication.
- Current behavior: an agent is told to read `AGENTS.md`, a gold-path doc, a
  docs index, a skills index, and then a matching skill. Operational MCP,
  browser, preview, reset, and semantic-session rules recur across those
  layers. One of the most central skills may not be discoverable by clients
  that require standard skill frontmatter, yet the pack check reports it as
  complete.
- Architectural harm: additional agent-facing text is not free. Repeated rules
  consume context, create multiple update obligations, and make it unclear
  which file owns a changed command or policy. A required but malformed skill
  makes the local guidance layer look supported without proving client
  discovery.
- Canonical end state: `AGENTS.md` is a short stable project contract and
  router; one concise operational guide owns the normal Air Jam agent loop;
  client-specific files contain only real client differences; skills exist only
  for specialized task procedures that benefit from conditional loading.
  Command names and tool catalogs are generated or validated from executable
  contracts.
- Change: consolidate MCP/docs routing into the project contract and one guide,
  delete skills that only repeat global routing policy, reduce client notes to
  true deltas, remove repeated troubleshooting prose, and validate every kept
  skill's metadata, links, referenced commands, and tool names.
- Dependencies and blast radius: base AI pack, hosted pack generation,
  scaffolds, public docs exports, Codex/Claude discovery, prompt/context size,
  `check-ai-pack.mjs`, and all template smoke tests.
- Validation: clean generated projects expose every intended skill in at least
  the launch-certified clients; a guidance contract test validates frontmatter,
  references, and executable commands; each durable rule has one owner and all
  other surfaces link to it; the clean-room agent reaches the golden path
  without loading the whole pack.

### CAN-204 — The AI pack claims replacement ownership over user customization surfaces

- Category: ownership
- Complexity: unclear-ownership
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: `packages/create-airjam/src/ai-pack.ts`
  `collectPackagedAiPackFiles` recursively includes the whole base pack and
  `AI_PACK_UNMANAGED_ROOT_FILES` is empty; `runAiPackUpdate` replaces every
  differing managed file and only preserves the scaffold block inside
  `.airjam/ai-pack.json`; the managed set includes top-level `AGENTS.md`,
  `CLAUDE.md`, all local docs, and all skills. The workflow guide and generated
  quick start explicitly state that update replaces managed files and is not a
  merge. `runAiPackUpdate` requires force for same-version drift but replaces
  drift during a version upgrade without a per-file ownership decision.
- Current behavior: the system is honest about replacement, but it treats the
  project's natural local customization surfaces as vendor-owned snapshots.
  A developer who adds project-specific rules to `AGENTS.md` or adapts a skill
  must either keep the pack permanently stale or allow the next version update
  to overwrite that work.
- Architectural harm: this ownership model turns framework guidance upgrades
  into a choice between losing local project knowledge and losing canonical
  updates. It also encourages more centrally managed text because the pack has
  no clean extension seam, compounding CAN-203.
- Canonical end state: Air Jam-managed reference material lives in a clearly
  managed namespace or versioned artifact. User project contracts, notes, and
  custom skills remain user-owned. The scaffold can create a thin initial
  router once, but later pack updates do not overwrite local policy; local
  extension points are explicit and composable.
- Change: split managed reference assets from user-editable agent contracts,
  define one-way include/link boundaries, change the manifest ownership model,
  migrate scaffold generation to the new layout, and remove replacement
  authority over user-owned files.
- Dependencies and blast radius: AI-pack manifest schema and hosted artifacts,
  base template layout, scaffolds already created before 1.0, update/diff
  semantics, public docs, client skill discovery locations, and platform
  AI-pack serving.
- Validation: customize the generated project's agent contract and add a local
  skill, upgrade through at least two pack versions, and prove both local files
  are byte-preserved while managed references update and the client discovers
  both sources without duplicate policy.

### CAN-205 — MCP setup equates one `.mcp.json` file with portable client installation

- Category: agent-operability
- Complexity: poor-ergonomics
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/mcp-server/src/config.ts` defines only
  `AIRJAM_PROJECT_MCP_FILE = ".mcp.json"` and one JSON shape that runs
  `pnpm exec airjam-mcp`; `inspectMcpProjectSetup` and
  `writeProjectLocalMcpConfig` inspect/write only that file;
  `packages/create-airjam/src/mcp.ts` calls those functions for doctor/init and
  labels the result the recommended project-local configuration. Generated
  `docs/agent-mcp.md` says the project already ships a committed `.mcp.json`
  and tells any “MCP-capable client” to use it. A search of the live template
  pack found no Codex MCP installation/profile instructions and no Claude
  Desktop MCP installation/profile instructions; `CLAUDE.md` covers preview,
  not MCP registration. The 1.0 roadmap separately requires portable stdio,
  Codex certification, and Claude Desktop proof.
- Current behavior: scaffolding writes a useful generic JSON snippet, but
  doctor reports success based on a file that not every client reads. Users and
  agents must know how to translate or install that server in their own client,
  while the docs imply project-local setup is already complete.
- Architectural harm: the protocol is portable, but installation is not
  automatically portable. Conflating the two produces false-positive health
  checks and makes the launch-certified clients depend on undocumented manual
  knowledge. This is especially damaging on a phone/remote-sandbox workflow,
  where editing the correct client configuration is the main setup problem.
- Canonical end state: Air Jam owns one portable stdio server declaration plus
  explicit thin installation profiles for each launch-certified client.
  Inspection reports protocol readiness separately from client registration,
  supports structured output, and never mutates user-global configuration
  without an explicit action.
- Change: model MCP server declaration independently from client adapters; add
  discoverable config rendering/doctor commands for the generic stdio profile,
  Codex, and Claude Desktop; state exactly what is installed versus merely
  generated; and test client discovery from clean environments.
- Dependencies and blast radius: canonical CLI from CAN-200, MCP config types,
  scaffolds, generated docs and client notes, Gate 2 evidence, desktop/global
  config safety, and future T3/other compatibility claims.
- Validation: from clean machines or isolated profiles, the generic terminal
  stdio flow, Codex, and Claude Desktop each discover the same tool schemas and
  open/read/close a semantic session using only public instructions; doctor JSON
  distinguishes package, server command, project declaration, and client
  registration state.

### CAN-206 — Long-running MCP release operations require an experimental client capability

- Category: agent-operability
- Complexity: necessary-complexity
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/mcp-server/src/server.ts` imports the MCP SDK's
  `experimental/tasks` API and advertises task capabilities;
  `packages/mcp-server/src/tools.ts` marks `airjam.release_bundle`,
  `airjam.release_submit`, and `airjam.capture_visuals` with
  `taskSupport: "required"`; registration appends “Requires an MCP client with
  task-backed tool execution support”; MCP tests assert the requirement on
  bundle and submit. `docs/guides/hosted-release-guide.md` says submit,
  inspect, publish, and list exist across CLI and MCP but does not state the
  client capability boundary. The in-memory task store has a five-minute
  default TTL and no restart persistence.
- Current behavior: task-backed execution prevents long release work from
  blocking one request, which protects a real invariant, but an otherwise
  conforming stdio MCP client without experimental task execution cannot call
  bundle or submit. The public docs and MCP compatibility claim do not expose
  that difference until tool registration/runtime.
- Architectural harm: a complete hosted-release lifecycle is conditionally
  absent from the MCP profile, and task state disappears with the server
  process. Without a deliberate compatibility decision and proof, the system
  can certify MCP discovery while failing the operation that matters most for
  autonomous publishing.
- Canonical end state: long work has one explicit asynchronous domain job
  contract with inspect/cancel/result semantics. MCP tasks may adapt that
  contract for capable clients, while every launch-certified profile has a
  documented, replayable path to the same job lifecycle. Capability negotiation
  and recovery behavior are part of the public contract.
- Change: decide whether MCP task support is launch-required or an optional
  adapter, move durable job identity below the MCP process where required,
  expose capability/health inspection, document the matrix, and test the exact
  Codex and Claude client flows rather than only the in-memory SDK transport.
- Dependencies and blast radius: release orchestration and worker ownership in
  the platform lane, MCP server lifecycle, canonical CLI, job persistence,
  cancellation/idempotency, client certification, and release evidence.
- Validation: each launch-certified profile submits a real validation job,
  observes progress, survives the documented MCP/server restart boundary,
  obtains the final release identity, and safely retries without duplicate
  publication; clients without task support receive a discoverable supported
  path rather than a late protocol failure.

### CAN-207 — Unregistered experimental visual tools remain in the published MCP contract

- Category: simplicity
- Complexity: obsolete-complexity
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/mcp-server/src/tools.ts` builds definitions for
  `airjam.list_visual_scenarios`, `airjam.capture_visuals`,
  `airjam.list_visual_capture_summaries`, and
  `airjam.read_visual_capture_summary`; all are described as internal or
  experimental. `getRegisteredToolNamesForProjectMode` returns none of them for
  monorepo, standalone, or unknown modes. `packages/mcp-server/tests/mcp-server.test.ts`
  explicitly asserts that they are not registered. Despite that, the package
  root exports `buildToolDefinitions` and the inferred
  `AirJamMcpToolDefinitions` type containing them, and
  `docs/capability-inventory.md` still lists the four `airjam.*` names as main
  visual APIs. A live consumer search found no non-test caller of these MCP
  names.
- Current behavior: the semantic game-session and browser workflow has replaced
  experimental visual MCP tools as the supported path, but the old definitions,
  schemas, imports, bundle weight, exported types, and docs remain in the
  public package.
- Architectural harm: hidden tools are not harmless when their definitions are
  exported. They enlarge the apparent 1.0 API, keep experimental harness
  concepts coupled to the public MCP adapter, and contradict both registration
  behavior and the documented preference for browser visual proof.
- Canonical end state: the MCP package contains and exports only registered,
  supported public tools. Repo-only visual capture remains in internal harness
  and maintainer tooling, while browser proof and semantic sessions remain the
  public development path.
- Change: delete the four unreachable MCP definitions and their adapter-only
  schemas/imports, narrow MCP exports to intentional construction/configuration
  APIs, and remove or relabel docs that present unregistered tool names as
  capabilities. Do not delete internal visual tooling that still has repo CLI
  consumers.
- Dependencies and blast radius: MCP tool types and bundle, capability docs,
  devtools visual imports, repo visual commands, harness tests, and semver
  review of the public package root.
- Validation: public MCP schema snapshots contain exactly the registered tool
  catalog for each project mode; no published declaration or live doc mentions
  unregistered visual MCP names; repo visual review tests still pass through
  the internal maintainer path.

## Open Questions and Cross-Lane Dependencies

1. **Runtime topology ownership:** `packages/runtime-topology/index.mjs` and
   `packages/sdk/src/runtime-topology.ts` contain parallel implementations with
   no generator or freshness check. The private harness depends on
   `@air-jam/sdk` but imports `@air-jam/runtime-topology` without declaring it,
   while the root workspace happens to provide that package. The runtime lane
   should decide whether SDK is the sole owner and delete the private package,
   or generate both artifacts from one contract. The current docs call the
   private package the key implementation even though most production consumers
   use the SDK export.
2. **Project-runtime ownership inversion:** repo workspace modules and
   `packages/devtools-core/runtime/` import runtime helpers from
   `packages/create-airjam/runtime/`, making internal maintainer tooling depend
   on a public one-shot scaffolder. CAN-200 proposes moving these helpers to the
   installed project CLI/shared service owner; the runtime lane should challenge
   whether any portion belongs in server or SDK instead.
3. **Platform game/media MCP parity:** the terminal adapter exposes game
   create/update and media inspect/upload/clear through shared devtools services,
   but MCP exposes release list/inspect/submit/publish and only auth status. The
   platform lane should decide whether full hosted creator lifecycle is required
   in MCP or whether the complete structured CLI is the intentionally portable
   automation profile. The architecture doc currently says hosted release and
   media machine actions without stating the split.
4. **Durable release job authority:** CAN-206 depends on where validation and
   publication jobs are durably owned. The platform/release lane should confirm
   whether the platform/worker already exposes idempotent job identities that
   MCP tasks can adapt, or whether MCP is incorrectly acting as the job owner.
5. **Public package count:** resolving CAN-200 may replace the four-package
   release policy with a distinct installed CLI package, or may repurpose one
   existing package. Synthesis must choose based on clean ownership rather than
   preserving the current package count.
6. **Generated guidance ownership:** the platform docs/AI-pack producer owns the
   hosted manifests, while `create-airjam` owns the local update client and base
   pack. CAN-203 and CAN-204 require one cross-lane authority for schema,
   versioning, validation, and user-owned extension boundaries.

## R3 Resolution Evidence

Bundle `R3` resolved `CAN-200` through `CAN-205` and the tooling portion of
`CAN-301` in commit `bf7d0630097638deec919f01f5bbc4e3e50a627d`.
The findings above remain unchanged as historical audit evidence; this section
records the implemented end state.

1. `create-airjam` is bootstrap-only and no longer publishes an `airjam`
   alias. The installed `@air-jam/cli` package is the sole project lifecycle
   owner, while the server binary owns only server start and unified logs.
2. CLI and MCP now share typed devtools services. Terminal agents have JSON
   reads and mutations for MCP setup, AI-pack state, local status, and a
   persistent semantic session lifecycle.
3. The MCP package declares its consumer TypeScript loader and external ZIP
   runtime dependencies. Its packed binary completes a real protocol
   initialize and tool-list exchange without monorepo dependency leakage.
4. Managed Air Jam references now live under `docs/airjam/`; bootstrap-created
   `AGENTS.md`, `CLAUDE.md`, and skills become project-owned and survive later
   managed-pack updates.
5. Portable stdio declaration, Codex configuration, and Claude Desktop
   configuration are separate inspectable profiles over the same MCP server
   command.
6. Every scaffoldable game is checked against its actual exported store and
   semantic actions, and a packed Pong project proves the complete public
   install boundary.
7. `CAN-206` remains intentionally outside this bundle because durable release
   job authority belongs to later platform/reliability work. `CAN-207` was
   resolved in `R2` by deleting the unreachable visual MCP definitions.

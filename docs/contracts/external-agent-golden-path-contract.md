# External-Agent Golden-Path Contract

Last verified: 2026-08-29

Status: canonical Gate 2 contract

Contract version: `air-jam-golden-path-evidence/v1`

This contract defines the replayable clean-room proof for Air Jam 1.0's core
claim: an external agent can discover and operate the complete game lifecycle
through public, machine-usable contracts without private maintainer knowledge.

The canonical machine specification is
[`scripts/repo/programs/v1-external-agent-golden-path.json`](../../scripts/repo/programs/v1-external-agent-golden-path.json).
The exact developer request is
[`scripts/repo/programs/v1-external-agent-golden-path-prompt.md`](../../scripts/repo/programs/v1-external-agent-golden-path-prompt.md).
Markdown explains the contract; the manifest fixes the clients, isolation,
ordered stages, success criteria, and evidence paths that automation validates.

## Scope And Non-Goals

The proof covers:

1. public project creation and dependency installation
2. lifecycle discovery through generated guidance, CLI help/JSON, and MCP
   contract inspection
3. implementation, deterministic testing, local runtime operation, semantic
   multiplayer control, state/log/visual inspection, repair, and evaluation
4. a hidden release submitted only to an isolated staging environment
5. independent evidence verification
6. Codex as the complete lifecycle client and Claude Desktop as the independent
   local MCP discovery/session client

The proof does not authorize production publishing, public Arcade visibility,
real-user data, unbounded self-healing, vendor-wide compatibility claims, or a
human Studio dependency. It does not require Claude Desktop to duplicate the
full coding lifecycle; its 1.0 certification boundary is independent install,
discovery, and semantic-session bootstrap.

## Clean-Room Boundary

A valid run starts with all of these conditions:

1. an empty run-specific workspace outside the Air Jam monorepo
2. registry package specifications only; `workspace:`, `link:`, `file:`, local
   tarballs, monorepo-relative paths, `NODE_PATH`, and equivalent private
   resolution are forbidden
3. run-specific Air Jam client configuration, application identity, staging
   credentials, game identity, release identity, room/session identities, and
   evidence directory
4. no Air Jam source checkout, private repository documentation, prior run
   transcript, or maintainer-authored prompt amendments in agent context
5. recorded Node.js, Corepack, package manager, Git, operating system,
   architecture, browser availability, registry, network allowlist, and cache
   state

An existing vendor login may be used to operate Codex or Claude Desktop, but
vendor authentication state is neither copied into the run nor retained as
evidence. A package-manager cache may be cold or warm; its state and isolation
must be recorded so the result remains interpretable.

The run controller may provision declared infrastructure, substitute prompt
variables, collect evidence, apply the single controlled fault below, and
enforce time or safety limits. It may not edit product code, answer discovery
questions, suggest fixes, or provide private paths after the primary agent
starts.

The Codex primary lane runs with a run-specific permission profile rather than
the maintainer's ambient terminal authority. Child commands cannot read the Air
Jam monorepo, can write only the generated workspace and declared run-owned
state/evidence/cache roots, do not inherit ambient credential variables or a
login shell, and can reach only loopback plus the exact isolated-staging host
through Codex's managed network proxy. Local binding is explicitly enabled so
`pnpm run dev`, semantic sessions, and browser inspection exercise the real
runtime without granting production network access. The controller mirrors
evidence into the retained artifact directory while the run is active so a
terminal interruption cannot erase the observable transcript.

## Fixed Scenario

The primary agent receives the canonical prompt with four substitutions:
candidate version, run identity, isolated staging URL, and evidence directory.
It creates **Signal Relay**, a two-to-four-player reaction game whose host owns
rounds, answers, scores, locks, the three-point win rule, and reset behavior.

The required stage order is fixed:

1. `preflight`
2. `create`
3. `discover`
4. `build`
5. `control`
6. `inspect`
7. `repair`
8. `evaluate`
9. `release`
10. `verify`

The JSON manifest is authoritative for each stage's actor, objective, success
criteria, and evidence. Reordering or omitting a stage changes the scenario and
invalidates comparability with other runs.

## Controlled Repair Proof

After the first complete passing build/control checkpoint, the run controller
performs one declared and deterministic mutation:

```diff
-export const WIN_SCORE = 3;
+export const WIN_SCORE = 2;
```

It changes only that exact exported constant in
`src/game/domain/rules.ts`, records the before/after digest and timestamp, and
does not describe the edit to the primary agent. The agent must find the
inconsistency from normal project tests, semantic state, logs, or evaluation
evidence and restore `WIN_SCORE` to `3`. Both the failed attempt and successful
repair remain in the evidence bundle.

This mutation tests a bounded inspect-diagnose-repair loop. It is not a general
self-healing claim and cannot be replaced by an improvised failure that changes
the task between runs.

## Client Proofs

### Codex Primary

Codex must complete every stage from `create` through `release` and leave a
normalized tool/command transcript. Air Jam's repo-scoped Codex STDIO profile
matches OpenAI's current documented model: trusted projects may configure MCP
servers in `.codex/config.toml`, and the same configuration is shared across
Codex CLI and IDE clients. See the official
[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

The proof must still install and inspect the candidate package. Vendor support
for STDIO does not by itself certify Air Jam's package, configuration, or tool
contracts.

### Claude Desktop Secondary

Claude Desktop must independently install the currently supported local Air
Jam MCP package, discover its tools/resources, and open, read, invoke, and close
one semantic game session without the Codex transcript or private maintainer
knowledge.

Anthropic's current Desktop guidance recommends a Desktop Extension (`.mcpb`)
installed through Settings > Extensions. See the official
[local MCP server guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).
Air Jam's older raw `claude_desktop_config.json` profile is therefore evidence
to test, not sufficient certification by itself. Gate `G2-04` must either prove
the current profile through the supported client flow or replace it completely
with the canonical extension/package path; no obsolete parallel setup remains
after that decision.

## Evidence Bundle

Every run produces one immutable directory with a root `manifest.json`. The
manifest contains:

1. evidence format, run/scenario identity, candidate versions, client versions,
   staging identity, start/end timestamps, and terminal result
2. relative path, media type, byte size, and SHA-256 digest for every retained
   file
3. parent/child correlation IDs for stages, commands, MCP calls, game sessions,
   evaluations, faults, and release operations
4. the final project Git commit and release artifact digest
5. cleanup/retention disposition for every run-owned external resource

The required paths are fixed in the machine manifest. Directory indexes may
point to any number of immutable attempt records; an empty index is valid only
when its verifier rule permits no attempt for the terminal state.

### Normalized Records

Each command record contains the executable and argument array after redaction,
repo-relative or run-relative working directory, environment variable names
without secret values, start/end timestamps, exit code or termination signal,
stdout/stderr evidence paths, byte counts, and digests.

Each MCP/session record contains the client profile/version, server package and
protocol version, action/resource/tool identity, redacted input, normalized
result or error, timestamps, correlation IDs, and relevant state snapshot
digest. Vendor reasoning and hidden chain-of-thought are never requested or
retained; observable prompts, tool calls, outputs, and product evidence are
sufficient.

Visual evidence includes host and visible controller captures plus an index
recording route/surface identity, viewport, timestamp, correlated runtime
snapshot, file digest, and the assertion it supports. Images are proof of
presentation, not the authority for gameplay or scoring assertions.

### Results And Failure Classification

The verifier emits exactly one terminal result:

- `passed`: every required criterion and both client proofs passed
- `failed`: the product, client integration, or harness executed but a required
  criterion did not pass
- `blocked`: an identified external dependency prevented execution before the
  criterion could be tested
- `invalid`: isolation, evidence integrity, safety, or scenario comparability
  was violated

Every non-passing attempt records the first failing stage, responsible surface,
reproducible observation, expected behavior, relevant evidence digests, and one
classification: `product`, `client`, `environment`, `harness`, or `external`.
Later recovery never removes the first failure.

## Security, Privacy, And Publication

Secrets, token values, cookies, authorization headers, vendor login state, and
credential-bearing URL queries never enter retained stdout, screenshots, or
evidence files. Environment evidence records names and safe presence/shape only.
Absolute home and temporary paths are normalized to declared placeholders.

The release target must be an isolated staging deployment with a run-specific
application identity and hidden Arcade visibility. The manifest structurally
sets `productionAllowed` to `false`; a production target, public visibility,
pre-existing user record, or non-run-owned release makes the run `invalid`.
Cleanup may archive or delete only run-owned staging records according to the
recorded retention policy. The release artifact and redacted evidence remain
available for audit.

## Stop Rules

The run stops safely when:

1. a command requests production or public publication
2. isolation or credential redaction can no longer be guaranteed
3. a required private workaround would be necessary
4. the run controller would need to author product code or coach the agent
5. an external outage exceeds the declared run limit

The controller records a classified terminal result instead of weakening the
contract. A failed proof creates product evidence for Gate `G2-02` or `G2-05`;
it does not justify an unrecorded workaround.

## Repo CLI Contract

The current repository-owned inspection surface is:

```bash
pnpm --silent run repo -- golden-path --help
pnpm --silent run repo -- golden-path spec --json
pnpm --silent run repo -- golden-path validate --json
pnpm --silent run repo -- golden-path bootstrap --json
pnpm --silent run repo -- golden-path run-primary --staging-url <url> --json
```

`spec` returns the canonical machine scenario and `validate` rejects malformed
stage order, missing referenced files, unsafe publication, and unsupported
client profiles. `bootstrap` builds the exact public package set, publishes it
to a disposable loopback registry with Air Jam upstream fallback disabled,
installs a clean scaffold through registry specs, proves CLI/MCP discovery and
the managed dev lifecycle, runs quality gates, and removes its run-owned state.
`run-primary` launches a fresh ephemeral Codex process in the isolated
workspace, streams a normalized transcript, injects only the declared fault
after observed passing quality commands and a closed semantic control session,
requires all four quality gates again after repair, and emits the primary-lane
verifier result. It retains failed, blocked, and interrupted runs rather than
converting them into a success claim. Future `status`, `verify`, or `clean`
operations must remain on this same owner and must not duplicate lifecycle
business logic already owned by the public Air Jam CLI/MCP/domain services.

## Gate Boundaries And Acceptance

`G2-01` is complete when the manifest, prompt, contract, validator, tests, and
docs navigation agree on the exact replayable scenario and evidence format.
It does not claim the scenario has passed.

The whole external-agent gate closes only when:

1. public-only installation and bootstrap blockers are closed (`G2-02`)
2. Codex completes the retained full lifecycle (`G2-03`)
3. Claude Desktop independently completes discovery/session bootstrap through
   the current supported packaging path (`G2-04`)
4. discovered product blockers are fixed and the exact scenario is replayed to
   a terminal `passed` result (`G2-05`)

That separation keeps the 1.0 claim evidence-backed: defining a good harness is
necessary, but only an immutable successful replay certifies the product.

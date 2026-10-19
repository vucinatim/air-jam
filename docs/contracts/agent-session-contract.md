# Agent Session Contract

Last updated: 2026-10-17
Status: current contract

Related docs:

1. [../vision.md](../vision.md)
2. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the preferred machine-control contract for game execution
inside Air Jam.

## Core Position

The canonical agent-control path is semantic game-session control, not raw DOM
automation.

That means tools should prefer:

1. open a game session
2. send semantic controller input
3. read session state
4. invoke host or game actions
5. close the session

## Canonical Operations

The session contract should support:

1. session open
2. session input
3. session read
4. action invoke
5. session close
6. owned host/controller visual capture
7. fresh read-only semantic/runtime observation with explicit visual coverage

## What This Contract Is For

Use it for:

1. gameplay assertions
2. deterministic setup and teardown
3. match flow testing
4. score/state inspection
5. semantic control by agents

## What It Is Not For

Do not treat it as:

1. a replacement for visible browser proof
2. a direct substitute for release/media flows
3. a generic arbitrary runtime shell

Browser surfaces still matter for:

1. visible UI proof
2. layout validation
3. public-surface trust checks

## Boundary Rule

### Session owner and project scope

Ordinary SDK, MCP and CLI session operations use one detached broker per project
root. Sessions outlive their client/tool process and reconnect by UUID within
that project. Every session operation accepts `cwd` (CLI `--dir`); pass the
original project explicitly when the caller runs elsewhere. Lookups never search
other projects. Summaries include `ownerInstanceId`; a restarted owner cannot
resume its predecessor's browser or session IDs.

The broker validates the shared operation schemas, binds only loopback, protects
its owner record with file mode 0600 and authenticates every request against its
instance and secret. Exclusive creation admits only one owner. Shutdown rejects
new work, drains in-progress opens and disconnects their late controllers.
Fifteen minutes without a session operation expires that session; one hour is
the maximum session lifetime. An empty owner exits after five minutes.

`airjam session status`, `airjam status`, `airjam session stop` and `airjam reset
local` expose owner inspection and cleanup. Discovery never automatically deletes
an unhealthy owner's record. Explicit stop removes a stale record only after
establishing that its recorded process is gone; an alive unresponsive process
must be stopped before repair. This prevents competing recoveries from deleting a
new owner's discovery. Sessions do not survive owner/container loss.

The visual scenario harness instantiates the same internal runtime around its
own browser surface. Its sessions remain local to that explicit harness owner;
browser handles are never serialized into an ordinary session request.

### Player participation and host ownership

A room code or controller join URL grants participation, not ownership of the
host. Explicit attachments retain ordinary player inputs and raw controller
state/action tools. Semantic interpretation requires an owned host; it never
loads local source to interpret another browser's deployment. Session open
reports `semanticAccess: participant-only`, no semantic actions; semantic reads
and invocations reject with `contract_runtime_not_owned`. Omit the explicit room
or join URL to open a separate owned test host. No action uses a fabricated host
identity.

An implicit game session acquires a browser host it actually owns rather than
assuming a discovered local room belongs to it. Host actions travel through
the existing private runtime-owner IPC to that game's browser realm. The SDK's
`@air-jam/sdk/runtime-control` contract exposes a callable
`window[AIR_JAM_RUNTIME_CONTROL_KEY].invoke({ roomId, storeDomain, actionName,
payload })` for live host stores. It calls the normal local action dispatcher,
preserving host context, action listeners, acknowledgements and replication.
It is separate from the JSON inspection snapshot, not a network endpoint,
arbitrary evaluation API, or cross-origin message bridge.

Room/domain ownership and runtime readiness are checked at invocation. Missing,
ambiguous, stale, or unmounted bindings reject. An embedded game can control its
own game store, not the Arcade shell; the harness never substitutes the shell
when its owned game frame is missing. Closing a session disposes only the
runtime that session owns. Attaching to someone else's room never starts,
replaces, or stops their host.

Phone reconnect authority is independent: a server-issued private resume token
proves ownership of the previous player slot. Public controller/device IDs are
hints, not credentials. The token travels only in the private join exchange and
local binding storage, never public presence, game-frame welcome messages,
inspection snapshots, room URLs, or logs. Ordinary room-code joining and
cooperative player controls need no new human approval.

The session contract should stay above the raw transport layer.

Agents should not need to know:

1. socket wire details
2. iframe bridge details
3. room epoch plumbing

They should be able to reason in terms of:

1. session
2. player input
3. host/game action
4. readable state

## Bounded participant control

`controlGameSessionParticipant` / `airjam.control_game_session_participant` and
`airjam session control <id> --command <json>` share one guarded participant
path. The command supplies `expected` (the complete fresh observation identity),
`lease: { id, sequence }` and `operation`. Operations are `release`, `input`
(with a game-schema payload and `ttlMs` from 50 to 2000), or `action` (a discovered
semantic `actionId` and optional semantic `input`). The session derives the room
and controller from its authenticated connection. It never accepts an actor or
raw store action on this path.

Input and action operations also require `deadlineMs`, expressed in the observed
host document's monotonic clock. Compute it from
`observation.clock.startedAtMs + maximumDecisionAgeMs`, with a maximum age of
2000 ms. Never substitute the caller's clock: a browser and a container have
different clock origins. The host refuses an expired admission (`stale_decision`)
or a deadline more than 2000 ms ahead (`invalid_deadline`) before mutation.
Input TTL begins only on admission and independently bounds how long movement
can remain held. Receipt replay happens before age validation and never renews
input. Release needs no age deadline, so cleanup remains possible after expiry.

`controller:leasedControl` / `server:leasedControl` is an additive acknowledged
transport; older servers/hosts cannot strip fields and forward ordinary input.
Observation advertises `participantControl.input` and/or `.actions` only when
the actual host supports them. A release probe establishes the controller's
lease, including for action-only games. Missing support is explicit; no fallback
to ordinary input or local-source interpretation is allowed.

The actual host checks document, room, contract, store runtime, render surface
and participant receiver generation
before routing a command. It resolves semantic actions through its cached
contract evaluator, refuses host/internal actions and uses the same controller
actor dispatcher as ordinary taps. One lease ID owns a controller's lifetime;
input, actions and release share a strictly ordered sequence. Other players
retain their own ordinary controls. Unleased writes for a leased agent are refused.

An `applied` receipt means buffered input, cleared input, or dispatched action;
it does not prove simulation or rendering. Game action acceptance/rejection is
reported separately inside the action receipt. A missing/malformed reply is
`unconfirmed`, never a claim of no effect. Retrying the identical latest envelope
returns its cached receipt with `replayed: true` and never repeats the effect.
Reusing a sequence for a different envelope is rejected; older sequences are
stale. The cache is document-local, not an exactly-once guarantee across a crash.

Input expires on the host's next input read using its own monotonic clock. Release,
final controller leave and runtime replacement clear every held/pulse/buffered
value. A discrete action and a replay never renew movement's deadline. Runtime
replacement invalidates old command identities. A disconnected or stalled writer
therefore cannot leave movement held indefinitely. Final disconnect reports
whether the server acknowledged leaving, rejected it, or left its outcome
unconfirmed; closing the socket alone is not proof of player removal.

Ordinary low-level controller input/action APIs remain for existing manual tools.
A policy uses the leased path throughout its player lifetime and closes that
player when finished. The broker's session idle/hard limits do not replace the
short host-side input deadline.

## Bounded policy runs

Portable run schemas and types live in `@air-jam/devtools/game-runs`.
Workers and browser clients can import those contracts without loading Node
execution, filesystem or browser-owner code. Runtime operations remain in
`@air-jam/devtools/game-session`; profile authoring stays in `./testing`.

`airjam session run profiles|start|read|wait|list|stop` and the corresponding MCP
`list_game_test_profiles`, `start_game_run`, `read_game_run`, `wait_game_run`, `list_game_runs`
and `stop_game_run` operations share the existing project broker. The initial
owned-run target opens its own fresh dedicated session. It never converts a
manual session or attaches to the creator's room. Read/observe remain available;
interactive input/action/control and generic session closure are refused with
`session_owned_by_run`. Only explicit run control or internal lease cleanup can
end its session; a read-only embedding cannot bypass run authority by closing it.

`wait` returns when final evidence and cleanup finish, or after its bounded
timeout (default 25 seconds, maximum 30 seconds). A timeout returns the current
record; disconnecting only cancels that waiter. It never stops the run. `read`
and `wait` can read a complete, correctly addressed terminal record from disk
after the broker exits, without starting another owner. An unfinished record
cannot be interpreted as a completed trial while its owner is unavailable.

`airjam session run stop-all` stops active runs in the project and confirms their
cleanup without stopping unrelated manual sessions or starting an absent broker.
An embedding application can use `airjam-mcp --external-run-control` (or the
matching server option) to leave run start, stop and steering out of MCP while retaining reads,
waits and discovery. Studio uses its own durable admission for those effects;
direct CLI experiments remain local scratch and are stopped at source boundaries.

`airjam session run cancel <run-id>` fences an uncertain admission. If the run
exists it follows normal Stop; otherwise it reserves that ID without starting a
game, so a delayed start cannot create an unsupervised player. The result is
`{runId, ownerInstanceId, fenced: true, record}`, with `record: null` when no run started. The owner identifies the broker that performed the fence, even when the record belongs to a lost earlier owner. Cancelling
is an explicit write and may establish an inert project broker; reads never do.

The caller supplies a stable UUID `runId`. An identical retry returns the same
admission, a changed request conflicts, and a retained run ID from a previous
owner cannot start another trial. A manifest is persisted before asynchronous
startup. Time (at most ten minutes, including startup) and decision-count budgets
are explicit; an incomplete budget exit is inconclusive, never a passed test.

The trace has a 16 MiB byte allowance, with space reserved for teardown events.
Exhaustion stops the run as `trace_budget` and records truncation; it cannot
produce a pass. Journal failures cannot prevent participant or host cleanup.
The terminal record binds the original trace path, SHA-256 and byte count, as
well as the final observation digest. A later artifact copy verifies those
receipts rather than trusting files after the live checkout changes.

Games declare `testing: "./testing/profiles.ts"` in their Air Jam config. That
module exports `testProfiles = defineAirJamTestProfiles({...})` from
`@air-jam/devtools/testing`. It is loaded only in the contained devtools policy
process, not imported into the game browser bundle. Each scenario declares its
seats, allowed play actions, explicit host/participant setup, observation scope,
timings, and named code/random/model policies. Policy factories retain local
state and receive a seeded random function; that seed does not seed game physics
or establish deterministic replay. Policy factories may initialize asynchronously
within the remaining run budget. Preparation is measured separately from each
decision. Evaluator factories and verdicts remain synchronous. Optional bounded
decision diagnostics enter the trace, never the game controls or evaluator.

Owned tests pin source, policy and evaluator into one sealed build. Source is
hashed before and after copying; installation and compilation must preserve it.
The frozen dependency installer uses independent copies and records PNPM's actual
import method. Source, installed graph, distribution and toolchain identities
are verified on cache reuse. The local cache retains at most three builds and
2 GiB of logical file bytes, evicting oldest entries. Each run retains its
original source archive and build receipt. This is a verified project-local
cache, not cross-tenant storage or protection from hostile code in the same
container.

A policy can declare an `artifacts` manifest path within pinned source. The
operator provisions its exact files under
`AIRJAM_TEST_ARTIFACTS_DIR/<manifest-sha256>/`. The trusted owner verifies paths,
byte counts and SHA-256 before importing actor code; it rejects symlinks,
unlisted files and workload-writable ancestors. Verification currently requires
a non-root POSIX workload and an independently owned read-only artifact tree.
The manifest is limited to 32 files and 4 GiB, including model sidecars. Only a
declaring policy receives the verified directory and receipt over private IPC.
Model download, conversion and provisioning belong outside the run; ordinary
code/random policies need no model runtime. The harness does not select a hosted
provider, download weights or silently change billing. A manifest's provenance
records operator-supplied source and licensing information, not a legal verdict.

### Decision-model players

A policy may return a question instead of a control: `{ ask: { state, question,
options } }`. Each option carries the plain condition under which it is correct
and an ordinary play control (an input, an action, or a release), so a model can
only choose among controls the game already accepts. The trusted run owner puts
the question to the run's typed decision model and plays the chosen option's
control through the same seat, lease and deadlines as any other decision. The
question shares the policy's `decisionMs` budget. A late, failed or undeclared
answer is a missed decision and releases the seat; a run whose policy asks
without a configured model ends as an error. There is no fallback policy.

Games describe how they are played with a player contract, written alongside
their profiles by whoever writes the game:
an `AirJamPlayerContract` of `{ brief, turn }`. The brief explains the game to a
reader who has never seen it. `turn({ observation, seatId })` describes the
current state in words and offers that turn's options, or returns `null` when the
seat has nothing to decide. `createAirJamPlayerPolicy(contract)` validates a
contract and turns it into an ordinary profile policy; the brief leads every
question, so a turn describes at most 30 state lines, leaving room for a goal
line once the seat is steered. Describe what a player perceives, not the
answer: a turn computed from hidden state the player cannot see measures the
contract, not the model. Decision models choose the option whose `when` matches
the state, so write each `when` against what the seat is aiming for ("the height
I am aiming for is above my paddle") and let the brief name the default aim
("unless you have been given another goal, aim at the ball"). A `when` that
computes the answer from the state alone leaves a seat's intent nothing to
change.

The model is configured only for the run owner, through
`AIRJAM_DECISIONS_ENDPOINT`, `AIRJAM_DECISIONS_MODEL` and optional
`AIRJAM_DECISIONS_TOKEN`, using the Decisions API shape that typed decision
models share (OpenRouter's, which serves Jev). The run owner removes these
variables from its own environment when it starts, so policy and evaluator
processes, game builds and every other process it spawns never receive the
endpoint or its credential. Set them only for the process that starts the run
owner, never in a shell that also runs `pnpm run dev`, because the dev server
executes game code. The run record names the `decisionModel` a run asked. The
trace records each answer's choice, confidence and duration, and each missed
decision's reason; a run ended by repeated misses names the last reason.

### Seat intent and steering

A run may start with an intent per seat (`intents: { [seatId]: text }`, CLI
`--intent <seat=text>`): plain words a decision-model policy reads right after
the brief, such as "play cautiously" or "try to break the scoring". Policies
receive the seat's current intent in every step. `airjam session run steer
<run-id> --seat <id> --intent <text>|--clear` and MCP `airjam.steer_game_run`
change it while the run is active. Steering never sends a control: the policy
still decides, through the same seat, lease and deadlines. Every change is
recorded on the run's `steering` log with its time and source (`creator`,
`agent` or `operator`), at most 64 per run, and in the trace. Under
`--external-run-control` steering belongs to the embedding application, like
start and stop. Write an intent in the terms the game's turns already use: a fast decision
model follows "aim your paddle's centre at y=60" but cannot reliably turn "stay
near the top" into a height. Translating strategy into such goals is the
steering reasoner's job, and a run of low-confidence answers after a change
usually means the goal was too vague.

Each seat's record also summarizes how a decision model played it: questions
asked, answered and missed, the choices it made, answers below 0.6 confidence,
and stretches of three or more such answers in a row. Reading a run while it
plays returns the live summary; the final record is the digest.
Sustained low confidence is a signal that the brief or the game may be unclear
to a newcomer, not a measure of fun.

Each scenario also declares one synchronous evaluator and its named numeric metrics.
Policies return controls or questions, never a verdict. The evaluator
runs in a separate child through the same bounded, correlated profile IPC
transport. A stalled actor cannot block judging or final evaluation. Stdout is
bounded diagnostic output. Provider/native inference credentials are excluded
from both child environments.

The primary controller is the first seat. Extra seats are ordinary player sockets
in the same room, without extra game sessions or hosts. Each has a pinned player
identity, its own input lease/sequence and its own seeded random stream. The
parent alone owns connections, effects and deadlines. Decisions run round-robin
with one pending actor request; late replies are discarded and missed/blocked
opportunities release that seat. Three consecutive missed opportunities end the
run. Three expired effect admissions end with `decision_latency`.

One indexed journal records each logical effect, including its phase, seat,
lease sequence, attempts and actual acknowledgement. An uncertain control is
retried once with the identical envelope, without renewing movement. Each child
receives new receipts exactly once when its request is dispatched, even if its
response later times out. Policies receive their own seat's receipts; the judge
receives all seats. The harness rejects receipt gaps, duplicates and oversized
batches. Authored code need not deduplicate. Freeze the receipt boundary before
observing so a judge never compares a future effect with older state.

Stop, completion, time budget, expiry and owner shutdown use one idempotent
termination path. It gates decisions, stops the actor, drains effects, releases
all seats, and waits for bounded host advancement. Final actual evidence and
judging precede player leave; extras leave before the primary host closes.
A final failed verdict overrides an earlier pass. Passing requires actual play
effects from every seat, a completed run, matching final identity/evidence and a
final passed verdict. Stop/budget cannot become a late pass. A failed normal
close escalates only the affected socket/runtime and preserves uncertain server
receipts. Failed local participant teardown keeps the owner busy instead of
admitting another run over leaked resources. Scenario assertions are authored
test logic, not an adversarial fairness guarantee.

Failed expiry cleanup appears in owner health and cannot drain unrelated sessions.
Missing pixels/capture failures and
uncertain releases/leaves remain explicit. Artifacts live under
`.airjam/artifacts/runs/<runId>/`: `record.json`, `trace.ndjson`, `policy.log`, `evaluator.log`
and, when available, a digest-bound `final-observation.json`. The owner caches
32 recent ended records; older records remain readable from disk without a
lifetime run quota. A previous owner's unfinished record is reported as
`owner_lost`, never resumed or rewritten. These artifacts
describe actual runtime evidence; authored assertions are not an independent
anti-cheat oracle. Multi-seat ownership, current-room delegation, pinned-build
formal testing and live watch share this owner.

## Live owned-run viewing

`watchGameRun(request, onEvent, signal)` and
`airjam session run watch <run-id> --surface host|controller:<seat-id>` expose
protocol-4 live viewing. The CLI writes bounded NDJSON. `ready` identifies the
run, exact surface and JPEG dimensions; `frame` carries an increasing sequence,
producer capture timestamp and base64 JPEG; `heartbeat` carries producer time
and its latest capture sequence, including when the screen is static. A failed
producer emits `error` and exits nonzero. Clean EOF means the run ended or the
viewer disconnected. A viewer does not extend the run's lifetime.

The host uses the already-owned Chrome page. A controller uses the same read-only
observation bridge as captures, bound to that seat's actual controller. Neither
adds a participant or creates another room. Mirror state reads are answered from
the existing controller's cached replication; they do not request extra host syncs.
An unknown seat, current-room target or stopping run is refused. There is one
producer per surface and at most two per run; a consumer fans out shared viewers.

Capture acknowledgements pace Chrome to at most 15 frames per second with the
actual viewport's longest edge capped at 1280 pixels. Each IPC or writable hop retains only the latest frame under
pressure. These limits describe capture and transport, not measured Mac latency.
Heartbeats begin after the first real frame; an unavailable initial capture fails
explicitly. Disconnect stops only the viewer, while Stop closes viewing before
runtime teardown. Original gameplay continues independently of a failed viewer.

`watched: true` and diagnostic `watch_started`, `watch_failed` and `watch_stopped`
trace events identify capture overhead. Diagnostic watch events cannot exhaust
the gameplay trace allowance or alter an otherwise passing verdict. Actual process
closure remains part of the run's authoritative cleanup proof. Broker health
reports its protocol version; updated tools refuse a stale detached owner until
it is explicitly stopped.

## Design Rule

If a future tool surface makes agent control depend more on browser event
synthesis than on semantic session operations, that is a regression in the Air
Jam control model.

## Owned visual capture

### Fresh runtime observation

`observeGameSession` / `airjam.observe_game_session` use the existing owned
runtime-control channel. The SDK's `agent({ operation: "observe", ... })`
projects the same live semantic contract used by reads. Games can register
host-local simulation state through `useHostAgentObservation({ read, capture })`.
The read callback receives the requested player/diagnostic scope and controller
identity. This is a declared view of game-authored data, not an adversarial
guarantee of human-equivalent information. Raw stores and callable host actions
are not returned by observation.

`captureAgentCanvas` produces a bounded JPEG of a game-provided canvas. Its
coverage is `render-surface`; surrounding HTML is excluded. Games without this
capability report an unsupported image, and an unmounted canvas reports an
unavailable surface. No replacement host or generated image stands in for the
requested game.

Observations identify document, room, contract, store runtime, local surface
and participant receiver registration, plus a sequence, host-clock capture
interval, before/after ticks and store
revisions. Capture and state need not be simultaneous. Replacement during an
asynchronous read rejects the sample. Optional expected identity rejects a
stale target before capture. State projections are bounded to 128 KB each,
images to 640 KB and the complete read to three seconds. Timed-out reads never
retry a game mutation. MCP delivers supported images as native image content
alongside their metadata, rather than bury image bytes in JSON text.

Live receiver metadata includes the core runtime/connection state and, for an
input receiver, its input JSON Schema (at most 32 KB) or an explicit reason the
Zod schema is not representable. This describes the receiver actually sampled;
local source is never substituted for another document's schema. Replacing a
receiver invalidates pending controls even if the semantic contract, store epoch
and renderer remain mounted.

The browser preview can delegate this read-only operation to an explicitly
configured development embedding parent. Both parent window and exact origin
must match; hosted production topology does not enable it. The separate message
protocol accepts observation only, with one bounded outstanding read. It exposes
neither action invocation nor arbitrary evaluation. A room code or ordinary
participant attachment does not acquire this delegation.

### Rendered host and controller interfaces

`captureGameSessionVisuals` / `airjam.capture_game_session_visuals` capture the
owned host and the acting controller's real rendered interface. The controller
view observes the existing transport through `@air-jam/sdk/controller-bridge`;
it has no separate room join or network participant. Its harness context is
bound to the owning controller session, room and controller ID. State-sync
reads use its existing replication cache; input, profile changes and other
mutations are rejected. Detaching the capture view leaves the controller connected.
The existing Arcade bridge continues to use its active surface identity and epoch.

Captures report immutable project-relative PNG paths and dimensions. Retaining
those files outside the runtime is the consuming tool host's responsibility.
Game source exports do not automatically include runtime capture directories.
Player avatars show accessible initials when artwork cannot load, including in
contained environments with restricted egress; no broader network access is needed.

## Live contract evaluation

The app's Host registers its agent contract while mounted. One SDK evaluator
owns descriptions, input validation/transformation and state projection; static
source inspection uses that same evaluator in a bounded asynchronous helper.
Live sessions never spawn that helper or import authored source into their broker.

The existing realm-local runtime control exposes `agent` read, resolve and
invoke-host operations. Reads use the owning game's authoritative store bindings,
excluding actions and preserving concrete embedded domains. Participant payloads
travel through the normal controller socket. Host semantic resolution and local
dispatch happen together against the expected contract/store identity. This adds
no network endpoint, guest capability or arbitrary evaluation interface.

Each contract registration has an instance ID; document/room/store epochs identify
the live runtime. Requests validate those identities before dispatch. Before and
after observations with different identities report `contract_changed` or
`runtime_replaced`, not a gameplay diff. Contract failures propagate. Registration
cleanup removes only its own binding; ambiguous owners reject.

Session operations are serialized with bounded deadlines. Separate sessions can
run concurrently. Close cancels active channel waits and rejects queued work.
A timed-out operation makes the session unusable until closed; a mutation is never
automatically retried because it may already have executed in the game. The owned
browser/process is disposed by the existing controller lifecycle.

## Unreleased tooling behavior changes

Runs accept per-seat `intents`, records carry each seat's `intent`, `answers`
summary and a run `steering` log, `AirJamPolicyStep` carries `intent`, and
`run.steer` / `steerGameRun` / `airjam.steer_game_run` / `session run steer`
change a seat's intent during play.

`AirJamPolicyDecision` gained an `ask` variant for decision-model players, and
`@air-jam/devtools/testing` exports `AirJamPlayerContract`, `AirJamPlayControl`,
`AirJamDecisionQuestion`, `airJamDecisionQuestionSchema` and
`createAirJamPlayerPolicy`. Code that reads `decision.control` must handle a
question. Pong, the minimal starter, Code Review and The Office declare player
contracts and offer a `model` policy beside their code policies. Pong gains a
`match` profile against its own bot; Code Review and The Office gain their first
test profiles (`round` against the game's bot, and a solo `shift`) and host
observation surfaces for state that lives only in the host simulation.

`@air-jam/devtools/agent` now exports only static `inspectGameAgentContract` and
its types. Removed `readGameSnapshot`, `invokeGameAction` and
`resolveGameActionPayload` are replaced by owned `game-session` read/invoke.
Static inspection reports `source: source-declaration` and is not live truth.
The semantic read's `requestSync` option and CLI `session read --no-sync` option
are removed: semantic state always comes directly from the owned host. Raw
controller snapshot synchronization is unchanged. Consumers must use a matching
candidate SDK/devtools pair; no old-source interpretation fallback remains.
These changes are unpublished and require release notes when the package
candidate is eventually promoted.

The visual harness supplies its already-owned page to an internal runtime
instance. It uses the same evaluator and observations without launching another
host or interpreting source. The harness retains page lifetime ownership; session
close releases its controller. Page injection is absent from the public library,
CLI, MCP and broker JSON interfaces.

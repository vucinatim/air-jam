# Current State

Last updated: 2026-10-20
Status: Studio foundation continuation qualified locally; earlier separation checkpoint retained below

## SDK core layering — next

The [core layering plan](./plans/sdk-core-layering-plan.md) moves the runtime
out of React hooks into a framework-free `@air-jam/sdk/core` with React as its
binding, gives the SDK the game clock so logic runs headless and faster than
real time, ports Air Capture to it and writes down the protocol for other
engines. The SDK stays one package.

## Native observation and isolated playtesting

The public SDK exposes current-host observations and fenced participant controls.
Devtools owns detached sessions, immutable source/build runs, authored two-seat
policies and evaluators, original evidence and read-only live host/controller
watching. CLI and MCP consume these same services. The
[agent session contract](./contracts/agent-session-contract.md) and
[devtools reference](../packages/devtools/README.md) own their supported surfaces.

Independent frozen installs, process ownership, source hashes and cleanup receipts
separate a repeatable test from a creator's live room. Optional model policies use
owner-verified read-only artifacts and bounded asynchronous initialization; the
framework does not download models or require a model provider.

Exact unpublished package consumers and Linux native tests pass on minimal and
Pong. Actual Mac Studio watching preserves a simultaneous human match and also
works without starting a creator preview. A contained Laya counter comparison
passes under one CPU / 3 GiB. Both Pong baselines pass, but Laya produces no timely
gameplay decisions and fails qualification; its deliberate loader fault stops
explicitly without fallback. It remains an opt-in experiment fixture. Windows
job ownership requires PowerShell 7.4+; the Public Install Matrix owns actual
cross-platform process-lifetime and installation qualification. Main and npm
releases remain unchanged.

## Owned live semantic evaluation

The SDK evaluates agent contracts in the owning game's host realm, using live
contract registration IDs and authoritative store reads. Devtools sessions use
one serialized before/resolve/transport/after pipeline; they no longer reload
source through synchronous helpers for each action. Explicit room attachments
retain participant transport but require an owned test host for semantics.
Static source inspection is separate, asynchronous and bounded. Unreleased
removals and identity/failure rules are recorded in the
[session contract](./contracts/agent-session-contract.md). The full private
creator lifecycle passes under one CPU / three GiB, including actual hot reload,
replacement during projection, source/chat/history recovery, repeated Mac Chrome
restart and public guest interaction. Exact unpublished candidate
`local-scaffold-20261015T230249Z-890b5606` passes package consumers. Public batch
and focused SDK/devtools regressions pass; this is not an npm release.

## Multiple preview controller recovery

The supported preview export also exposes `requestPreviewControllerClose` for
editors removing a controller. It reuses the framework preview's guarded leave
handshake and reports acknowledgement separately from timeout/refusal; moving a
phone between surfaces keeps its recovery authority instead of leaving the room.

Controller storage retains private resume authority for each controller within a
room, alongside the ordinary last-used phone binding. Explicit preview identities
resume only their matching binding; leaving one phone no longer clears another
phone's authority. Existing stored bindings remain readable without changing
server admission or exposing resume credentials through inspection. The full
public batch passes with pinned pnpm 9.9.0; native Mac Chrome verifies the same
player and room after moving a phone into a Studio window and reloading it.
The private development branch consumes exact unpublished candidate
`local-scaffold-20261015T104553Z-03d10991`; earlier candidates remain preserved.

## Live Studio guest foundation

The server now exposes optional controller-only gateway admission, with a
per-server key and enforced room scope on every polling request/upgrade. Scoped
clients cannot bootstrap hosts or switch rooms; ordinary connections retain the
existing standalone path. Health advertises support explicitly. The CLI accepts
`AIR_JAM_BUILD_BASE` for immutable built-asset generations. Product invitations,
HTTPS ingress and expiry remain private product responsibilities.

Focused real Socket.IO integration tests, the full public batch and exact
six-package candidate qualification pass. Candidate
`local-scaffold-20261015T080805Z-3b9e8ff8` is installed by the private development
branch. This is an unpublished branch candidate, not a replacement npm 0.9.3
release. Main and existing saved-game dependency locks remain unchanged.

## Studio foundation continuation

`getPreviewHostViewportSize` exposes the canonical landscape host reference
dimensions alongside the existing phone viewport calculation. Embedded editors
can render a stable logical game screen and scale it to the available panel,
without forcing narrow responsive layouts inside the game document. The private
Studio owns fitting, panels and browser acceptance; saved game source is unchanged.

The embedded host preview also reports the game's declared controller orientation
from its canonical connection store. The bounded, origin-validated snapshot keeps
this field optional for saved consumers that predate it. Public preview exports
now expose the existing logical phone viewport calculation, so product clients
scale the same device dimensions rather than maintaining a second phone model.
The bridge validates orientation and packed typed/runtime consumers pass; Studio
owns its controller panel and the complete editor-shell acceptance.

Read-only controller capture uses a dedicated synthetic localhost shell and an
origin-scoped local-network permission in its short-lived browser context. This
avoids Chrome treating intercepted HTML as a public page that cannot embed the
contained game's local address. Readiness is inspected in the controller frame's
own realm, including across origins; no global browser or host-network setting changes.

Host inspection now exposes optional document and per-domain store-instance
identities through the existing validated preview bridge. Registry ownership
changes publish immediately; ordinary actions keep the identity. Replacing a
store factory at the same React hook position rebinds its dispatch/listeners,
and host replication revisions remain ordered across replacement for the same
connection, room and domain. This reports state initialization without promising
gameplay-state migration. Capture rejects a disconnected acting controller,
including disconnect during rendering, rather than returning a stale success.

The October 14 exact local candidate and fresh Mac Chrome trial qualify the
initializer change, same room/controller identities, new replicated state on
both controllers and controller-started play. The private product owns notices,
conversation, checkpoints and full creator acceptance; no release is implied.

`codex/studio-preview-inspection` supports isolated Studio development through
the public package boundary. Complete canonical local URL topology distinguishes
human preview addresses from contained harness addresses on one dev server,
independent of startup order. Explicit authored topology and production defaults
remain fixed. Host-issued controller joins and harness joins preserve local
topology, room and capability. The runtime topology contract documents precedence.

Pong's portable starter now fits compact host/controller areas, keeps text readable
and allocates score and pause content separately. Its canvas context follows the
actual DOM attachment; rendered court sizing derives from the field ratio rather
than independently constraining fixed dimensions. Real contained actions/state
and Mac Chrome verify separate agent/human rooms, controller-started play, live
rendering, reload outcomes and short-screen reachability. Opus owns the interface
and accepts the final screenshots. Exact local package consumers and frozen
private installation pass; no package release or main change is part of this work.

The private product owns current deployment and full Studio acceptance. The
following separation notes retain this branch's earlier delivery checkpoint.

The public framework is being separated from the private Air Jam product.
The separation branches are pushed and under review, but neither is merged.
Candidate packages are not published and production still serves the previous
public-repository deployment.

## Framework boundary

The six-package foundation owns the SDK, standalone server, CLI, MCP,
shared devtools and scaffolder. Devtools includes the evaluation harness;
environment validation remains an internal helper. Reference games
remain public. The normal `pnpm run dev` command starts a standalone game and
server without product accounts, a database or provider credentials.

The private product consumes exact candidate package archives. Explicit local
attachment permits framework development without changing dependency manifests
or lockfiles; it does not introduce a private SDK fork.

The reviewed six-package revision passes public CI and the complete Node and
operating-system installation matrix. Its exact candidate archives also pass
private installation and deployment-image qualification. Published MCP
configuration exports remain intact.

The follow-up cleanup makes devtools imports explicit with colocated public
types, gives its build one owner, follows declared workspaces without a root SDK
dependency, and removes historical-path tests and generated documentation from
tracked source. The updated packed consumers pass typed imports, executable
helpers, documentation integrity and real multiplayer runtime traffic. CI must
qualify the pushed revision before it replaces the reviewed candidate.

Creator documentation has one public source. Its packaged MDX snapshot and AI
pack serve the private website and external agents. Installed-artifact checks
cover all 16 creator pages. Product plans, operational contracts and product
history have a private owner; prior public snapshots remain recoverable in Git.

## Reviewed delivery

[The public separation PR](https://github.com/vucinatim/air-jam/pull/114)
has an [updated Opus 5.5 review](https://github.com/vucinatim/air-jam/pull/114#pullrequestreview-5478936724)
of the green six-package revision. It found no code merge blocker and confirmed
the simpler package boundary. Its bounded cleanup findings are implemented and
locally qualified; review conversations close with pushed implementation and
fresh CI evidence, not another automatic model-review loop.

The paired private candidate passed its full CI, including isolated deployment
image startup, schema readiness and platform, realtime and worker health.
This proves the candidate services start together, not that production has been
transferred. The private separation plan owns that delivery evidence.

## Still required

1. Complete fresh CI and installation-matrix qualification of the corrected
   public package family and close its recorded review conversations.
2. Validate the private product against those exact artifacts and then the
   published packages, including its final independent review.
3. Complete the guarded production source handover with live creator and
   player validation and a retained rollback path.
4. Restore the preserved Studio work by ownership and qualify its complete
   journey before resuming feature development.

The unfinished Studio branch is preserved on the private remote. No package
publication, production source transfer or Studio database migration has occurred
during this separation. The public MIT license is unchanged.

## Delivery guard

Do not merge removal of the public product paths while Railway's previous
automatic deployment source still points to them. Keep the existing serving
deployment available while the reviewed private replacement is qualified and
the source handover is performed.

The private product separation plan owns that sequence. Public framework gates
alone do not establish product or production readiness.

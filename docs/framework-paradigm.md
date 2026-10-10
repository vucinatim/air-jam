# Air Jam Framework Paradigm

Last updated: 2026-10-09
Status: stable public reference

Air Jam is a phone-as-controller multiplayer framework and an agent-operable
creation harness. Standalone games, custom embedded launchers and the private
Air Jam product use one runtime model and the same supported package exports.

## Three runtime lanes

### Input

Controllers publish high-frequency transient input; the active host reads it.
Movement, steering, aim and button state belong here. Do not replicate per-frame
input as durable application state.

### Replicated state

The host owns authoritative game state through `createAirJamStore`.
Controllers dispatch semantic actions with server-bound actor identity.
Teams, scores, match phase and any fact needed after reconnect belong in a
replayable snapshot.

### Signals and commands

Signals carry explicit one-shot effects such as haptics and toasts. Commands
carry coarse intents such as pause, menu or exit. They do not own gameplay
truth or substitute for replayable state.

Create one runtime audio owner per surface and pass its drivers downward.
Leaf modules should not independently load and own shared audio manifests.

## One owner per fact

The host owns gameplay decisions and replicated state. Controllers own input,
local presentation and a reconnect identity hint, not room or gameplay truth.

The server enforces room membership, controller binding, host authorization,
child launch capabilities, routing, reconnect continuity and epoch validation.
It must not become the owner of application UI state.

The development harness owns inspection and evaluation sessions, process
orchestration and feedback artifacts. It operates the game through the runtime's
contracts rather than inventing a second control model.

## Embedding without private dependencies

A launcher is an Air Jam app around another Air Jam app. The shell owns its
active surface, overlay and parent settings; the child game owns lobby, teams,
scores, match phase and game-specific controller UI.

The bridge only adapts transport, validates capabilities and surface identity,
rejects stale runtimes and bootstraps inherited settings. It is not another
owner of shell or game state.

The existing public protocol retains Arcade terminology. First-party Arcade
UI, catalog persistence, accounts and hosted operations live in the private
product. An independent launcher can use the public contracts without copying
that product implementation.

## Settings and audio

Parent settings are authoritative and inherited read-only by embedded games.
Children install listeners before signaling readiness; the parent then sends
the latest complete snapshot and later changes atomically. Controller changes
travel through the host command path, not same-origin storage assumptions.

Runtime-owned audio attempts startup on mount. When the browser blocks it,
runtime status becomes `blocked`; successful user interaction retries startup.
Surfaces should expose an enable-audio affordance rather than create competing
unlock state machines.

## Runtime and hosted policy boundary

The public server can run independently and provides a supported typed
composition entrypoint. The private realtime application composes hosted
authentication, admission, usage reporting and persistence with that runtime.

Local mode needs no product account, database or provider credentials.
Hosted mode must explicitly require its configured authoritative adapters;
missing policy must not silently select permissive local behavior.

Public clients may submit and inspect hosted releases through supported APIs.
Those clients remain public even though the service implementation is private.
Self-hosting remains a first-class path.

## Authoring and evaluation

SDK components are composable conveniences, not mandatory visual themes.
Games can use headless hooks and custom shells while preserving authority and
lifecycle behavior. Portable project, asset and parameter contracts should
serve local tools and the first-party Studio equally.

Use semantic game sessions for deterministic action and state assertions,
structured logs for diagnosis, and actual browser surfaces for visual and
interaction proof. Build and install exact package archives to verify consumers
rather than relying solely on workspace source resolution.

## Architecture tests

A change fits this paradigm when:

1. a fact still has one owner and the three runtime lanes remain separate
2. reconnect can restore meaningful state without replaying transient UI pulses
3. standalone and embedded games retain one supported runtime
4. the private product consumes public exports rather than source aliases or a fork
5. public creation and testing do not acquire a hidden hosted dependency
6. human and agent workflows use the same runtime contracts

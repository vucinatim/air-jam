# Air Jam Framework Vision

Last updated: 2026-10-20
Status: guiding vision

Air Jam's open foundation lets people and agents create, run, inspect, test,
embed and self-host multiplayer party games. Phones as controllers and a
shared host screen remain its clear interaction model. The foundation should
be useful independently of Air Jam's private Studio and Arcade.

## Creative end state

A high-level request such as "make a mario kart clone" should be able to drive
a complete creation lifecycle: gameplay, input, assets, audio, effects,
balancing, playtesting, polish and release preparation. The harness should give
capable agents enough feedback to keep improving a game rather than stop at
its first playable draft.

Specialized agents may collaborate when their operator chooses that workflow.
The framework exposes shared contracts and evidence, not a mandatory reasoning
script or central agent scheduler. Human development and external agent clients
use the same game model as the first-party Studio.

## Feedback that agents can use

The intended harness combines:

1. semantic controller actions and authoritative game-state inspection
2. structured runtime events, logs and topology
3. visual inspection of host and controller surfaces
4. repeatable playtesting, scenario evaluation and outcome comparison
5. portable game source, assets, parameters and authoring declarations

Semantic state proves what happened; visual feedback proves how it felt and
rendered. Neither should replace the other. Creator-owned declarations must
remain portable rather than become editor-owned database records.

## Gameplay testing without drawing

Roadmap direction, not started. Agents should be able to write fast, repeatable
tests of a game's rules and physics, such as "a ship at full thrust crosses the
arena in under four seconds", and run many of them in seconds on a modest
machine. That needs a game that can advance without drawing, and faster than
real time.

Drawing pixels is the expensive part, not the rules or the physics. If the SDK
owns the game clock, logic advances in fixed steps with seeded randomness,
physics steps with the same clock, and the screen only reads state and draws
when someone watches or asks for an image. The same game then runs headless,
fast-forwarded for tests, or normally for play, without being rewritten.

Doing this properly means:

1. one clock owned by the SDK; its tick is the supported way to advance game
   logic, and rendering never advances state
2. physics engines step from that clock
3. one test interface, shared by local tools and Studio, that seats players,
   sends input, advances time, reads the store and checks expectations
4. visual checks stay a separate, explicit request for a drawn frame

Games are not forced into a code structure. What the runtime relies on is that
input arrives through controllers, the facts that matter live in the networked
store, and the SDK owns the clock and when frames are drawn. Keeping rules in
plain functions, as Air Capture already does for flight, weapons and respawn,
is recommended by templates and agent guidance because it makes those tests
easier to write. Air Capture is the reference case: a physics-heavy 3D game
whose logic still runs from its per-frame render hook.

The same clock gives replays. A match recorded as its seed and controller
inputs plays back exactly: watched again at any speed, scrubbed, or seen from
any seat, by a person or an agent. Replays are a consequence of render-free
logic, not a separate recorder bolted onto each game.

## Live game settings

Roadmap direction, not started. A game declares the settings worth tuning,
such as ball speed, gravity or points to win, with a type, range, default and
whether a change applies live or at the next round, the way it declares test
profiles. Tools build controls from that declaration, and agents read and set
the same values through the same contract. Trying a value is then not a code
change; keeping it writes it into the source.

## Open foundation and private product

The foundation owns the SDK, runtime, standalone server, CLI, MCP, reusable
creator tools, reference games and public authoring contracts. Local creation,
testing and self-hosting must not require a platform account or hosted workspace.

The private product owns Studio, Arcade, accounts, projects, discovery,
managed workspaces, hosted persistence and operating policy. Its advantage
should be the quality of the complete creative experience, not restrictions or
a superior private SDK. It consumes the same public foundation as other clients.

An embedded game can run under another launcher or browser shell. Device reach
is determined by the game's browser requirements and the target environment,
not by whether the first-party launcher's source is public.

## Architectural direction

Keep input, replicated state and signals distinct. Give every important fact
one owner. Keep transport adaptation separate from gameplay and presentation.
Expose behavior through explicit machine-usable contracts rather than hiding
it behind UI workflows.

Preview, inspection and publishing clients should use coherent project and
runtime identities. Add shared abstractions only when real consumers or
observed failures justify them. Expansive creative goals do not require
implementing every future mechanism today.

Public documentation, templates and package exports should describe the actual
supported system. Discoverability comes from clear explanations and trustworthy
examples, not duplicate agent-oriented prose.

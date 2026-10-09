# Air Jam Framework Vision

Last updated: 2026-10-09
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

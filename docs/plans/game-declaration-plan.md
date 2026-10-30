# Game Declaration Plan

Last updated: 2026-10-28
Status: designed; phases 1 to 3 are 1.0 readiness item G6-10, phase 4 lands in the private Studio

This plan owns phase 6, item 1 of the
[core layering plan](./sdk-core-layering-plan.md): `airjam.config.ts` becomes
the one place a game declares what tools rely on, and every tool reads it
through one loader. The core layering plan owns the core runtimes, the clock
and the agent lanes around this item; the
[input system plan](./sdk-input-system-plan.md) owns the controls and bindings
this declaration carries unchanged.

## Why

Read on `release/1.0` at `5da420d5`. Every first-party game already passes most
of what it is to `createAirJamApp`: metadata, controller path, stores,
simulation, input, bindings, the agent contract and a test profile path. What
tools rely on is still spread around it:

1. **Settings are not declared.** Tunable numbers are module constants, such
   as Pong's `PADDLE_SPEED = 720` and `BALL_SPEED = 360` in
   `games/pong/src/game/engine/constants.ts`. Nothing can read or change them
   without editing source, so live tuning, Studio settings and agent knobs have
   nothing to read.
2. **Assets are not declared.** Sounds are typed manifests that each game
   mounts itself (eight `<AudioRuntime manifest>` mounts across host and
   controller files); images are path imports scattered through rendering code
   (`games/code-review/src/host/hooks/use-code-review-sprites.ts`); Studio's
   asset import writes `public/images/<uuid>.png` and registers nothing.
3. **Theme is not declared.** Each game keeps colours and fonts in a Tailwind
   `@theme` block in `src/index.css` and repeats team colours as TypeScript
   literals for canvas drawing.
4. **The player contract is hidden.** Each game's `AirJamPlayerContract` (how a
   decision model plays it) is only reachable from inside its test profiles,
   repeated as `model: createAirJamPlayerPolicy(<player>)` in every profile.
5. **The declaration is a React object.** `createAirJamApp` lives in
   `packages/sdk/src/runtime/create-air-jam-app.tsx` and returns React `Host`
   and `Controller` components, so loading the config in Node imports React,
   and the config mixes what the game is (stores, metadata) with how one
   browser surface finds its server (`env.vite(import.meta.env)`).
6. **Tools read around it.** There are five separate readers:
   `loadAirJamAppConfig` in `packages/devtools/src/tooling/airjam-agent.ts`
   (dynamic import, used by six helper subprocesses); a second `tsx --eval`
   import in `platform-games.ts` for metadata; regular expressions over the
   config source in `games.ts` (`metadataExportLikely`,
   `inferControllerPath`) and `release.ts` (`readConfiguredControllerPath`);
   and three copies of the same eight-entry config path list in `games.ts`,
   `release.ts` and `context.ts`.
7. **Facts are declared twice.** `airjam-template.json` repeats each game's id,
   name, description and category beside its metadata, with a different
   description; Last Band Standing sets `runtime.maxPlayers: 10` beside
   `metadata.maxPlayers: 10`; the other five games declare at most four players
   in metadata while their rooms admit the SDK default of eight; tools accept a
   separate `gameMetadata` export or `airjam.metadata` or a `default` export.
8. **A field nobody declares is read.** `visualScenariosModule` is read through
   a type cast in both `tooling/airjam-agent.ts` and
   `tooling/agent-declaration.ts`; no game declares it, and the private
   repository's visual qualification fixture injects it with
   `Object.assign(airjam, { visualScenariosModule })`.

## Decision

1. **One React-free declaration.** `src/airjam.config.ts` exports
   `airjam = defineAirJamGame({...})` from `@air-jam/sdk/core`. Its module graph
   imports no React, DOM, CSS or `.tsx` code, and the loader enforces that.
   This keeps the core layering plan's decision that `airjam.config.ts` stays
   the single declaration and needs no second definition file; the file itself
   stops being React.
2. **React is the binding.** `createAirJamApp(airjam, { runtime })` at the SDK
   root turns the declaration into `Host` and `Controller` for one browser
   environment. Topology is the environment's, not the game's, so it moves to
   the binding in `app.tsx`.
3. **Plain data is a zod schema in core; live parts keep their core types.**
   Metadata, controller path, settings, assets and theme are zod schemas in
   `@air-jam/sdk/core` (metadata stays in `@air-jam/sdk/metadata`, which core
   reuses), with TypeScript types inferred from them. Stores, the simulation,
   input and the agent contract are objects with functions; they keep their
   existing core types and `define…` helpers.
4. **Development-only declarations live in the testing module.** Test profiles,
   the player contract and visual scenarios are declared together in the module
   the `testing` path names, so they never enter a game bundle and need no
   second lazy loader.
5. **One loader, one JSON description.** Devtools loads the declaration in one
   place and describes it as one versioned JSON document defined in core. Every
   tool, the MCP server, the CLI and the private Studio read that description or
   the live declaration from the same loader. Nothing reads config source text.
6. **Settings are designer tunables owned by the host.** They are typed,
   bounded and defaulted in the declaration, read by the simulation, store
   actions, observation and host drawing, changed live only through the host
   control channel, and recorded in the input log so replays stay exact.
7. **Clean 1.0 break.** Every first-party game, template, the AI pack, the
   creator docs and the migration guide move in the same phase that changes
   them. No deprecated aliases, no fallback readers.

## The declaration

Pong, end state (phases 1 to 3):

```ts
// games/pong/src/airjam.config.ts
import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { pongAssets } from "./game/contracts/assets";
import { agentContract } from "./game/contracts/agent";
import { pongInput, pongInputBindings } from "./game/contracts/input";
import { pongSettings } from "./game/contracts/settings";
import { pongTheme } from "./game/contracts/theme";
import { pongSimulation } from "./game/engine/pong-simulation";
import { pongStore } from "./game/stores/pong-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
    slug: "pong",
    name: "Pong",
    tagline:
      "Basic 2D canvas starter. Team paddle game with lobby, bots, scoring, and audio.",
    category: "arcade",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons", "touch"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
    ageRating: "all-ages",
    tags: ["starter", "canvas", "teams"],
  }),
  controllerPath: "/controller",
  stores: [pongStore],
  simulation: pongSimulation,
  input: pongInput,
  inputBindings: pongInputBindings,
  settings: pongSettings,
  assets: pongAssets,
  theme: pongTheme,
  agent: agentContract,
  testing: "./testing/profiles.ts",
});
```

```tsx
// games/pong/src/app.tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { airjam } from "./airjam.config";

const app = createAirJamApp(airjam, { runtime: env.vite(import.meta.env) });
// <app.Host><HostView /></app.Host>, <Route path={app.paths.controller} …>
```

Settings, assets and theme sit in leaf modules so the simulation, stores and
drawing code import them for their types and values without importing the
config back into themselves.

### `defineAirJamGame` (`@air-jam/sdk/core`, phase 1)

New file `packages/sdk/src/core/game.ts`, exported from `core.ts`:

```ts
export interface AirJamGameDeclaration {
  metadata: AirJamGameMetadata; // required; metadata.slug is the game's id everywhere
  controllerPath?: string; // default "/controller", normalised to a leading slash
  stores?: readonly AttachableStore[];
  simulation?: AirJamSimulationDeclaration; // object or loader, unchanged
  input?: AirJamInput;
  inputBindings?: AirJamInputBindings; // requires input
  agent?: AirJamAgentContract;
  testing?: string; // path relative to airjam.config.ts, inside the project
  settings?: AirJamSettings; // phase 2
  assets?: AirJamAssets; // phase 3
  theme?: AirJamTheme; // phase 3
}

export interface AirJamGame extends Readonly<AirJamGameDeclaration> {
  readonly controllerPath: string;
  readonly stores: readonly AttachableStore[];
  /** Builds this game's host core from the game's own SDK, as today. */
  readonly createHostRuntime: HostRuntimeFactory;
}

export function defineAirJamGame(
  declaration: AirJamGameDeclaration,
): AirJamGame;
export function isAirJamGame(value: unknown): value is AirJamGame; // brand set by defineAirJamGame
```

`defineAirJamGame` validates eagerly and throws errors that name the fix:
metadata through `airJamGameMetadataSchema`; `inputBindings` without `input`
(the check moves here from `createAirJamApp`); the controller path; a
`testing` path that is absolute or leaves the project. It freezes the result.
`createHostRuntime` is today's factory from `createAirJamApp`, with the agent
registered under `metadata.slug` rather than a `"game"` fallback and
`maxPlayers` taken from `metadata.maxPlayers`.

The agent contract helpers move from the root to core so a config's graph stays
React-free: `agentAction`, `agentActionInput`, `agentStore`,
`defineAirJamAgentContract`, `defineAirJamAgentStores` and their types leave
`packages/sdk/src/index.ts` and join `core.ts` (`packages/sdk/src/agent/*.ts`
import no React today). The root keeps only React bindings, per the core
layering plan's one-import-path rule.

### The React binding (`@air-jam/sdk`, phase 1)

`createAirJamApp(game: AirJamGame, options?: { runtime?: ResolveAirJamConfigInput; errorBoundary?: AirJamAppErrorBoundaryOptions })`
returns `{ Host, Controller, paths, session }` and nothing else; the game's
parts are read from `game`. `ResolveAirJamConfigInput.maxPlayers` is removed:
both the browser host and the headless runner take capacity from
`game.metadata.maxPlayers`. From phase 3 the binding also mounts the declared
sounds and theme on each surface, so games stop mounting `AudioRuntime`.

### Settings (`@air-jam/sdk/core`, phase 2)

New file `packages/sdk/src/core/settings.ts`:

```ts
export const pongSettings = defineAirJamSettings({
  paddleSpeed: setting.number({
    default: 720,
    min: 360,
    max: 1440,
    step: 10,
    live: true,
    description: "Paddle speed in pixels per second.",
  }),
  ballSpeed: setting.number({
    default: 360,
    min: 180,
    max: 720,
    step: 10,
    live: true,
    description: "Serve speed of the ball in pixels per second.",
  }),
});
export type PongSettings = AirJamSettingsValues<typeof pongSettings>;
// { readonly paddleSpeed: number; readonly ballSpeed: number }
```

Three kinds, a discriminated zod union `airJamSettingSchema` on `kind`:

| Kind      | Fields                                                                | Value     |
| --------- | --------------------------------------------------------------------- | --------- |
| `number`  | `default`, `min`, `max`, optional `step`; whole numbers use `step: 1` | `number`  |
| `boolean` | `default`                                                             | `boolean` |
| `choice`  | `options` (non-empty string tuple), `default`                         | the union |

Every kind takes optional `live` (default false) and `description` (one
sentence for Studio and agents). Keys are lower camel case ids; labels derive
from keys. `defineAirJamSettings` checks that each default lies in range, on
its step and among its options.

What a setting is: a number, switch or choice a designer tunes while
playtesting, read by outcome logic. A choice players make in the lobby, such as
Pong's `pointsToWin`, stays store state.

How settings reach the game:

1. `HostRuntimeOptions.settings` takes initial values (a partial, validated;
   unknown keys fail `AJ_SETTING_UNKNOWN`, bad values `AJ_SETTING_INVALID`).
   Defaults fill the rest. The host runtime owns the current values and a
   revision number.
2. `AirJamSimulation.create({ random, settings })`, `AirJamStepContext.settings`
   and the `observe` context read them; `AirJamActionContext.settings` gives
   store actions the same values. Each is typed by a settings type parameter
   that defaults to an empty record.
3. Host drawing reads them with `useAirJamSettings(pongSettings)`, a root hook
   subscribed to the host runtime. Settings are host-only: controllers have no
   settings hook, and a game copies a value a phone must show into its store.
4. A live change uses two new operations in `hostAgentRequestSchema`
   (`packages/sdk/src/runtime/contracts/agent-control.ts`): `settings-read`
   (`{ roomId, runtimeId }` → `{ values, revision }`) and `settings-update`
   (`{ roomId, runtimeId, patch, expectedRevision }` → `{ values, revision }`).
   They pass the same authority checks as `invoke-host`. An update applies
   atomically between steps; it fails `AJ_SETTING_STALE` on a revision
   mismatch and `AJ_SETTING_NOT_LIVE` for a non-live key, whose error says to
   start a new room with that value. Non-live settings are fixed for the life
   of the host runtime because `create` reads them.
5. Replays stay exact. The input log moves to `version: 2` with a top-level
   `settings` (the resolved initial values) and a new event `airjam:settings`
   whose payload is the accepted patch and revision, queued in the same ordered
   stream as `airjam:action_rpc`. `replayAirJamInputLog` passes the initial
   values to the host it builds and applies each settings entry in order.

### Assets (`@air-jam/sdk/core`, phase 3)

New file `packages/sdk/src/core/assets.ts`. `SoundConfig` moves here as a zod
schema; `packages/sdk/src/audio/audio-manager.ts` imports its inferred type.

```ts
export const pongAssets = defineAirJamAssets({
  sounds: {
    hit: { src: ["/sounds/pong-hit.wav"], volume: 0.55 },
    score: { src: ["/sounds/pong-score.wav"], volume: 0.65 },
  },
  images: {},
  files: {},
});
```

1. Three kinds: `sounds` (today's `SoundConfig` fields plus optional
   `surface: "host" | "controller"`, omitted meaning both), `images`
   (`{ src }`) and `files` (`{ src }`, any other file the game loads by URL,
   such as Last Band Standing's `/lottie/Fire.json`).
2. Every `src` is a path in the game's `public/` folder, written as it is
   served: it starts with `/`, contains no `..`, query or hash. Hosted releases
   already serve these paths at the release origin's root, as today's sound
   manifests rely on.
3. Game code reads the object it declared: `pongAssets.images.defend.src`.
   The binding mounts `AudioRuntime` with the sounds for each surface, so Air
   Capture's separate host and controller manifests become one declaration
   with `surface` marks and phones still never load host music.
4. The loader fails `AJ_ASSET_MISSING` when a declared file is absent.
   Rejecting undeclared files is the architecture gate's job (core layering
   plan, phase 6 item 2), not this loader's.
5. Arcade cover, thumbnail and preview video are not game assets: no tool
   reads `public/arcade/` (the platform media upload takes explicit paths), so
   they stay files beside the game until a tool needs to read them from the
   declaration.

### Theme (`@air-jam/sdk/core`, phase 3)

New file `packages/sdk/src/core/theme.ts`:

```ts
export const pongTheme = defineAirJamTheme({
  colors: {
    background: "#050816",
    surface: "rgba(8, 12, 24, 0.82)",
    text: "#f8fafc",
    team1: "#f97316",
    team2: "#38bdf8",
  },
  fonts: { display: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif' },
});
```

1. Two maps keyed by lower camel case ids: `colors` (a CSS colour: hex,
   `rgb()`, `rgba()`, `hsl()`, `oklch()`) and `fonts` (a CSS font-family list).
2. The binding writes them as `--airjam-color-<kebab-id>` and
   `--airjam-font-<kebab-id>` custom properties in a `<style>` element rendered
   with each surface, so there is no flash and no build step.
3. CSS consumes them in its existing names:
   `@theme inline { --color-pong-orange: var(--airjam-color-team1); }`, so
   Tailwind classes do not change. Shadows, gradients and layout stay
   handwritten CSS: they are presentation, not tokens tools read.
4. Canvas and 3D drawing import the theme object: `PONG_ARENA_DEFAULT_PROPS`
   and `TEAM1_COLOR` read `pongTheme.colors`, so team colours have one owner.

### Testing, player and visual scenarios (`@air-jam/devtools/testing`, phase 1)

The module named by `testing` exports one value:

```ts
export const testing = defineAirJamTesting({
  player: pongPlayer, // AirJamPlayerContract, unchanged type
  profiles: { scoring, rally, diagnostics }, // AirJamTestProfile records
  visual: { scenarios: [...] }, // optional; uses the declared agent contract
});
```

1. When a game declares a player, devtools offers it in every profile as the
   reserved policy `model`; profiles list only their scripted policies. A
   profile that defines `model` itself fails `AJ_TEST_POLICY_RESERVED`.
   `createAirJamPlayerPolicy` becomes internal to devtools.
2. Visual scenario packs drop their own `agent` field and use the game's
   declared agent. `visualScenariosModule` is gone.
3. The module may import `@air-jam/devtools`; the game runtime never imports
   it. The loader resolves the path against the config's directory and rejects
   a path outside the project, as `run-test-profile.ts` does today.

### The description (`@air-jam/sdk/core`, phase 1)

New file `packages/sdk/src/core/game-description.ts`:

```ts
export const airJamGameDescriptionSchema = z
  .object({
    version: z.literal(1),
    metadata: airJamGameMetadataSchema,
    controllerPath: z.string(),
    simulation: z.boolean(),
    input: airJamInputDescriptionSchema.nullable(), // the declared controls as data
    agent: agentContractDescriptionSchema.nullable(),
    testing: z.boolean(),
    // phase 2: settings: record of airJamSettingSchema
    // phase 3: assets and theme, as declared
  })
  .strict();
export function describeAirJamGame(game: AirJamGame): AirJamGameDescription;
```

The description is the cross-process form of the declaration: plain JSON, no
functions, no store instances. `agent` reuses the existing
`agentContractDescriptionSchema` (`packages/sdk/src/agent/agent-evaluator.ts`).
`airJamInputDescriptionSchema` is new in `packages/sdk/src/core/input.ts`: a
record of the declared controls, which are already plain data (`kind`, `name`,
and a button's `mode` or a stick's `keepDirection`). Phases 2 and 3 add their fields in the same
change that adds the declaration fields, keeping `version: 1` until 1.0 ships.

## The loader

One loader in devtools, two forms of result:

1. **Location.** One path: `src/airjam.config.ts`, a constant
   `AIRJAM_CONFIG_PATH` in `packages/devtools/src/games.ts` that `context.ts`
   and `release.ts` import. The other seven candidates go.
2. **Live declaration, in process.** `packages/devtools/src/tooling/load-game.ts`
   exports `loadAirJamGame(configPath): Promise<AirJamGame>` and
   `loadAirJamTesting(configPath, game)`. It imports the module, reads only the
   named export `airjam`, and requires `isAirJamGame`. Before importing, it
   registers one synchronous `module.registerHooks` boundary for imports,
   `require` and `createRequire`. Declaration imports are serialized, with a
   counter active only during each import and cleared even on failure. While
   active, every resolve of `react`, `react-dom`, the `@air-jam/sdk` root,
   a `.tsx` or a `.css` file fails `AJ_DECLARATION_NOT_FRAMEWORK_FREE`, naming
   the importer regardless of its parent URL. Tools finish loading the
   declaration before importing testing or starting framework-bound work. Authoring tools require Node.js 22.15 or newer; SDK and
   server minimums remain 22.0. Older authoring runtimes fail with a clear
   minimum-version error. Only helper subprocesses that already run under `tsx` call it:
   `run-test-profile`, `run-headless-room`, `run-visual-capture` and the new
   `describe-game`.
3. **Description, across processes.** `tooling/describe-game.ts` takes one or
   more `--config` paths, loads each, checks declared assets exist (phase 3),
   and prints one JSON array validated with `airJamGameDescriptionSchema`.
   `listGames` calls it once for all games in a monorepo; `inspectGame` calls it
   for one and returns
   `{ id: metadata.slug, rootDir, configPath, packageJsonPath, scripts, qualityGates, declaration }`.
   Load and validation failures surface as errors, never as `null`.
4. **Public surface.** `@air-jam/devtools/games` keeps `listGames` and
   `inspectGame` as the only way tools outside devtools read a game. No new
   subpath.

### Who reads what

| Part              | Declared in                 | Read by, through                                                                                   |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| Metadata          | `defineAirJamGame.metadata` | game id for every tool, release checks, Arcade import, scaffold catalog: `inspectGame`/`listGames` |
| Controller path   | `controllerPath`            | binding routes; release bundle and dev URLs: `inspectGame`                                         |
| Stores            | `stores`                    | host and controller runtimes; headless room, replays: `loadAirJamGame` → `createHostRuntime`       |
| Simulation (step) | `simulation`                | host runtime clock; headless room, replays, test runs: `loadAirJamGame`                            |
| Input, bindings   | `input`, `inputBindings`    | runtimes; agents and Studio list controls: `inspectGame`                                           |
| Agent contract    | `agent`                     | host agent bridge; MCP `airjam.inspect_game`: `inspectGame`                                        |
| Settings          | `settings`                  | simulation, actions, `useAirJamSettings`; descriptors via `inspectGame`, values via host control   |
| Assets            | `assets`                    | game code, binding's `AudioRuntime`; Studio and agents: `inspectGame`                              |
| Theme             | `theme`                     | binding's CSS variables, drawing code; Studio and agents: `inspectGame`                            |
| Test profiles     | `testing` module            | `airjam evaluate`, headless tests, runs, replays, Studio runs: `loadAirJamTesting`                 |
| Player contract   | `testing` module `player`   | model seats in every profile, Studio steered seats: `loadAirJamTesting`                            |
| Visual scenarios  | `testing` module `visual`   | visual capture helper: `loadAirJamTesting`                                                         |

MCP: `airjam.inspect_game` returns the description, so
`airjam.inspect_game_agent_contract` is removed (its content is
`declaration.agent`). Phase 2 adds `airjam.read_game_settings` and
`airjam.update_game_settings`, taking the same target as
`airjam.observe_game_session` and routed through the same host control
adapter, and a `settings` input on `airjam.start_game_run`; the CLI's session
commands mirror them. `airjam evaluate` reads the declaration through
`inspectGame` (and, in phase 6 item 2, gates on it).

The private Studio reads nothing of its own (phase 4): the Studio MCP settings
tools and the Studio settings panel take descriptors from the workspace's
`inspectGame` description and values from the current room's
`settings-read`/`settings-update`, through the executor's existing
current-game host control. There is no Studio settings schema or storage.

## What the change removes

Phase 1:

1. the regular-expression readers: `metadataExportLikely` and
   `controllerPathLikely` in `packages/devtools/src/games.ts`,
   `readConfiguredControllerPath` and the `gameMetadata` warning in
   `packages/devtools/src/release.ts`; the CLI doctor's "Metadata export" line
   shows the declared slug instead
2. the three config path lists in `games.ts`, `release.ts` and `context.ts`
3. `loadGameMetadataFromConfig`'s `tsx --eval` import in `platform-games.ts`,
   and its read of `airjam-template.json` description and category
4. `tooling/airjam-agent.ts` (`loadAirJamAppConfig`, `readPublishedAgent`, the
   `default` export fallback), `tooling/agent-declaration.ts`,
   `tooling/agent-contract.ts` and `tooling/inspect-airjam-agent.ts`, replaced
   by `load-game.ts` and `describe-game.ts`
5. `visualScenariosModule` and both of its readers
6. the separate `gameMetadata` export in all six games
7. `runtime.maxPlayers` and `ResolveAirJamConfigInput.maxPlayers`
8. `id`, `name`, `description` and `category` in every `airjam-template.json`;
   the file keeps `default`, `scaffold` and `export`, and the generated
   `packages/create-airjam/scaffold-templates/manifest.json` takes identity from
   each game's description, so choosing a template still executes no game code
9. `createAirJamPlayerPolicy(<player>)` in every profile, and its export
10. the game fields of the `AirJamApp` object (`metadata`, `agent`, `testing`,
    `stores`, `simulation`, `input`, `createHostRuntime`) and the agent helper
    exports at the SDK root
11. the MCP tool `airjam.inspect_game_agent_contract`

Phase 2: tunable module constants that outcome logic reads, in every game.
Phase 3: every game's own `<AudioRuntime manifest>` mounts and sound manifest
constants, path imports of images, and colour and font literals duplicated
between CSS and TypeScript.

## Migration

Each phase moves everything it changes in the same pull request.

1. **First-party games and templates** (`games/*`, which are the templates):
   phase 1 rewrites the six configs to `defineAirJamGame`, moves
   `createAirJamApp` into `app.tsx`, switches agent contract imports from
   `@air-jam/sdk` to `@air-jam/sdk/core`, turns each testing module into
   `export const testing = defineAirJamTesting({...})`, and removes Last Band
   Standing's `runtime.maxPlayers`. Rooms of the five four-player games now
   admit four players, as their metadata says.
2. **Settings per game** (phase 2), by one rule: every constant that outcome
   logic reads for a speed, force, damage, health, duration or count becomes a
   setting with the constant as its default, `min` half and `max` double the
   default, `step` at the constant's precision, and `live: true` unless only
   `create` reads it. Pong: `paddleSpeed`, `ballSpeed`. Code Review:
   `maxVelocity`, `punchDamage`, `maxHp`, `empowerDurationMs`. Air Capture:
   `playerMaxSpeed`, `playerAcceleration`, `jumpForce`. The Office and Last
   Band Standing: their round and shift lengths. Minimal declares none and
   shows the empty shape in its config comment.
3. **Assets and theme per game** (phase 3): each game's sound manifests,
   images under `public/` and lottie files move into its `assets` module; its
   `@theme` colours and fonts move into its `theme` module and `index.css`
   maps them with `@theme inline`.
4. **AI pack.** The managed docs regenerate from the creator docs
   (`packages/cli/template-assets/managed/docs/airjam/generated/*`), and the
   handwritten pack files that describe the config move with them:
   `bootstrap/AGENTS.md`, the `game-architecture` and `airjam-mcp` skills,
   `managed/docs/airjam/agent-gold-path.md` and `agent-mcp.md`.
5. **Creator docs.** Pages under `content/docs` that show `createAirJamApp`
   fields (`sdk/input-system`, `sdk/networked-state`, `sdk/hooks`,
   `how-it-works/architecture`, `getting-started/introduction`,
   `getting-started/debugging`) show the declaration and the binding; phase 2
   adds a settings page and phase 3 an assets and theme page under `sdk/`.
6. **Migration guide.** `content/docs/getting-started/migrating-legacy-games`
   gains, under "From 0.9 To 1.0", a section per phase: "The game is declared
   in core" (config to `defineAirJamGame`, binding in `app.tsx`, agent imports,
   testing module, capacity from metadata), "Settings are declared" and
   "Assets and theme are declared". Each break also has an error naming its
   replacement, such as passing an app options object to `createAirJamApp`.
   `docs/guides/legacy-game-migration-guide.md` follows it.
7. **Private repository.** When it moves to the prerelease containing phase 1,
   `scripts/repo/fixtures/visual-source-qualification.mjs` declares its
   scenarios in the fixture game's testing module instead of patching
   `airjam`.
8. **Studio projects, including "2D top down rpg".** Studio projects start
   from `create-airjam` 0.9.3's Pong template (`studioPongStarter` in
   `apps/platform/src/lib/studio-project-contract.ts`), so the RPG is on the
   0.9 shape. Its files live in the Studio executor's workspace storage and
   were not read for this plan. It moves in phase 4 by following the migration
   guide's whole "From 0.9 To 1.0" section: its config becomes
   `defineAirJamGame`; its tunables (movement speed, health, damage and
   similar) become settings by the rule above; its imported slime sprite under
   `public/images/` and its sounds become declared assets; its colours become
   theme tokens. Opus does this in the desktop Studio on the RPG as the
   proving ground the roadmap names, and fixes the guide wherever the RPG shows
   a gap. Earlier saved versions keep the 0.9 shape they were saved with.

## Delivery

Each phase is one pull request into `release/1.0`, production-valid on its
own, and stays in the final system.

### Phase 1: one declaration, one loader (public `air-jam`)

Builds `defineAirJamGame`, `isAirJamGame`, `describeAirJamGame` and
`airJamGameDescriptionSchema` in core; moves the agent helpers to core; changes
`createAirJamApp` to the binding signature; builds `load-game.ts`,
`describe-game.ts` and `defineAirJamTesting` in devtools; moves every reader in
the removal list onto them; migrates games, AI pack, docs and the guide.

Proved by:

1. `pnpm check:batch` passes, including the SDK core boundary check over the
   new core files
2. a devtools test describes all six games in one `describe-game` process; each
   description parses, and each `metadata.slug` equals its template id
3. a devtools test fixture whose config imports React fails with
   `AJ_DECLARATION_NOT_FRAMEWORK_FREE` naming the importing file
4. every terminating authored profile of Pong, Minimal, The Office, Code
   Review and Air Capture returns a passed headless verdict; each cooperative
   profile runs headless to a bounded end with clean teardown, preserving its
   semantics. Every profile offers `model` from the declared player in
   `airjam.list_game_test_profiles`
5. a search finds no `loadAirJamAppConfig`, `gameMetadata` export,
   `visualScenariosModule`, `maxPlayers` in runtime options or
   `createAirJamPlayerPolicy(` in games
6. Pong plays in a browser with a phone controller, and a fifth phone is
   refused
7. a scaffolded Pong project from the regenerated template passes its own
   typecheck and tests

### Phase 2: settings (public `air-jam`)

Builds `setting`, `defineAirJamSettings`, `AirJamSettingsValues` and the
settings schema; host runtime settings with revision; the step, create,
observe and action contexts; `useAirJamSettings`; `settings-read` and
`settings-update`; input log version 2 and its replay; the description's
`settings`; the two MCP tools, the run start input and CLI commands; every
game's settings by the migration rule; the settings docs page and guide
section.

Proved by:

1. a headless Pong test starts with `ballSpeed: 600`, changes it live to 700
   mid-rally, and its replay from the input log ends in the identical final
   observation
2. updating a non-live setting fails `AJ_SETTING_NOT_LIVE`, a stale revision
   `AJ_SETTING_STALE`
3. `airjam.update_game_settings` against a running local Pong room visibly
   speeds the ball, and `airjam.read_game_settings` returns the new revision
4. all authored profiles still pass headless

### Phase 3: assets and theme (public `air-jam`)

Builds `defineAirJamAssets`, the sound schema moved into core,
`defineAirJamTheme`, the binding's audio mount and CSS variables, asset
existence checks in `describe-game`, and the description's `assets` and
`theme`; migrates every game's sounds, images, files, colours and fonts; adds
the docs page and guide section.

Proved by:

1. a devtools test fixture declaring a missing image fails `AJ_ASSET_MISSING`
2. every game looks and sounds as before in host and controller screenshots at
   phone and desktop width, and Air Capture's controller loads no host music
3. a search finds no `<AudioRuntime` in games and no colour literal shared
   between a game's CSS and its TypeScript

G6-10 completes when phase 3 merges.

### Phase 4: Studio reads the declaration (private `air-jam-platform`)

After a public prerelease containing phases 1 to 3, consumed through its exact
tarballs: the Studio starter moves to that prerelease's Pong template; the
Studio MCP gains settings read and update tools and the settings panel shows
declared settings, both reading only the description and host control as
described above; asset import returns the `assets` entry to add beside the
file it wrote; the RPG migrates. This closes the
[desktop Studio plan](https://github.com/vucinatim/air-jam-platform/blob/release/1.0/docs/plans/studio-desktop-plan.md)'s
Settings row.

Proved by: in the desktop Studio, Opus reads the RPG's settings through the
Studio MCP, changes a live one and sees the game change in the observation;
the settings panel shows the same values; the RPG's seeded test run passes.

## Decisions made while designing

1. **A React-free file, not a second file.** The core layering plan decided
   `airjam.config.ts` stays the single declaration and no separate React-free
   definition file was needed. That stands; the evidence (tools import React
   to read metadata, the config carries browser topology) shows the simpler end
   state is the same file without React, with topology in the binding.
2. **Codex's second opinion** (Bee research thread `071289d9`, 2026-10-28)
   agreed on the React-free core declaration, `createAirJamApp(game, { runtime })`,
   settings in core reaching step and action contexts, live changes through
   `hostAgentRequestSchema` with input-log entries, one devtools loader with a
   JSON description, and the removal list. Where it differed, this plan chose:
   1. _Player contract:_ Codex proposed a separate lazily loaded `player` field
      and moving its types to `@air-jam/sdk/agent-tooling`. Its only readers
      are devtools model seats, so it lives in the testing module with the
      profiles: one specifier, nothing in the game bundle, no second loader.
   2. _Asset sources:_ Codex proposed `public`, bundled `file` and `url`
      sources. No game uses bundled files or remote URLs (Code Review's
      `/sprites/*.png` imports are public files) and Studio writes to
      `public/`, so a source is a public path.
   3. _Arcade media:_ Codex declared cover, thumbnail and preview. No tool
      reads them from the game, so they stay undeclared until one does.
   4. _Theme:_ Codex proposed CSS-named tokens with kind descriptors, a teams
      map and generated Tailwind `@theme`. Two maps of colours and fonts,
      injected as CSS variables by the binding and mapped with
      `@theme inline`, need no build step, and team colours are ordinary
      colours.
   5. _Settings on controllers:_ Codex replicated settings to controllers.
      No controller reads one, so settings are host-only and games put what a
      phone shows into a store.
   6. _Non-live settings:_ Codex locked them once the room starts. They are
      fixed for the life of the host runtime instead, because `create` reads
      them and a mid-room change could not reach it.
   7. _Loader location:_ Codex proposed a new `@air-jam/devtools/game-definition`
      subpath. `@air-jam/devtools/games` already owns finding and inspecting
      games, so it carries the description and the live loader stays internal.
   8. _Description schema:_ Codex put it in devtools. It lives in core beside
      the declaration it describes, so the Studio and other engines validate
      against the same schema.
3. **Seeded randomness in store actions** (Last Band Standing's shuffle) is
   still the core layering plan's open item; settings in the log do not
   replace it.

## Stop rules

1. stop before a second place a game declares any part listed here
2. stop before a tool reads config source text, an undeclared export or a
   convention-named file instead of the loader
3. stop before the declaration's graph needs React, the DOM or CSS
4. stop before a settings, asset or theme kind no first-party game or Studio
   flow uses
5. stop before Studio keeps its own copy of settings or assets
6. stop before keeping an old field, export or reader beside its replacement

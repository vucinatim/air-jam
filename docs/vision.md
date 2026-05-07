# Air Jam Vision

Last updated: 2026-05-07  
Status: guiding vision

## Purpose

This document defines the ultimate long-term product vision for Air Jam.

It exists to keep one thing explicit:

Air Jam is not only a game framework and not only a hosted platform.
It is intended to grow into an AI-native game creation, testing, and release system where both humans and agents operate through the same clean runtime contracts.

## Ultimate Vision

The end-state experience should feel like this:

1. a user writes one high-level prompt such as "make a mario kart clone"
2. Air Jam Studio starts a coordinated project workflow
3. multiple specialized agents are spawned in parallel
4. different agents can own gameplay systems, input design, physics, UI, scene composition, audio, music, effects, art assets, balancing, testing, and release preparation
5. agents can continuously run the game, inspect outputs, control players, observe state, evaluate quality, and keep iterating
6. the system keeps going until the result reaches a genuinely polished and impressive level rather than stopping at a rough prototype

This is not meant to be a prompt toy.
It is meant to be a serious creation harness.

## Required Agent Capabilities

To support that future, agents must eventually be able to:

1. boot a game reliably
2. join and control one or more players directly
3. inspect controller actions and available command surfaces
4. inspect authoritative runtime state and lifecycle state
5. inspect logs and diagnostics from all relevant runtime surfaces
6. inspect visuals and rendered output
7. trigger repeatable evaluation loops without depending only on browser UI automation
8. compare outcomes over time and keep iterating automatically

That means Air Jam should eventually expose machine-usable contracts for:

1. controller input and action execution
2. replicated state inspection
3. runtime events and signals
4. visual and scene evaluation hooks
5. logs, traces, and diagnostics
6. test and preview orchestration

## Product Consequence

This changes how the framework should be designed even before those agent features fully exist.

Air Jam should increasingly act as:

1. a multiplayer game framework
2. a hosted release and distribution platform
3. an AI-native Studio for creating and shipping games
4. an evaluation harness for agents that need fast, reliable feedback loops

The framework is therefore partially evolving into the substrate that future agents will build on top of and operate through.

## Public Legibility Consequence

If Air Jam is meant to become a real product and a real agent-operable system, it also has to be legible outside the repo.

That means Air Jam should not only be well-architected internally.
It should also be easy for humans, search engines, package ecosystems, and LLM agents to understand that it exists, what it is for, and which public surfaces are canonical.

This is not a marketing afterthought.
It is part of product design.

The long-term product has to be:

1. discoverable as a real category-defining thing
2. easy to classify from one pass over the homepage, docs, packages, and repo
3. explicit about which public contracts are stable and supported
4. retrievable by agents without guessing through vague or duplicated surfaces
5. consistent across website, docs, npm, GitHub, examples, and machine-readable endpoints

## Discoverability Philosophy

Air Jam should grow discoverability through truth density, not content volume.

That means:

1. fewer public pages with stronger jobs
2. one canonical explanation per product concept
3. real examples instead of SEO-targeted filler
4. machine-readable endpoints only when they map to real maintained product truths
5. no thin landing pages, duplicate docs, or fake AI-facing copy

The goal is not to game Google or scrape rankings out of low-signal content.

The goal is to make Air Jam the clearest and most trustworthy answer to the kinds of questions it should own.

## Public Product Shape

Air Jam should become legible through a small set of explicit public nouns:

1. `Air Jam` as the umbrella product
2. `@air-jam/sdk` as the game authoring framework
3. `@air-jam/server` as the realtime runtime/server lane
4. `@air-jam/mcp-server` as the agent and devtools integration lane
5. `create-airjam` as the project creation CLI

Those surfaces should be reinforced consistently across:

1. homepage and docs
2. package metadata and READMEs
3. GitHub repository metadata and releases
4. example games and launch material
5. machine-readable endpoints such as sitemaps, manifests, and agent-oriented indexes

Air Jam should not present as one vague platform blob.
It should present as one coherent system with a small number of obvious public entrypoints.

## Retrieval Consequence

The future agent story depends on more than internal runtime contracts.

It also depends on Air Jam being externally retrievable in a clean way.

Agents should be able to find:

1. the canonical docs
2. the correct package for the job
3. the intended installation path
4. the maintained machine-readable indexes
5. trustworthy examples and release notes

That means product discoverability and agent operability are linked.

If the public surface is ambiguous, fragmented, or full of dead-end metadata, agent usability degrades even if the internal architecture is strong.

## Architectural Consequences

The architecture should keep moving toward these rules:

1. every important runtime fact should have one clear owner
2. transport, runtime state, input, signals, logs, and visuals should be explicit and machine-readable
3. critical behavior should not be trapped inside UI-only flows
4. preview and testing surfaces should converge on reusable contracts
5. local preview, hosted preview, authoritative release, and publish workflows should share one coherent model
6. human workflows and agent workflows should use the same core contracts whenever possible
7. browser automation should be a fallback, not the primary long-term control path
8. public docs, package surfaces, and machine-readable endpoints should reflect the real architecture instead of drifting into a second inconsistent story

## Future Agent Control Model

The likely long-term direction is that Air Jam will expose direct agent-facing control and inspection contracts that bypass fragile browser-only automation.

That future likely includes:

1. a runtime control protocol for joining and driving controller sessions directly
2. structured state and lifecycle inspection APIs
3. structured logs and trace streams
4. visual inspection and evaluation hooks
5. scenario orchestration for repeated gameplay trials
6. release and publish contracts that agents can drive safely

Those systems should not become disconnected side tools.
They should sit on top of the same framework/runtime contracts the product already uses.

## Design Rule

When making architecture decisions now, prefer the option that makes Air Jam easier to grow into:

1. a clean multiplayer framework
2. a reliable hosted platform
3. a strong local-first Studio
4. an agent-operable game creation and testing harness

If a solution makes the human UI work today but hides the real contract from future agents, it is probably the wrong long-term direction.

The same rule applies to public product surfaces.

If a discoverability tactic increases noise, duplicates explanation, or creates a misleading public story, it is probably the wrong direction even if it might help short-term traffic.

Air Jam should become easier to find by becoming more canonical, more explicit, and more structurally honest.

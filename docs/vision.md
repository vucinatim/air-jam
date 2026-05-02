# Air Jam Vision

Last updated: 2026-04-09  
Status: active

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

## Architectural Consequences

The architecture should keep moving toward these rules:

1. every important runtime fact should have one clear owner
2. transport, runtime state, input, signals, logs, and visuals should be explicit and machine-readable
3. critical behavior should not be trapped inside UI-only flows
4. preview and testing surfaces should converge on reusable contracts
5. local preview, hosted preview, authoritative release, and publish workflows should share one coherent model
6. human workflows and agent workflows should use the same core contracts whenever possible
7. browser automation should be a fallback, not the primary long-term control path

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

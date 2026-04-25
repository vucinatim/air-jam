# Air Jam Blog Post -- Planning & Discussion

## Working Title Ideas

1. "Phones as Controllers: An Open-Source Framework for Vibe-Coding Party Games"
2. "Air Jam: Building Multiplayer Phone Games in the Age of AI"
3. "What If Your Phone Was a Game Controller?"
4. "The Framework Behind Vibe-Coded Party Games"
5. "We Built a Framework for Making Games With Phones -- Then We Tested It"

## Target Audience

Both developers and general tech-curious readers. Accessible and fun for anyone
interested in AI-assisted development and creative tech, with enough technical
substance (and a few code snippets) to get devs excited about the framework.

## Tone

Casual, first-person, conversational. Tim's voice. Warm but grounded -- let the
work and the games speak for themselves. Not a game jam report (that's for
LinkedIn). This is about the framework, the ideas, and what they made possible.

## Length

Medium (8-12 min read, ~2500-3500 words)

---

## Key Editorial Decisions

**The framework is the main character.** The game jam is the proof point that
validates it, not the centerpiece. The structure should flow:
idea -> design -> framework -> here's what people built with it -> try it yourself.

**Don't make it a game jam report.** The LinkedIn post covers that. This article
is about: why does this framework exist, what ideas drove its design, how does it
work, and what does it enable. The games are evidence, not the story.

**The AI angle should be honest, not hype.** The framework is designed for an era
where LLMs write most of the code. That's a fact about its design, not a sales
pitch. Be matter-of-fact about it.

**The social/in-person angle is the emotional thread.** In a sea of AI discourse,
this project is about people in a room having fun together. That's the thing worth
lingering on.

---

## Gathered Context

### The Game Jam

- **Duration:** 7 hours
- **Team:** 9 developers at zerodays (a software dev agency)
- **Teams:** 3 teams, each building one game
- **AI tools used:** A mix -- Claude Opus 4.6, Codex 5.3, Kimi K2.5, Cursor Composer.
  Different devs use different environments: VS Code, Cursor, Vim, terminals.
- **Notable:** Spela (the team's "office mom," only woman on the team) was on The
  Office team and wrote the character skill profiles for each real team member.
  She also won a round of Last Band Standing -- pop culture savvy.

### Memorable Moments (for flavor, not as the focus)

- Code Review had great emergent glitches: two players could surround a third and
  bounce them back and forth with punches -- an unintended mechanic that became a
  feature
- The Office notifications in Slovenian were funny to read out loud as they appeared
- Last Band Standing's meme songs (Rick Roll etc.) got big laughs
- The diversity of games from the same framework surprised people

### Company

- zerodays -- mention naturally, don't force it
- Slovenian company (explains the Slovenian language in The Office, the EUR currency,
  the Balkan music in Last Band Standing)

---

## Proposed Structure (Revised)

### 1. HOOK -- The Idea (~200 words)

Start with the core question: what if every phone in a room could instantly become
a game controller? No app downloads, no Bluetooth pairing -- just scan a QR code
and play. And what if building these games was so straightforward that a team of
developers could each build one in a single day, with AI doing most of the coding?

That's Air Jam.

**Purpose:** Set up the concept clearly and quickly. Plant the "I want to know more"
seed.

### 2. WHY THIS EXISTS (~400 words)

The backstory and motivation:

- The AirConsole concept (phones as controllers) is brilliant but closed/commercial
- The rise of AI-assisted coding means the barrier to making games has dropped
  massively -- but you still need infrastructure (networking, input handling, rooms,
  state sync)
- The goal: handle the hard stuff so people can focus on the fun, creative parts
- Designed from the start to be extensible and open-source
- A free public server so anyone can deploy games anywhere with an app ID

**Key insight to articulate:** There are two hard problems in making phone-controller
party games: (1) the real-time networking/input pipeline, and (2) the actual game.
Air Jam solves #1 completely so you (and your LLM) can focus entirely on #2.

**Visual opportunity:** Architecture diagram (Host <-> Server <-> Controllers)

### 3. HOW IT WORKS (~400 words)

The flow, explained simply:

1. Computer/TV opens the game URL (the "host")
2. A room code + QR code appear
3. Players scan with their phones
4. Their phones load a custom controller UI
5. Input flows from phones to game in real-time
6. Game state flows back to phones

A code snippet showing the minimal setup -- the Provider, a simple input schema,
and the host/controller hooks. Show how little code it takes.

Second snippet: a `createAirJamStore` example showing how game state syncs
automatically between devices. This is the "wow, that's it?" moment for devs.

**Key message:** You define a Zod schema for your input, wrap your app in a
provider, and call two hooks. That's the networking done.

**Visual opportunity:** Code snippets. Maybe a screenshot of QR code on host +
phone controller side by side.

### 4. THE DECISIONS THAT MAKE IT WORK (~500 words)

2-3 design decisions, explained accessibly:

**a) Input Latching**
The "I pressed the button but nothing happened" problem. Game loops run at 60fps,
network events arrive whenever they want. A quick button tap can arrive and reset
between two frames -- the game never sees it. Air Jam's latching system holds onto
button presses until the game actually reads them. No tap is ever lost.

This is a real problem that anyone who's played a laggy game understands
intuitively. Non-devs get it, devs appreciate the solution.

**b) Transparent State Sync (createAirJamStore)**
You write a Zustand store like normal. On the host, it works like normal. On
controllers, action calls automatically become network requests to the host. The
host is always the source of truth. You never write networking code -- it just
works.

This is the thing that makes vibe-coding games practical. The LLM doesn't need to
understand WebSockets or message protocols. It just writes a store.

**c) Batteries Included, But Optional**
Shell components handle the boring stuff (QR codes, room codes, player lists,
connection status, orientation locking). But everything is optional and replaceable.
You can use the shells for rapid prototyping and replace them later -- or not.

**Visual opportunity:** Input latching diagram (optional). Before/after showing raw
vs latched input timeline.

### 5. WHAT PEOPLE BUILT (~700 words)

**Transition:** "To test whether any of this actually works, we ran a game jam."

Brief setup (one paragraph): 9 people, 3 teams, 7 hours, AI-assisted development.
Different tools, different environments, same framework.

Then the three games -- not as a report, but as evidence of what the framework
enables. Focus on what makes each game interesting and how it used the framework
differently:

**a) "Code Review" -- A Boxing Game**

- Coders vs Reviewers in a pixel-art boxing ring
- Phone gyroscope controls movement (tilt to walk)
- Punch, defend, and an emergent mechanic: cornering opponents for combo bouncing
- Shows the framework handling real-time physics input via device sensors

**b) "Last Band Standing" -- A Music Quiz**

- Blurred YouTube video plays, race to identify the song
- 80+ songs spanning decades and cultures (including some well-placed Rick Rolls)
- Shows the framework working for turn-based/round-based games, not just real-time
- The controller is just four answer buttons -- radically different from the boxing
  game's gyroscope input, same SDK

**c) "The Office" -- A Cooperative Office Sim**

- Overcooked meets your actual workplace
- Characters are real team members with custom skill profiles
  (the PM is 5/5 at meetings, 1/5 at coding)
- Tasks pay in euros. Cleaning the coffee machine pays 0.
- You can die of boredom if you don't play enough FIFA
- Entirely in Slovenian -- deeply personal to the team that built it
- Shows the framework handling cooperative gameplay with shared resources

**Key narrative:** Three completely different genres. A fighting game, a quiz show,
and a cooperative sim. All built with the same SDK in the same 7 hours. That range
is the point.

**Visual opportunity:** One screenshot per game (host view). Maybe one controller
screenshot to show the variety.

### 6. REFLECTIONS (~300 words)

Honest takeaways about vibe-coding games with the framework:

- What the framework got right (networking abstraction, input handling, the shell
  components as starting points)
- What AI-assisted development was like for game-making specifically
- The thing that surprised: how personal the games became. The framework handles
  the infrastructure, so the creative energy goes entirely into the game design.
  That's how you get "death by boredom" as a mechanic and your coworkers' faces
  as game characters.
- The social dimension: these games only exist to be played together, in person.
  That's a different energy from most of what's being built with AI right now.

### 7. TRY IT YOURSELF (~200 words)

- Fully open-source: GitHub link
- Free public server with app IDs
- One command: `npx create-airjam my-game`
- npm packages: `@air-jam/sdk`, `@air-jam/server`
- Documentation and platform link
- Invitation: build a game, host a game jam, contribute

Close with something brief and warm. Not a sales pitch. Maybe: the best
games are the ones you play with people in the room.

---

## Visual Assets Needed

1. **Architecture diagram** -- Host <-> Server <-> Controllers flow
   (clean, simple, could be a draw.io or Excalidraw style diagram)
2. **Code snippets** (2-3, embedded in post):
   - AirJamProvider + input schema definition
   - createAirJamStore example (simplified)
   - Maybe: the useAirJamHost / useAirJamController hook usage
3. **Game screenshots** (3, one per game):
   - Code Review: the boxing arena
   - Last Band Standing: the blurred video quiz screen
   - The Office: the office with characters
4. **Controller screenshots** (1-2, showing variety):
   - Side-by-side of different controller UIs to show range
5. **Optional: Input latching diagram**
   - Timeline showing raw input vs latched input

---

## Resolved Questions

- [x] Duration: 7 hours
- [x] AI tools: Opus 4.6, Codex 5.3, Kimi K2.5, Cursor Composer -- varied per dev
- [x] Dev environments: VS Code, Cursor, Vim, terminals -- varied per dev
- [x] Company: zerodays, mention naturally
- [x] Photos: available, but blog isn't the game jam report (that's LinkedIn)
- [x] Memorable moments: Use for flavor, not as focal point
- [x] Spela: wrote character profiles, won Last Band Standing. Good detail.
- [x] Focus: Framework + ideas first, game jam as proof point

## Resolved Links & References

- **Platform:** https://air-jam.app
- **Docs:** https://air-jam.app/docs
- **Arcade:** https://air-jam.app/arcade (all published games playable here)
- **GitHub:** https://github.com/vucinatim/air-jam
- **Server:** wss://api.air-jam.app (free public server)
- **npm packages:**
  - `@air-jam/sdk` -- https://www.npmjs.com/package/@air-jam/sdk
  - `@air-jam/server` -- https://www.npmjs.com/package/@air-jam/server
  - `create-airjam` -- https://www.npmjs.com/package/create-airjam
- **Scaffold command:** `npx create-airjam my-game`
- **App IDs:** Sign up at air-jam.app, create a game in dashboard, app ID auto-generated
- **Game jam games:** Will all be published and playable at air-jam.app/arcade

## Remaining Questions

- [ ] Anything specific you want to make sure gets into the article?
- [ ] Anything you specifically do NOT want in the article?

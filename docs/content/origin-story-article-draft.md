# Story of building Air Jam

_Notes from rebuilding the phone-as-controller arcade as an open-source, AI-native framework — and what the rebuild taught me about where this category is going._

---

A few years ago I got into AirConsole — the website where your friends scan a QR code and their phones turn into game controllers. We played it almost every week with friends for about a year. Then the library stopped growing, a couple of the games we loved got removed, and we drifted away.

The platform wasn't bad. The problem was upstream of the platform: nobody was making new games for it. I tried to be one of those people, bounced off the SDK, didn't ship, and shelved the idea. A year or two later the LLMs got good enough that the bigger version of the project — building the whole stack — stopped being unrealistic.

This post is about what I learned trying to actually do that. The personal arc is in there because it produced the design decisions, but the parts I think are actually worth a developer's time are the design decisions themselves.

## The bottleneck wasn't demand. It was cost.

The thing that's easy to miss about a stagnating game library is that the missing supply isn't usually a demand problem. We _wanted_ to play more AirConsole games. So did everybody I introduced it to. The problem was that for an indie developer, building a polished multiplayer phone-controller game and shipping it through someone else's platform didn't pencil out. Painful SDK, modest audience, friction-heavy publishing, no clear upside. The economics were bad, so the library shrank.

This matters because it dictates the shape of the solution. If supply is bottlenecked by cost-of-making, you don't fix it by promoting the platform harder or improving discovery. You fix it by collapsing the cost of making a good game by an order of magnitude. Anything that doesn't attack that number isn't really attacking the problem.

I think that's true for a lot more than party games — most stagnant software ecosystems I look at now I read as "the cost of producing a good thing here is too high, and the demand has been there the whole time."

## I tried to make one game. The friction told me what to build.

Around when ChatGPT 3.5 came out I made a top-down tank battle in Unity to ship on AirConsole. It was also somehow my first real Unity project, a combination I'd recommend to no one. Building it was painful in ways that didn't feel proportional to what I was trying to do. The SDK was clearly written for a JS-first web that had moved on. Documentation was thin. I got the game running, we played it on the couch with our actual phones, which was the fun part. I never published it. The publishing flow was annoying enough that after burning my motivation getting the game to run I just didn't bother. The game still exists in a folder somewhere.

The useful thing the experience did was clarify the shape of the problem. There are two problems in any phone-controller multiplayer game. One is _the infrastructure_: WebSockets, rooms, input synchronization, latching button presses so they don't get lost between network ticks and game frames, host-authoritative state replication, reconnect logic. This is genuinely hard, full of subtle edge cases, and it's the same problem in every game. The other is _the actual game_: rules, art, controller layout, the part that makes a moment funny.

The first one is exactly the kind of thing you don't want anyone — human or LLM — solving from scratch every time. The second is exactly the kind of thing you _do_ want LLMs helping with, because it's creative and iterative and the failure modes are visible.

The framework's job, then, is to absorb the first problem so completely that
nobody — least of all an agent — has to think about it again. Air Jam is
mostly an attempt to do that, and to do it in a way that makes the same runtime
legible to humans and agents both.

## What LLMs change.

In 2023 I wrote off "build the whole platform myself" as unrealistic. Real-time multiplayer infrastructure plus a hosted arcade plus the games to run on it isn't a weekend project for one person. By 2024–25 that stopped being true.

LLMs are capable of writing pretty much any of this if you steer them well. Multiplayer infrastructure included. The catch is that good steering takes real time and attention, and you don't want to be doing it from scratch every time someone wants to build a new game. That's the whole point of a framework — do the steering work once, shape the substrate carefully, and then everything built on top is fast for humans and agents both.

So the practical effect of LLMs getting better isn't "now anyone can build a
multiplayer game from nothing." It's "now one person plus an agent can do the
careful substrate work that used to need a small team — and once that substrate
exists, the cost of making any individual game on top of it collapses."

Air Jam is mostly an attempt to do that careful substrate work, well, once, in
an openly inspectable way that future agents can keep building on.

## The arcade is the product, not the SDK.

The first version of Air Jam I built leaned on a "developers host their own games anywhere" model. Build a game, deploy it on Vercel or Netlify, point it at a central server with an API key. That path still works — it's the answer to "why does the platform have API keys" for the four people who will ever ask.

It also wasn't really the dream. The thing AirConsole did best wasn't its SDK. It was the arcade itself: one room, one QR code, all the games sitting there. You don't pick a game and load a controller — you join a room and the games come to you.

That's not a nice-to-have feature, that's the thing the product is. If joining a game takes thirty seconds instead of five, the moment passes — people drift back to their phones, the friend who suggested it gives up, and you don't play that night. AirConsole's instant join is what makes party games happen at all. Everything underneath it is just plumbing to support that.

The shape of Air Jam followed from this. The arcade isn't a feature on top of the SDK; it's the product. The SDK exists to make the arcade fillable.

## Design for agents before humans.

About a year into building, I rewrote a large fraction of the framework. The PR touched roughly 1,500 files, the kind of diff you don't show on stage. I'm not proud of it the way you'd be proud of a clever feature, but it's the most honest summary of two months of work I have.

The thing that drove the rewrite was a specific realization. I'd been building Air Jam as "an open-source AirConsole alternative." Cleaner SDK, modern stack, open source. Useful, but ultimately a 2014-shaped project with 2024 tooling. The actual interesting project was different: a phone-controller multiplayer framework designed _for the era we're actually in_, where most of the code is being written with an LLM in the loop, and where the difference between a successful framework and a dead one is whether an agent can hold the whole mental model in its head.

The closest comparison I have is "Next.js for party games." A scaffold that gets you a working game on your phone in one command. A folder structure that doesn't fall apart as you keep building. Clear contracts between the host and the controller, between the game and the framework, between you and the agent helping you. The kind of one-shot prototype that can grow into a real game without rotting.

The principle that came out of the rewrite, and that I now apply pretty aggressively: any shortcut that makes the human UI work today while hiding the real contract from a future agent is a debt you'll pay later. Hidden state, magic singletons, side effects that can only be reasoned about by someone who's been in the codebase for months — all of that is fine until the agent shows up and now it's load-bearing technical debt.

If you're building anything you expect agents to operate on at scale, design for them first. The human-readable surface tends to fall out cleanly. The reverse rarely does.

## Build backwards from the chat interface.

Air Jam will eventually have a dedicated studio — a web UI for creating games with prefab previews, controller layout tools, asset pipelines, all of it. That's deliberately not the next thing I'm building.

The reasoning is mostly economic. Claude Code, Codex, and friends are already a usable studio for this work. They're free or near-free, they have previews built in, they handle the iteration loop, and they get better every month at no cost to me. Rolling my own UI in front of all of that, before the substrate is even fully stable, is choosing the wrong leverage.

Better path: get the framework, the contracts, the agent ergonomics, and the deployment story right first. Make the existing chat-based tools great at building Air Jam games. The dedicated studio gets built once it's clear what it actually needs to do, and once the substrate underneath has stopped moving.

I think this generalizes. If you're building for a paradigm whose UX hasn't settled yet — and AI-assisted development has _absolutely_ not settled — the temptation is to ship your own UI early so people see your name on the surface. The cheaper, slower-to-pay-off play is to make your work great inside whatever interface the user is already in.

## The recursive bet.

The shape of the whole project is recursive on purpose. The framework creates the games. The games run on the framework. Agents extend both. The platform is built using the same contracts that the games are. The longer-term version is an agent cluster that keeps the framework, the platform, and the games evolving largely on its own — fixing bugs, shipping new games, maintaining the arcade.

I'm aware of how that sounds. I don't know if we get there. But the architectural decisions are being made as if we will, because the alternative is making them as if we won't, and that's how you end up with a framework that has to be rewritten in eighteen months.

The bet underneath all of this, stated plainly: this category isn't going to be won by whoever ships the best games. It's going to be won by whoever builds the substrate that makes good party games trivial to make — and that substrate has to be designed for agents from day one.

## What it feels like when it works.

I'll mention one moment, briefly, because it's the closest thing I have to evidence the bet is real.

We ran a game jam at zerodays — the agency I work at. Nine of us, three teams, seven hours. Everyone chose Air Jam, which was as much a function of the format as anything I did. By the end of the day there were three completely different, actually-fun games: a pixel-art boxing game where players accidentally invented a corner-and-bounce mechanic, a music quiz with eighty tracks ranging from Bohemian Rhapsody to Slovenian turbo-folk, and an Overcooked-style office sim with our coworkers' real photos as avatars where you could die of boredom.

The thing that was genuinely surprising — more than the games themselves — was the shift in tone around AI in the office. A lot of the people there had been cautious about AI before that day. The jam didn't argue with any of those concerns; it just put AI in a different context. Nobody was using it to ship faster or replace anything. They were using it to make something funny and personal that we then played together. The mood shifted a few degrees and stayed shifted.

The dedicated post about the jam is [here](./framework-launch-article-draft.md), with the actual game writeups. All three of those games are now shipped as templates in the framework, alongside Pong, Air Capture, and a minimal starter — six in total, which means anyone running `npx create-airjam` today scaffolds from one of them and is playing on their phone in under a minute.

The point I'd make in this article is narrower: when the substrate is shaped right, the human creative energy goes entirely into the game design. People don't think about WebSockets or input pipelines, because they don't have to. That's the thing I want to be true about more software, party games being a small and pleasant proof of concept.

## Where it stands.

Air Jam is open source and heading toward its first public release. The arcade is live at [airjam.io](https://airjam.io) — you can scan the QR code and play the six template games right now. The framework, server, SDK, and platform live in the monorepo at [github.com/vucinatim/air-jam](https://github.com/vucinatim/air-jam). The fastest way to build a game on top of it is `npx create-airjam <game-name>`, which scaffolds from one of the templates and gives you a working room you can join from your phone in about a minute.

If you're building anything in the AI-native developer-tools direction, I'd be curious what you make of the agent contracts and the runtime topology model — those two decisions ate a lot of time and I don't think the right answers there are settled in the industry yet.

If you build something with it, send it over. If you run a jam, send the screenshots.

> _[Media plan — Claude Code demo video at the "What LLMs change" section, GitHub diff stat at the 1,500-file rewrite, three jam game thumbnails at the "What it feels like when it works" section, recursive-loop diagram at the recursive-bet section, arcade screenshot or QR at the closing.]_

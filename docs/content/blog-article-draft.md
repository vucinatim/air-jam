# What If Every Phone in the Room Was a Game Controller?

_Building an open-source framework for the age of vibe-coded party games._

---

Every phone in your pocket has a gyroscope, a touchscreen, speakers, a vibration motor, and a browser. That's a game controller. A pretty good one, actually -- and every person in the room already has one.

That thought is the entire premise behind Air Jam: an open-source framework for building multiplayer games where a computer or TV runs the game, and players join instantly from their phones by scanning a QR code. No app downloads. No Bluetooth pairing. No account creation. You scan, you play.

I built it because I wanted to see what happens when you remove every barrier between "I have a game idea" and "we're all playing it together in the same room." Especially now, when AI can write most of the code for you.

<!-- [VISUAL: Architecture diagram -- Host screen <-> Server <-> Phone controllers] -->

## Why Build This?

The concept isn't new. AirConsole proved years ago that phones-as-controllers work beautifully for party games. But AirConsole is a closed commercial platform -- you build games for _their_ ecosystem, on _their_ terms.

I wanted the open-source version. Something anyone could use, extend, and deploy anywhere. But more than that, I wanted it designed for a specific moment in time: the one we're living in right now, where developers are increasingly working alongside LLMs to write code.

Here's the thing about making a multiplayer game that uses phones as controllers -- there are really two problems:

1. **The infrastructure.** WebSocket connections, room management, input synchronization, state replication across devices, handling disconnections and reconnections, latching inputs so button presses aren't lost between network ticks and game frames. This is genuinely hard to get right, and it's the same problem no matter what game you're building.

2. **The actual game.** The creative part. The rules, the visuals, the controller layout, the thing that makes people laugh or yell or lean forward in their chairs.

Problem #1 is exactly the kind of thing you don't want an LLM figuring out from scratch every time. It's systems-level code with subtle edge cases. Problem #2 is exactly the kind of thing LLMs are great at helping with -- creative, iterative, visual, fun.

So Air Jam solves #1 completely. The networking, the rooms, the input pipeline, the state sync -- it's all handled. You bring the game. And if you're working with an AI assistant, it can focus entirely on the part that matters: making something people want to play.

## How It Works

The setup is simple. A game is a React app with two views: one for the host screen (the computer/TV running the game) and one for the controller (the phone). You define what data the controller sends to the host with a Zod schema, wrap your app in a provider, and you're done with the networking.

Here's the input schema from Pong -- the starter template that ships with the framework:

```ts
import { z } from "zod";

export const gameInputSchema = z.object({
  direction: z.number().min(-1).max(1),
  action: z.boolean(),
});
```

That's it. A paddle direction and a button. The schema is the contract between the phone and the game.

The app itself is a provider wrapping two routes:

```tsx
<AirJamProvider
  serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
  input={{
    schema: gameInputSchema,
    latch: { booleanFields: ["action"] },
  }}
>
  <Routes>
    <Route path="/" element={<HostView />} />
    <Route path="/controller" element={<ControllerView />} />
  </Routes>
</AirJamProvider>
```

On the host side, you call `useAirJamHost()` and you get a list of connected players and a `getInput()` function that returns the latest validated input from any controller. On the controller side, you use `useControllerTick()` with `useInputWriter()` to publish input snapshots. That's the entire networking API for basic games.

When you need shared state -- scores, team assignments, game phases -- there's `createAirJamStore`. It works exactly like Zustand (because it _is_ Zustand under the hood), but the store automatically syncs between all devices. The host is always the source of truth. When a controller calls an action, it's transparently sent as an RPC to the host, executed there, and the result broadcasts back to everyone.

```ts
export const usePongStore = createAirJamStore<PongState>((set) => ({
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},
  actions: {
    joinTeam: (team, playerId) => {
      if (!playerId) return;
      set((state) => {
        // ... assign player to team
      });
    },
    scorePoint: (team) =>
      set((state) => ({
        scores: { ...state.scores, [team]: state.scores[team] + 1 },
      })),
  },
}));
```

Both the host and the controller import this same hook. The host mutates state directly. The controller's calls get proxied over the network. You don't write any networking code -- it just works.

This is the thing that makes vibe-coding these games practical. An LLM doesn't need to understand WebSocket protocols or message serialization. It just writes a Zustand store. The framework handles the rest.

## The Decisions That Make It Work

A few design choices that turned out to matter a lot:

### Input Latching

This one is subtle but important. Game loops typically run at 60 frames per second. Network events from phones arrive whenever they arrive -- asynchronously, on their own schedule. A quick button tap might arrive, get written to the input buffer, and then get cleared by the next network tick before the game loop ever reads it. From the player's perspective: "I pressed the button and nothing happened."

Air Jam's input system solves this with latching. When a boolean field (like a button press) goes `true`, the latched value stays `true` until the game loop explicitly reads it via `getInput()`. That read consumes the latch and resets it. No tap is ever lost, no matter how the timing lines up between the network and the game loop.

For continuous inputs like joysticks, there's a similar mechanism: a non-zero vector is held for one additional frame after the phone sends a zero, catching quick flick gestures that would otherwise be missed.

You configure it declaratively -- just list which fields should be latched:

```ts
latch: {
  booleanFields: ["action", "ability"],
  vectorFields: ["movement"],
}
```

It's a small thing, but it's the difference between a game that feels responsive and one that feels broken.

<!-- [VISUAL: Optional diagram -- timeline showing raw input vs. latched input] -->

### Transparent State Sync

I mentioned `createAirJamStore` above, but it's worth emphasizing what it actually does under the hood. On the host, the store behaves like a normal Zustand store. On controllers, every action call is intercepted and turned into an RPC message sent to the host via the WebSocket server. The host executes the action (it's the single source of truth), and the resulting state change is broadcast to all controllers.

This means you get a host-authoritative multiplayer architecture -- the kind that prevents cheating and keeps state consistent -- without writing any networking code. The API is identical to regular Zustand. If you know how to write a React state hook, you know how to build multiplayer game state with Air Jam.

### Headless by Default

The SDK is now intentionally headless. Runtime behavior lives in hooks and session providers (`useAirJamHost`, `useAirJamController`, `HostSessionProvider`, `ControllerSessionProvider`), and your app owns the UI completely.

That gives one unambiguous architecture: the framework handles networking, room lifecycle, input latching, and state sync; your game handles layout, controls, and visual design.

## What People Built With It

To test whether any of this actually works in practice, we ran a game jam at zerodays -- the software dev agency where I work. Nine developers, three teams, seven hours. Everyone used AI assistants -- Claude, Codex, Kimi, Cursor -- in whatever dev environment they preferred. The only rule: build a game with Air Jam.

What came out was three completely different games. A fighting game, a music quiz, and a cooperative office sim. All built with the same SDK, all using phones as controllers, all playable by the end of the day.

<!-- [VISUAL: Three game screenshots side by side] -->

### "Code Review" -- A Boxing Game

The name is a developer in-joke. It's a top-down pixel-art boxing game where the two teams are the **Coders** and the **Reviewers**. You tilt your phone to move your fighter around the ring (gyroscope input), and your phone's screen shows punch and defend buttons.

The combat has a nice layer to it: blocking halves incoming damage, but if you get hit while blocking, your next punch does double damage with a golden glow effect. During playtesting, people discovered that if two players cornered a third, they could bounce them back and forth with punches -- a completely unintended mechanic that immediately became everyone's favorite strategy.

What's interesting from a framework perspective: this game uses the phone's gyroscope for movement and touch buttons for actions, all flowing through the same input schema. The latching system ensures rapid punches never get dropped.

### "Last Band Standing" -- A Music Quiz

A Kahoot-style music trivia game. A YouTube video plays on the host screen, but the video is blurred -- you can hear the song but can't see the music video. Players race to identify either the song or the artist from four options on their phones. Faster correct answers score more points.

The song bank is over 80 tracks deep, ranging from Bohemian Rhapsody to Rick Roll to Slovenian turbo-folk -- which got some of the biggest laughs when they came up. There's a streak system where the top-scoring player gets a fire animation on their avatar.

This game shows the framework working for something completely different from real-time action. The controller is just four answer buttons. The game is round-based, not continuous. The same SDK that handles gyroscope-driven boxing handles a quiz show.

### "The Office" -- A Cooperative Office Sim

This one was my favorite. It's basically Overcooked, but set in a tech office -- specifically, _our_ tech office. You move characters around an office layout completing tasks to earn money, managing your energy and happiness stats to stay alive.

The characters are real members of the zerodays team, with their actual photos as avatars and custom skill profiles. The PM is rated 5/5 at meetings and 1/5 at coding. The developers are the opposite. Tasks include "Vibe Coding" (400 EUR), "Fix the internet" (250 EUR), and "Clean the coffee machine" (0 EUR -- because of course that pays nothing). The entire game is in Slovenian, right down to the death notifications.

And yes, you can literally die of boredom if you don't play enough FIFA on the in-game PlayStation. The happiness meter drains randomly and the only cure is a break.

The game was built by two developers, with our non-developer colleague writing all the character profiles and skill ratings. The framework handled the networking and input -- they just focused on making something funny and personal.

<!-- [VISUAL: The Office character profiles / controller with DELAJ button] -->

### The Point

Three genres. A fighting game with gyroscope movement, a quiz show with simple buttons, and a cooperative sim with a D-pad. All built in one day with the same framework by teams that had never used it before. The controllers look completely different, the game logic is completely different, but the underlying infrastructure is the same.

That's what I was building toward. Not a framework that makes one kind of game. A framework that handles the parts that are always the same -- the networking, the rooms, the input pipeline, the state sync -- and gets out of the way for the parts that should be different every time.

## What I Took Away From All of This

The thing that surprised me most wasn't the technical stuff. The framework worked about as well as I'd hoped -- the input latching was invisible (which is the point), and the state sync held up.

What surprised me was how _personal_ the games became. When the framework handles all the infrastructure, the creative energy goes entirely into game design. That's how you end up with your coworkers' faces as game characters and "death by boredom" as a mechanic. People weren't thinking about WebSockets. They were thinking about what would be funny, what would make a good moment when everyone plays together.

That's the part I want to emphasize, because I think it matters beyond this specific project. There's a lot of conversation right now about AI-assisted development -- what it enables, what it threatens, where it's going. Most of that conversation is abstract. This was concrete: people in a room, building things that only exist to be played together, in person, with friends. The AI helped write the code. The humans decided what the code should do. And then they played it together and laughed.

That's a pretty good use of the technology.

## Try It

Air Jam is fully open-source and free to use.

**Start a new game in one command:**

```bash
npx create-airjam my-game
```

This scaffolds a working Pong game with a local development server, the SDK, and documentation -- including instructions optimized for AI coding assistants. Run `pnpm run dev`, scan the QR code with your phone, and you're playing in under a minute.

**Deploy anywhere.** The free public server at `api.air-jam.app` means you can host your game on Vercel, Netlify, or anywhere that serves a static site. Sign up at [air-jam.app](https://air-jam.app), register your game in the dashboard, and you get an app ID automatically.

**Play the game jam games.** All three games from our jam -- Code Review, Last Band Standing, and The Office -- are available in the [Air Jam Arcade](https://air-jam.app/arcade). One room, one QR code, all the games.

**Links:**

- [GitHub](https://github.com/vucinatim/air-jam) -- source code, issues, discussions
- [Documentation](https://air-jam.app/docs) -- guides, architecture, SDK reference
- [Platform](https://air-jam.app) -- sign up, register games, get app IDs
- [Arcade](https://air-jam.app/arcade) -- play published games
- npm: [`@air-jam/sdk`](https://www.npmjs.com/package/@air-jam/sdk) / [`@air-jam/server`](https://www.npmjs.com/package/@air-jam/server) / [`create-airjam`](https://www.npmjs.com/package/create-airjam)

If you build something with it, I'd genuinely love to see it. And if you run your own game jam -- send me the screenshots.

# Origin / Vision Article — Plan

Companion to [framework-launch-article-draft.md](../content/framework-launch-article-draft.md) (the game jam + framework intro post). This one is the **origin / vision** post that comes _first_ — the personal arc and the thesis. The jam post follows ~1–2 weeks later as the "receipts."

---

## The shape

Two climaxes, not one. **Emotional climax** at the game jam (the heart). **Intellectual climax** at the recursive-vision thesis (the head). The article moves heart → head → back to heart. That's what keeps readers from bailing at the "vision" section, which is where these posts usually die.

```
warmth ──┐                          ┌── jam ──┐                        ┌── close
         │                          │         │                        │
discovery│                          │         │   pivot                │
         │                          │         │   ┌──── recursive ────┘
         │   slow fade              │         │   │     thesis
         │      ↓                   │         └───┘
         │      grief    ┌── tank ──┘
         │       ↓       │   ↓
         └───────────────┘   long wait → LLMs catch up
```

Two emotional valleys (slow fade, long wait) so the peaks land. No section over-stays. The vision section is _fenced in_ by warmth on both sides so it doesn't read as a pitch.

---

## Section-by-section

### 1. The couch _(~220 words, warm/intimate)_

Open in scene. Friends. No console. Mobile games are trash. ChatGPT recommends AirConsole. The discovery feeling — that "hidden gem" thing. Bought the sub immediately. A year of weekly play. Introduced everyone.

- **Media:** none. Let prose carry it.
- **Exit:** "for about a year, this was our thing."

### 2. The slow fade _(~180 words, quiet grief)_

Library never grew. Same 2–3 games on repeat. Music Gems got removed (name it, name the loss). I canceled. Save the ghost-town Discord callback for the closing — don't spend it here.

- **Media:** maybe one faded AirConsole screenshot, or skip entirely. Restraint here makes the next section hit harder.
- **Exit:** "if we wanted to keep playing, someone had to make new games."

### 3. I'll just make one _(~250 words, try / bounce / bigger question)_

Unity tank battle. ChatGPT 3.5 era. Painful build. Played it with friends once. Never published — SDK was JS-era, publishing was friction, the economics didn't pencil for an indie. _That's the diagnosis_: the bottleneck wasn't demand, it was cost-of-making. Then the bigger idea: what if I just built the whole platform? But — unachievable in that era.

- **Media:** Unity tank clip if available, otherwise skip.
- **Exit:** "so I let it sit."

### 4. One or two years pass _(~120 words, short on purpose, held breath)_

This section should feel like a _pause_. LLMs go from gimmick to capable. The unachievable part stops being unachievable.

- **Media beat — this is the spot for the Claude Code landing-page demo video.** It's literally "what it looks like now." Frame it as: _this is the thing that didn't exist when I tried the first time._
- **Exit:** hard cut to building.

### 5. Building toward the arcade _(~280 words, rising momentum)_

First version: SDK works, iframe deployable, BYO-hosting model (mention this is _why_ API keys exist — small lore detail readers love). But that wasn't the dream. AirConsole's superpower was the arcade itself: one room, all the games, zero friction. So I started building toward that.

- **No code snippets.** That's the jam post's job. Keep it conceptual.
- **Media:** small architecture sketch — host / server / controllers — only if it earns its place.
- **Exit:** "and then we ran a game jam."

### 6. The game jam _(~320 words, EMOTIONAL CLIMAX)_

Internal jam at zerodays. Nine of us, three teams, seven hours. Everyone chose Air Jam _unprompted_ — flag this, it matters. Three completely different games played together in the room at the end. The thing this paragraph must do: capture the **atmosphere shift**. People who'd been cautious about AI seeing it being used for _joy_, in person, with their friends. Not productivity. Not replacement-anxiety. Just laughter.

One-line nod to each of the three games with the punchiest detail each — coworkers' faces as avatars, Slovenian turbo-folk, cornering opponents. **Then a clean link out to the jam post for the full story.** Resist retelling.

- **Media:** photo from the room if available. Three small game thumbnails. Link card to the dedicated post.
- **Exit:** "I'd set myself a deadline to write this. I missed it by two months."

### 7. The 1,500-file pivot _(~250 words, well-here-we-go energy)_

That two months: I decided this isn't an AirConsole alternative, it's something else. **Next.js for phone-controller games. AI-native from the floor up.** The pitch in one paragraph: one-shot prototypes that don't collapse into spaghetti when you keep building. Folder structure, contracts, agent surfaces — all of it shaped so a game can grow without rotting. The 1,500-file PR is the punchline / receipt.

- **Media:** screenshot of the GitHub diff stat — "1,500 files changed" is iconic. Funniest visual in the post.
- **Exit:** _but here's why I actually think this matters._

### 8. The recursive bet _(~340 words, INTELLECTUAL CLIMAX)_

Now state the thesis plain:

- Nobody was making AirConsole games because the cost-of-making didn't pencil for indies. _That stayed true for fifteen years._
- LLMs collapsed that floor.
- The category isn't won by best games — it's won by the substrate that makes them trivial to create.
- That substrate has to be designed for agents from day one, not retrofitted.

Then the studio note: we're building _backwards from the chat interface_. Claude Code and Codex are already the studio — free, with previews built in. Build the substrate; the dedicated UI catches up later.

Then the recursive shape: framework creates the games, games run on the framework, agents extend both. Mention the dream — an agent cluster that keeps the whole thing alive — and _immediately_ qualify: "I have no idea if we get there. Every architectural decision is made as if we will." That qualifier is what stops it sounding like overreach.

- **Media:** custom diagram component — a simple three-layer recursive loop (framework ↔ games ↔ agents). If we do one custom graphic, do it here.
- **Exit:** soft turn back to warmth.

### 9. The room is still empty _(~160 words, release)_

Bring back the AirConsole Discord — gently, not mean. The thing I fell in love with stalled. That's why this exists. Closed release coming. Open source. If you build something, send it to me. _And if you run your own jam — send the screenshots._ (Echoes the jam post's closing line; small detail that makes the two posts feel like they belong together.)

- **Media:** arcade screenshot or QR code. Final exhale.

---

## Title options

- **"I missed playing games with my friends"** _(intimate, leads with feeling)_
- **"The framework I started building when Music Gems got deleted"** _(specific, intriguing, slightly wry)_
- **"Phones, friends, and a fifteen-year bottleneck"** _(thesis-forward)_
- **"What I wanted from AirConsole, and what I'm building instead"** _(direct)_

**Recommendation:** #1 or #2. The thesis title is too clever; the descriptive one is too dry. Lead with feeling; let the thesis land in section 8.

---

## Voice & scope rules

- **First-person throughout.** Past tense for the story, present tense when the thesis takes over in section 8.
- **No feature lists. No code snippets. No install instructions.** All of that is the jam post's territory. If a sentence could appear in the jam post, cut it from this one.
- **Specific names matter.** Music Gems. ChatGPT 3.5. zerodays. Claude Code. The three games. Specifics make it real.
- **Short sentences in the high-emotion sections** (couch, slow fade, jam, closing). Let them breathe.
- **Self-deprecation is welcome.** The missed deadline. The "1,500-file, just a funny PR." Slight underselling on the recursive vision (the "I have no idea if we get there" qualifier). Underselling makes ambition land harder.
- **No "tech blog English."** Nothing starts with "Today I'm excited to share." Nothing ends with "Stay tuned."

---

## Media inventory

| Section | Asset                                       | Status              |
| ------- | ------------------------------------------- | ------------------- |
| 4       | Claude Code demo video (landing page one)   | Have                |
| 5       | Optional architecture sketch                | Optional            |
| 6       | Room photo from jam                         | Need to confirm     |
| 6       | 3 game thumbnails                           | Have                |
| 7       | GitHub 1,500-file diff screenshot           | Easy capture        |
| 8       | Custom recursive-loop diagram               | **Needs design**    |
| 9       | Arcade screenshot / QR                      | Have                |

The recursive diagram in section 8 is the only thing that needs real design work. Worth doing — it's the visual hook for the most-shared paragraph.

---

## Open questions before drafting

1. **Title direction** — #1, #2, or something else?
2. **Room photo from the jam** — exists?
3. **Recursive diagram** — sketch a rough ASCII version first to iterate on the _idea_ before building the real component?
4. **Publish order** — origin first, jam second, ~1–2 weeks apart? (Strong recommendation.)

Draft plan once approved: sections 1–4 first as a voice check, then commit to the rest.

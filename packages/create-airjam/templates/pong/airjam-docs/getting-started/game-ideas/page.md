# Game Ideas for Air Jam

A collection of game concepts that leverage Air Jam's unique architecture: **High-Frequency Input Streams** (Socket.IO) + **Reliable Shared State** (AirJam Store).

---

## Tier 1: Arcade Classics (Easy)

### Neon Tanks

- Top-down arena shooter (4-8 players)
- Dual stick controls: movement + turret aiming
- Tap to fire
- **Key Feature:** Demonstrates dual stick capability on touchscreen

### Super Sumo Balls

- Rolling balls on tilting platform
- Use phone gyroscope/accelerometer to tilt
- Haptic feedback on collisions
- **Key Feature:** Phone sensors + haptic signals

---

## Tier 2: Party & Social Games (Medium)

### The Traitor (Among Us style)

- 8 players: 6 crew, 2 traitors
- Hidden roles shown only on phone
- Task minigames on controller
- Voting UI on phone
- **Key Feature:** Secret information per player (killer app for phone controllers)

### Sketchy Business (Pictionary style)

- Draw prompts on phone canvas
- Drawings appear on TV
- **Key Feature:** Touchscreen as natural drawing pad

### Quiz Show Royale

- Fastest finger first trivia
- Personalized feedback (green/red + vibration)
- **Key Feature:** Input timestamping for speed

---

## Tier 3: Co-op Chaos (Medium-Hard)

### Starship Bridge Simulator

- 4 players with different roles
- Each player gets different UI on phone
- Asymmetrical gameplay
- **Key Feature:** Different React components per controller

### Ghost Hunter

- 1 vs 3 asymmetrical gameplay
- Ghost sees minimap on phone only
- Hunters use joysticks on TV
- **Key Feature:** Private screen advantage

---

## Tier 4: Strategy & Card Games (Hard)

### Poker Night / Blackjack

- Private cards on phone
- Betting UI on phone
- Public table on TV
- **Key Feature:** Hidden information per player

### Artillery Wars (Worms style)

- Turn-based tank battle
- Aiming interface on phone (angle/power sliders)
- Weapon selection on phone
- **Key Feature:** Complex menus on touchscreen

---

## Tier 5: Experimental (Advanced)

### The Crowd Pixel (r/place style)

- 50+ players
- Each controls a pixel/cursor
- Collaborative painting
- **Key Feature:** Tests scalability

### Minority Report UI

- Phone as trackpad
- Gesture controls
- **Key Feature:** Phone as input device

---

## Key Mechanics Enabled

```
| Mechanic          | Example           | Technical Feature                       |
|-------------------|-------------------|-----------------------------------------|
| Secret Roles      | Mafia / Traitor   | `useSharedState` (filter by `playerId`) |
| Private Inventory | RPG / Poker       | Shared Store + React UI on Phone        |
| Motion Steering   | Racing / Rolling  | Device Accelerometer → Input Stream     |
| Fastest Finger    | Quiz Show         | Input Latching (Timestamps)             |
| Physical Feedback | Fighting / Action | `host.sendSignal("HAPTIC")`             |
| Drawing           | Pictionary        | Canvas API + Data Packet                |
| Asymmetry         | Ghost Hunter      | Different Views per Role                |
```
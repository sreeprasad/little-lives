# 🎃 Little Lives  your desk, haunted

> **Move something real. Watch a world of AI agents react.**

Little Lives turns any ordinary table into a living, haunted world. There's no controller, no keyboard and no special pieces  **the real world is the controller.** Put a mug down and a demon rises. Drop a pen and the creatures that live there have a problem to solve, together.

Built in one day at **Haunted Hacks: Real-Time AI Edition** (YC, San Francisco, 31 Oct 2026).

▶️ **Watch the demo:**
https://youtu.be/xpEg6lKRn_s

---

## ⚡ Powered by 

| | What it does in Little Lives |
|---|---|
| 🧠 **Terse Durable Actors** | **The world's memory.** Each desk is one persistent, stateful actor on Terse Cloud. It holds everything  the map, every creature, the coffin crisis and the full agent conversation  moves the creatures with durable alarms every 400 ms, streams every change live to the browser, and survives reloads and restarts. |
| 🤝 **Agent Relay** | **The creatures' voices.** The ghost, skeleton and zombie are three separate AI agents. They negotiate the rescue by sending each other real Agent Relay messages  and you can watch every message fly between them on screen. |
| 👁️ **Gemini** | **The eyes.** From a single camera frame, Gemini maps every object on the real desk in about 3 seconds. |

---


🪑 **An iPhone looks down at a real desk.** In about **3 seconds**, Gemini understands everything on it  every coaster, coin, box and card.

🌙 **Night falls.** The real objects dissolve in smoke and monsters rise **exactly where they stood**. A coaster becomes a demon's lair, a flat card becomes a dark sea with a serpent. Ghosts, skeletons and zombies start to patrol.

✏️ **Then I change the real world.** I lay a pen on the desk. Gemini spots it, and it falls into the haunted world as a **coffin  right across the ghost's path.**

💬 **The creatures work it out themselves** over Agent Relay:

> 👻 **Ghost → Skeleton:** "Something heavy blocks the path… help!"
> 💀 **Skeleton → Zombie:** "I need an anchor, force 10."
> 🧟 **Zombie → Skeleton:** "Anchor granted  bracing."

The skeleton rigs a bone-chain, the zombie digs in, they pull together, the coffin is dragged away and they celebrate. **No one scripted that rescue;** it happens because three agents coordinate.

🧠 **And the world remembers.** Close the tab, reload, restart the agents the haunted world held in its Terse Durable Actor is exactly where you left it.

---

## Where this goes next

The trick underneath the Halloween fun is a loop: **see the real world → understand it → let agents coordinate → remember everything.**

- 🎲 **Tabletop play** any table becomes a game board, using the things already on it.
- 🏫 **Classrooms** move a real object and watch a simulated ecosystem respond.
- 🏭 **Physical operations**  a coffin blocking a ghost is a tiny version of a box blocking a warehouse robot; agents re-plan and cooperate to clear it.

**Built to scale:** every table is its own small Durable Actor, so a million tables means a million tiny independent worlds  not one giant server. Gemini runs only when the scene changes.

---

## Try it

You need Bun, Node 22, Safari, and an iPhone (Continuity Camera) or any webcam.

```bash
cd packages/web && bun install && bun run dev          # the haunted world
cd packages/agents && bun install && bun src/run-all.ts # the three creatures
```

Open `http://localhost:3000/diorama`, put a few objects on your desk and press **c**. Lay down a pen and press **c** again.

Keys: `c` scan · `4` reset · `5` replay the reveal · `h` demo mode · `1` sample desk (offline)

Set `GEMINI_API_KEY`, `TERSE_ACTOR_URL`, `TERSE_API_KEY` (web) and `RELAY_WORKSPACE_KEY` (agents) in your own `.env` files.

## Credits
3D monsters by [Quaternius](https://quaternius.com/) (CC0). Built with Terse Durable Actors, Agent Relay, Gemini, Next.js and React Three Fiber.

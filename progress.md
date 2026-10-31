# Little Lives — Progress & Pending

Haunted Hacks project. An overhead iPhone camera watches a real desk; Gemini detects the objects; the desk turns into a haunted 3D miniature world where monsters live. Dropping a "coffin" on the ghost's path starts a crisis that three creature agents solve by talking over **Agent Relay**, with all world state held in a **Terse Durable Actor**.

**Prizes in play**
- Overall winner: guaranteed YC interview
- Stateful Apps — Terse Durable Actors (iPhone)
- Agent-to-agent communication — Agent Relay (Mac mini)
- Costume contest

_Last updated: Fri 30 Oct 2026_

---

## How to run (3 terminal tabs)

```bash
# Tab 1 — world actor (Terse Durable Actors)
cd /Users/arganoil/src/little-lives/packages/actors && npx durable-actors dev

# Tab 2 — web app (Next.js)
cd /Users/arganoil/src/little-lives/packages/web && bun run dev

# Tab 3 — creature agents (Agent Relay)
cd /Users/arganoil/src/little-lives/packages/agents && bun src/run-all.ts
```

Open **Safari** at `http://localhost:3000/diorama`. iPhone plugged in by cable, locked, landscape, rear camera pointing straight down at the desk.

If tab 1 says "another local runtime is already using this data directory", an old copy is still running — that's fine.

### Keyboard controls on `/diorama`

| Key | Action |
|---|---|
| `c` | Scan the desk with the live camera (Gemini) |
| `1` | Load the sample desk photo (offline backup) |
| `2` | Drop the coffin (starts the crisis) |
| `4` | Reset the world |
| `5` | Replay the reveal |
| `g` | Toggle grid |
| `p` | FPS meter |
| `t` | Toggle tilt-shift blur |

---

## Architecture

```
iPhone (Continuity Camera)
   │ getUserMedia, press c
   ▼
Browser /diorama ──JPEG──▶ /api/vision/parse ──▶ Gemini 3.5 Flash (boxes + shapes)
   │                                  │ entities (our code assigns roles)
   │                                  ▼
   │                       /api/world/scan ──▶ WorldActor.applyScan()
   │                                               │  (Terse Durable Actor "desk-1")
   │◀──────── WebSocket snapshots (every change) ──┘  grid · A* · creatures · crisis · relayLog
   │                                               ▲
   ▼                                               │ getCrisis / advanceCrisis / applyForce / logRelayPacket
React Three Fiber diorama                 packages/agents (run-all)
(reveal, monsters, coffin,                ghost ⇄ skeleton ⇄ zombie over Agent Relay Cloud DMs
 bone-chain, message orbs)
```

### Packages

| Package | Path | What it does |
|---|---|---|
| actors | `/Users/arganoil/src/little-lives/packages/actors` | `WorldActor`: persisted world, 12×12 grid, A*, 400ms creature tick via alarms, crisis state machine |
| web | `/Users/arganoil/src/little-lives/packages/web` | Next.js app: routes, Gemini vision, camera, 3D diorama, Relay wire |
| agents | `/Users/arganoil/src/little-lives/packages/agents` | Ghost / skeleton / zombie agents, Relay bus (Cloud + in-memory fallback), watchdog |

### Key files

**actors** (`/Users/arganoil/src/little-lives/packages/actors/src`)
- `actors.ts` — `WorldActor` (applyScan, dropObstacle, getCrisis, getSnapshot, advanceCrisis, applyForce, logRelayPacket, reset, onAlarm tick)
- `world.ts` — shared types, grid helpers, crisis transitions
- `pathfinding.ts` — 4-direction A*
- `world.test.ts` — 7 unit tests (`bun test`)

**web** (`/Users/arganoil/src/little-lives/packages/web`)
- `src/app/diorama/page.tsx` — main demo page, keys, camera panel, scan flow
- `src/app/debug/page.tsx` — 2D debug grid
- `src/app/api/world/socket/route.ts` — WebSocket grant
- `src/app/api/world/scan/route.ts` — scan / drop / reset
- `src/app/api/vision/parse/route.ts` — Gemini route
- `src/lib/vision.ts` — Gemini prompt, schema, role assignment, unique names, 12s timeout + fallback
- `src/lib/sample-world.ts` — sample desk entities + coffin (backup)
- `src/lib/scene.ts` — desk size / grid ↔ world coordinates
- `src/hooks/useDeskCamera.ts` — camera permission, iPhone auto-pick, capture + crop
- `src/hooks/useWorldSocket.ts` — live snapshots with reconnect
- `src/components/Diorama.tsx` — R3F canvas root
- `src/components/RelayWire.tsx` — top-right message history + bottom-centre banner
- `src/components/scene/` — `reveal.tsx`, `DeskGround.tsx` (photo + object erasing), `Atmosphere.tsx`, `Effects.tsx`, `Creature.tsx`, `Landmark.tsx` (Demon/Dragon/sea), `RescueFx.tsx` (coffin, bone-chain, dust, shake), `MessageFx.tsx` (flying message orbs)
- `public/models/` — ghost, skeleton, zombie, demon, dragon, bluedemon `.glb` (Quaternius, CC0)
- `public/samples/desk.jpg` — sample desk photo
- `scripts/vision-test.ts` — run Gemini on a photo from the terminal
- `.env.local` — `DURABLE_ACTORS_CONTROL_PLANE_URL`, `GEMINI_API_KEY`

**agents** (`/Users/arganoil/src/little-lives/packages/agents`)
- `src/run-all.ts` — starts the three agents + stall watchdog (15s)
- `src/creatures.ts` — ghost (scout), skeleton (engineer), zombie (anchor)
- `src/bus.ts` — `RelayCloudBus` (Agent Relay SDK 14.0.0), `InMemoryBus`, `onceEach` dedupe
- `src/protocol.ts` — message types
- `src/world-client.ts` — generated Terse client for `WorldActor`
- `.env` — `RELAY_WORKSPACE_KEY`, `DURABLE_ACTORS_CONTROL_PLANE_URL`

---

## Done ✅

### M1 — World actor + live socket
- `WorldActor` holds entities, creatures, grid, crisis and relay log; all `@Persisted`
- Creature movement ticks every 400ms using actor alarms
- Live WebSocket snapshots; two tabs stay in sync
- **Persistence verified**: restart the actor server and the world comes back (v253 → v608)

### M3 — 3D haunted diorama
- Real desk photo as the ground, at the photo's aspect ratio
- **Reveal**: real desk for 2s → night falls → objects vanish in smoke → monsters rise → creatures appear
- Objects painted out of the ground photo with nearby desk texture (patch cloning)
- Big monsters by role: anchor → **Demon**, standing props → **Dragon**, flat → **dark sea pool + Blue Demon**
- Animated ghost (glowing), skeleton, zombie with walk / idle / work / celebrate clips
- Moonlight, flickering pumpkins, ground fog, bats, bloom, gentle tilt-shift, vignette
- ~120 FPS on the MacBook

### M5 — Gemini vision
- `gemini-3.5-flash`, low thinking, JSON schema; ~3s per scan at 1024px
- Gemini reports shape; **our code** assigns roles (3 smallest small items → spawns, heaviest mug-like → anchor, flat → walkable, long/thin → obstacle)
- Unique spooky names enforced in code; falls back to the sample desk on any error

### M4 (part) — Live camera
- iPhone as a wired Continuity Camera; auto-selected in Safari
- `c` captures, crops to the desk shape, sends to Gemini, rebuilds the world, plays the reveal

### M2 — Agent Relay crisis
- Three Relay agents (ghost, skeleton, zombie) on **Agent Relay Cloud**; round-trip verified
- Protocol: `OBSTACLE_ASSESSMENT` → `ANCHOR_REQUEST` → `ANCHOR_GRANTED` → `applyForce`
- Crisis states: BLOCKED → ASSESSING → RIGGING → ANCHORED → PULLING (3s) → CLEARED (4s)
- Visible rescue: bone-chain (sags, then taut), coffin dragged and trembling, dust burst, scene shake, celebration jumps
- Messages visible three ways: flying orbs between creatures, big bottom banner, top-right history
- Duplicates prevented (`onceEach`); watchdog resumes a stalled crisis after agent restarts

---

## Pending ⏳ (plan for Sat 31 Oct, ~2–2.5 hours)

Do in order. Each ✂️ line is a safe stopping point.

| # | Step | Time | Notes |
|---|---|---|---|
| 1 | **Pen triggers the crisis** | 20 min | Rescan with the pen on the desk; a new long/thin object calls `dropObstacle` automatically |
| 2 | **90-second script + backup recording** | 20 min | Record the full demo early so venue problems can't sink it |
| ✂️ | _Demo-ready: recorded video + live demo_ | | |
| 3 | **Demo polish** | 20 min | Status pills (camera, actor, Relay mode, Gemini live/fallback); "Simulate snapshot" button; fix Safari pausing the camera preview |
| 4 | **Relay dashboard workspace** | 10 min | Use the workspace key from the Agent Relay dashboard so messages show in Relay's own UI |
| 5 | **Auto-scan (motion-settle)** | 30 min | Hand enters → hand leaves → 1.5s still → capture; 3s cooldown |
| ✂️ | _Strong demo_ | | |
| 6 | **Terse Cloud deploy** (stretch) | 30 min | `terse deploy`; may need `terse-sdk`. Keep local as fallback |
| 7 | **Final rehearsal + re-record** | 15 min | |

### Demo script ideas (for step 2)
- 0:00 Real desk on screen; place the kit; scan
- 0:15 Night falls; objects vanish; Demon, Dragon, sea rise; creatures appear
- 0:35 Drop the pen → coffin blocks the ghost
- 0:40 Relay messages fly between creatures; bone-chain rigged; pull; coffin cleared; celebration
- 1:05 **Persistence moment** (Terse prize): kill the actor server mid-scene, restart, world returns intact
- 1:20 Wrap: Terse Durable Actors = the world's memory; Agent Relay = the creatures' voices

---

## Known gotchas

- **Chrome doesn't list the iPhone camera** — use Safari (or relaunch Chrome after its pending update)
- **Safari pauses the camera preview** when the tab loses focus — reselect the iPhone before scanning
- **Clear clutter** from the camera frame (laptop, other phones, bottles); Gemini turns everything into the world
- Keep every object **fully inside** the frame; Gemini skips objects more than half outside
- **Relay names**: a re-run registers fresh names like `ghost-4bxo` when `ghost` is taken — expected
- Relay Cloud can take several seconds per message; the watchdog waits 15s before retrying
- After changing `WorldActor` public methods: run `bunx durable-actors generate` in **both** `packages/web` and `packages/agents`
- `durable-actors` is pinned to **0.14.0**; every `WorldActor` method must be `async` (helpers live outside the class)
- `noUncheckedIndexedAccess` is turned off in `packages/agents/tsconfig.json`
- Never commit `.env` / `.env.local` (root `.gitignore` covers both)

## Venue checklist
- Object kit: mug, notebook, swab box, inhaler, small jar, small bottle, pen
- Plain desk mat (wood-grain vinyl or brown/dark board, ~60×45 cm)
- Overhead phone mount (gooseneck or overhead tripod arm), ~50–60 cm above the desk
- USB cable for the iPhone
- Backup: key `1` sample desk · key `2` manual coffin · in-memory Relay fallback · recorded video

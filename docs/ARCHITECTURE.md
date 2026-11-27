# STAGE 1 — THE TOWER: Architecture

**One page. How the game is put together.**

## Stack
- **Three.js 0.180.0**, vendored in `vendor/` (no CDN, no bundler, no React/TS).
- Plain HTML + ES modules + import map (`index.html`). One static folder — serve it with any static server and it runs fully offline.
- **Node 24** for tests (`test/*.test.js` run with `node --test`-style plain scripts; collision code is pure JS so it runs in Node with no browser).

## Runtime flow
```
index.html (import map: three → ./vendor/three.module.min.js)
  └─ src/main.js  main()
       ├─ loadConfigs()            config/{building,floorplan,furniture,npcs,cutscenes,world}.json
       ├─ Engine                   renderer (ACES, PMREM RoomEnvironment), sun, fog, quality tiers
       ├─ AssetManager             GLTFLoader + MeshoptDecoder, loads assets/manifest.json (36 GLBs)
       ├─ buildBuilding()          floor template cloned per floor 1–9 (shared geometry/materials)
       ├─ buildFlatTemplates()     one template per flat type A/B/C, instantiated per floor/flat
       ├─ DoorSystem (InstancedMesh), Lift (state machine)
       ├─ buildStreet(), Vehicles, NPCManager
       ├─ Player                   movement + collision + 3 camera modes + interactions + lift riding
       ├─ CutscenePlayer           camera-path keyframes, skippable
       ├─ UI                       loading, HUD, mini-map, touch controls, lift panel, pause menu
       ├─ AudioAmbience            procedural WebAudio (breeze + bird chirps)
       └─ game loop                cutscene → player → doors/lift/vehicles/NPCs/fans → render
```

## Systems and their contracts
Every system exposes `init(ctx)`, `update(dt)`, `dispose()`. They talk through the
shared **EventBus** (`src/core/events.js`) — no direct cross-imports between systems.

| Folder | What lives there |
|---|---|
| `src/core/` | events, config loading + mirroring, shared materials + canvas textures, asset manager, collision (Node-testable), engine/renderer, input (keyboard + touch) |
| `src/player/` | Player: position/yaw/pitch/floor, movement, collision, camera modes, interactions, lift riding, objective |
| `src/building/` | plan.js (wall generation from room rects), flat.js (furniture templates), doors.js (InstancedMesh swing doors), lift.js (car + shaft doors + state machine) |
| `src/world/` | street.js (compound, gate, guard room, trees, wires, signs, neighbours), vehicles.js (moving traffic, left-hand, stops for the player) |
| `src/npc/` | NPCManager: animated characters, idle loops + waypoint walkers |
| `src/cutscenes/` | CutscenePlayer: keyframe camera paths (intro / lift / flat), skippable |
| `src/ui/` | UI: loading, HUD, mini-map, touch controls, lift panel, pause menu |
| `src/audio/` | AudioAmbience: procedural WebAudio |
| `src/i18n/` | strings.js: English string dictionary + `t()` (Bangla later) |

## Key design decisions
- **Data-driven:** no magic coordinates in rendering code. Room rects, doors, windows,
  furniture placements, NPCs, cutscene keyframes, and world objects all come from `config/`.
- **Flat templates:** each flat type (A, B, C) is built ONCE as a template, then cloned
  per floor (1–9) with shared geometry/materials. Per-flat variation is a seeded material
  tint (sofa/bed/curtain colours). Type C is the mirror of A.
- **Collision:** no physics engine. Per-level 2D wall boxes in a uniform grid
  (`src/core/collision.js`, `Collider2D`); circle-vs-box sliding; height from floor
  regions + stair ramp colliders (the "lap" method); the lift is a state machine.
  Collision code runs in Node so it can be unit-tested (`test/plan.test.js`,
  `test/shell.test.js`, `test/lift.test.js`).
- **Doors:** one InstancedMesh for all swing doors (hinge at x=0, per-instance matrix).
  Room/toilet doors auto-open on approach (0.4 s); main doors are manual.
- **Glass:** transparent only for the flat the player is in; all other flats' glass
  is opaque reflective tint. Only the player's floor has furniture visible.
- **Quality tiers:** low/med/high (`?quality=` or auto by screen width) — pixelRatio
  0.75/1.0/1.5, shadows only on high.
- **One Zone:** `plot01` with a Zone interface, ready for later zones (out of scope now).

## Coordinate system
1 unit = 1 m, +Y up, building centre (0,0), plan-east +X, plan-south +Z (towards the
road), plan-north −Z. Levels G, 1..9, Roof. Floor-to-floor 3.05 m. Spawn on the road
at (0, ~20) facing the gate (−Z).

## Debug / URL flags
- `?debug=1` — FPS + renderer calls/tris + floor + position overlay; teleport/noclip.
- `?floors=N` — build only N upper floors (max 9).
- `?quality=low|med|high`.
- `#cutscene=intro|lift|flat` — play a cutscene on start.
- `window.__game` — `ready` (promise), `teleport(x,z,floor,yaw)`, `playCutscene(name)`,
  `getStats()`, `setQuality(name)`, `setNoclip(v)`.

# STAGE 1 — THE TOWER: Progress

**Project:** 3D web game — a 10-storey residential building in Bangladesh ("Shanti Neer / শান্তি নীড়").
**Stack:** Three.js 0.180.0 (vendored, no CDN), plain HTML + ES modules + import map.
**Deliverable:** web game folder + ZIP, and a real APK built by GitHub Actions
with Capacitor (see "APK (GitHub Actions)" below — NOT built on this VM, Gradle
is blocked here). Repo: AYAN698969/stage-1-the-tower (user creates it, then the
game is pushed and GitHub Pages enabled).

## Done

### Scaffold
- `~/workspace/tower-game/` with `src/{core,player,building,world,npc,cutscenes,ui,audio,i18n}`, `config/`, `assets/`, `vendor/`, `docs/`, `_source/` (git-ignored), `test/`.
- git init (commit `be5e341` — building shell; later work uncommitted, see below).
- Three.js 0.180.0 vendored: `three.module.js` + `three.module.min.js` + `three.core.js` + `three.core.min.js` (the minified build imports `./three.core.min.js` — it was missing at first and broke the game; fixed 2026-11-27), addons `GLTFLoader`, `BufferGeometryUtils`, `SkeletonUtils`, `RoomEnvironment`, `meshopt_decoder`. Import map: `three` → `./vendor/three.module.min.js`, `three/addons/` → `./vendor/addons/`. `node_modules/three` is a symlink to vendor so Node tests can `import 'three'`.
- `package.json` (name `tower-game`, type module).

### Configs (all data-driven, no magic coordinates in rendering code)
- `config/building.json` — name, 9 upper floors, floorHeight 3.05, seed 7, sun (elev 38°, azim 135°, intensity 2.8), spawn (0, 20), plot, road, facade colours, player (eye 1.6, radius 0.28, walk 2.0, sprint 3.8).
- `config/floorplan.json` — footprint, core (stair/lift/lobby), shafts, flats A/B/C rooms/doors/windows, stair, lift, roof.
- `config/furniture.json` — placements per flat type + fit sizes + colliders; C = mirror of A.
- `config/npcs.json` — 7 NPCs (guard, tea seller + customer, 2 walkers, lobby resident, flat 4B resident).
- `config/cutscenes.json` — intro/lift/flat keyframe paths.
- `config/world.json` — gate, guard room, trees, poles, signs, parking (8 vehicles), moving vehicles, neighbours, tea stall, bins, meter box, pump house.

### Floor-plan layout (validated by `test/plan.test.js`)
- Building x [-9.15, 9.15], z [-7.62, 7.62]. Core: stair x [-2.75,-0.92] z [-7.62,-3.96]; lift x [0.92,2.75] z [-7.62,-5.49]; lobby rects [[-2.75,-3.96,2.75,0.0], [-0.92,-5.49,2.75,-3.96]] (second rect extended east to 2.75 so the lift door is reachable); solid duct block x [-0.92,0.92] z [-7.62,-5.49] (walled, not walkable). Shafts x [-5.28,-4.67] and [4.67,5.28], z [0,7.62].
- Type-A region: north x [-9.15,-2.75] z [-7.62,0] + south x [-9.15,-5.28] z [0,7.62]; Type-B x [-4.67,4.67] z [0,7.62]; Type-C = mirror of A. All rooms tile cleanly (validated: 48 zones, 0 overlaps, 0 gaps at 1 cm raster).
- Stair dog-leg: flight A (west) rises north z -3.96 → -6.30 (half height 1.525); north landing z [-7.62,-6.30]; flight B (east) rises south z -6.30 → -3.96 (full height 3.05); 18 risers, rise 0.1694, tread 0.26, run 2.34 per flight.
- **Skipped patch 3.4.3** — the small ~4'x4' north veranda on the stair-side bedroom (A/C) does not fit without breaking the room tiling. Not built; noted here.
- **Config bugs fixed by the validators:** lobby extension rect (void filled, lift door reachable); added lobby↔outside entrance door; flat B living/dining/bedE z-overlap 0.15 m fixed; **all flat B windows removed** (they were all on E/W edges facing the service shafts — the middle flat has no exterior side walls; B gets light through its south verandas); A verSW door edge W→E; door/window lookup is flat-aware now (a wall only consults the two flats that share it); doors/windows must overlap the current wall sub-segment (fixed a duplicated C main door).

### Building shell (`src/building/plan.js`)
- `collectZones`, `buildFloorShell` (walls from room rects: shared edges → interior walls, exterior edges → facade with window openings, veranda open edges → railings; door gaps + lintels + frames; glass specs per flat; bath-tile lower walls in toilets/kitchens; static colliders with door gaps passable and window sills blocking), floor boxes per room rect, slab boxes with stair+lift holes (box decomposition), slab band per floor, stairs (merged steps + handrails) in the floor template, `buildBuilding` (floor template cloned per floor 1–9 with shared geometry, glass meshes per flat, door specs per floor, ground floor, roof), `buildGroundFloor` (core-only shell, glass entrance as side panels + transom so the 2.4 m opening stays walkable, pilotis columns on a 3.05 m grid with colliders), `buildRoof` (parapet 1.1 m, stair headroom as 4 walls with a LOCKED roof door panel in its south wall + cap slab — roof visible but not walkable — lift machine room, 2 water tanks, dishes).
- Tests PASS: `test/plan.test.js` (48 zones, 0 overlaps/gaps; doors/windows fit edges; every window on an exterior edge), `test/shell.test.js` (one floor shell: 5,628 tris, 31 door specs, 17 glass specs, 162 collider boxes; full building: 292 meshes, 59,404 tris, roof door present, 9 flat groups).

### Interiors (`src/building/flat.js`)
- `buildFlatTemplates` — one template per flat type from furniture.json (clone + normalizeModel to fit size, ceiling fans hung at wall height, colliders from the rotated footprint, seeded tint, veranda dressing, one warm PointLight per flat in the living room); `instantiateFlat` — clones per floor/flat, collects spinning fans, applies a seeded sofa/bed tint from a 3-colour palette.
- **Stand-ins:** veranda dressing (AC unit, drying line + 2 cloth pieces, curtains flanking the first bedroom window) is simple boxes — no free models exist for those three. Shoe rack: no free model exists — skipped, not built.

### Lift (`src/building/lift.js`) — test PASS (`test/lift.test.js`)
- Car (floor plate, ceiling, back/side walls, handrail, lamp, 2 sliding car doors), shaft doors on every floor G–9 (2 sliding panels each), call buttons per floor, state machine idle → opening → open → closing → moving → opening, door slide 1 s, open hold 8 s auto-close, speed 1.2 m/s, `call(floor)`, `select(floor)` via bus `lift:select`, emits `lift:arrived` and `lift:panel-hide`.

### Doors (`src/building/doors.js`)
- One InstancedMesh for all swing doors (unit box geometry, hinge edge at x=0, per-instance matrix = hinge translation × rotation × scale). Closed angle along the wall, open angle = closed ±100° swinging into roomB. Room/toilet doors auto-open within 1.2 m (0.4 s animation), main doors manual via `toggle()`. `getClosedBoxes(floor)` returns AABBs of closed doors for the player collision pass.

### Street + world (`src/world/street.js`, `src/world/vehicles.js`)
- Layered ground planes (grass, plot pavers, road, footpaths), boundary wall 2.2 m with 4 m gate + 1 m pedestrian gate + pillars, sliding gate panel slid open west, nameplate (building name + Bangla) at x=6.5, guard room 3×3 with window, 10 trees (leafy/palm), 8 poles + sagging wires (QuadraticBezierCurve3 + TubeGeometry), neighbour blocks, 3 Bangla signs (রহিম স্টোর / RAHIM STORE, সততা ফার্মেসি / SOTOTA PHARMACY, চায়ের দোকান / TEA STALL) with posts, tea stall model, bins, meter box, pump house, 8 parked vehicles from world.json + 4 extra static street vehicles (2 bicycles as rickshaw stand-ins, 1 extra CNG, 1 extra car).
- Moving vehicles: car lane 19.5 speed 3.0, CNG lane 18.0 speed 2.2, bicycle lane 21.0 speed 1.6; left-hand traffic; loop x −45..45; stop if the player is within 4 m ahead in the same lane; never harm the player.

### NPCs (`src/npc/npc.js`)
- Clones man/woman models, normalizes to 1.7 m, AnimationMixer per NPC, idle NPCs loop Idle, walkers follow a waypoint path ping-pong with the Walk clip and face the movement direction.

### Player (`src/player/player.js`)
- Position/yaw/pitch/floor, 3 camera modes (first/third/second via bus `camera:toggle`; character rotation.y = yaw + PI so the girl faces the camera forward; character hidden in first-person), movement from input.moveVector with yaw-relative forward/right, walk 2.0 / sprint 3.8, collision via a per-frame combined Collider2D (static floor boxes + closed-door boxes, one move call), stairs via the lap method (in the stairwell, Y = lap*3.05 + stairHeightAt; on exiting, floor = round(Y/3.05) and Y snaps), lift riding (inLift when inside the car with doors open; Y follows lift.carY; panel shown once on arrival), safety reset (last valid position when not inside a wall and Y > −1; reset if inside a wall or Y < −1), noclip flag (`window.__game.setNoclip`), interaction raycast from screen centre (1.8 m) against the door InstancedMesh + lift call buttons + roof door (prompt via bus `ui:prompt`; E/Interact toggles a manual door, calls the lift, or shows 'Roof access closed' toast), location label via `locate()`/`locateFlat()`, objective "Go to flat 4B" (emits `ui:objective-done`).
- **Known limitations:** interaction raycast does not test wall occlusion (range is short).
- **Fixed 2026-11-27:** third-person camera now pulls in when a wall is behind the player (Collider2D.raycast, tested); characters were invisible because SkeletonUtils.clone breaks these models — they are now loaded fresh per instance (see the smoke-test section).
- **Fixed 2026-11-27 (camera lookAt bug):** the third-person lookAt target was a point BEHIND the character (`P + forward*1.2` where the code's "forward" is actually the behind-direction — camera forward is `(-sin yaw, -cos yaw)`). At full distance this still looked right, but when the pull-in distance dropped below 1.2 m the camera looked AWAY from the character (screenshot 05 was a brown wall/door filling the frame). The target is now `P + facing*1.2` (past the character in the direction she faces), so the view is correct at any pull-in distance. Also: over-the-shoulder offset (0.45 m) so the character sits off-centre, and the character is hidden when the camera is pulled in under 1.0 m so she never fills the whole frame (view becomes effectively first-person until the player moves away from the wall). A "raise the camera when close" variant was tried and reverted — it pushed the character below the frame. Verified with `test/cam-probe.mjs` (camera pos/dir dumped + screenshot).

### Cutscenes (`src/cutscenes/cutscenes.js`)
- CutscenePlayer: `play(name, baseY=0)` from config/cutscenes.json (intro/lift/flat keyframes with pos/look/t), smoothstep interpolation, drives the camera, disables input, emits `ui:cutscene` (Skip button) and `cutscene:done`; `skip()` finishes immediately. Flat tour frames are eye-height above floor 4, so baseY = 4*3.05 = 12.2.

### UI (`src/ui/ui.js`) + `styles.css`
- Loading overlay (title, progress bar, text), Tap to Start button, HUD (crosshair, location label, objective, prompt, toast, dismissable controls hint), mini-map canvas (150×150, draws the current floor's plan from floorplan.json — footprint, room rects, core in accent, player dot + facing line; redrawn at most every 0.25 s or on floor change; toggleable via Map button), touch controls (joystick bottom-left, look area on the right half, Interact button shown only when a prompt exists, Sprint toggle, Camera, Menu, Map), Skip button for cutscenes, lift panel (buttons G, 1–9, emits `lift:select`), pause menu (Resume, Help, Quality low/med/high emitting `quality:set`, Restart via location.reload). Mobile-first CSS: safe-area insets, tap targets ≥48 px, touch-action none, portrait media query shrinking the map.

### Audio (`src/audio/audio.js`)
- Procedural WebAudio: looped noise through a low-pass filter with a slow LFO (morning breeze) + occasional synthesized bird chirps. Starts on bus `game:start`; M toggles mute via `audio:mute` (toast "Muted"/"Sound on").

### Core systems
- `src/i18n/strings.js` — English dictionary + `t()` with {var} replacement.
- `src/core/events.js` — EventBus + shared bus.
- `src/core/config.js` — loadJSON, loadConfigs, mirrorFlat, mirrorFurniture (mirrorFlat negates door/window "at" on N/S edges and keeps it on E/W edges).
- `src/core/materials.js` — shared PBR materials + canvas textures (floor tiles 0.6 m, road, pavers, grass, bath tiles, signTexture, nameplateTexture, directoryTexture). Note: uses `document.createElement('canvas')`, so it cannot run in Node; Node tests use stub materials.
- `src/core/assets.js` — AssetManager with GLTFLoader + MeshoptDecoder, loadManifest/loadAll/clone via SkeletonUtils, normalizeModel fit-to-size, findClip. **Fixed 2026-11-27:** three r180's `SkeletonUtils.js` exports bare functions (`clone`, `retarget`), not a namespace — now imports `{ clone as cloneSkinned }`.
- `src/core/collision.js` — pure JS, Node-testable: Collider2D axis-aligned boxes with circle-vs-box sliding, stairHeightAt, inStairwell.
- `src/core/engine.js` — Engine: renderer ACES tone mapping, RoomEnvironment PMREM, sun, fog, quality tiers low/med/high (pixelRatio 0.75/1.0/1.5, shadows only on high), resize, getStats.
- `src/core/input.js` — Input: keyboard WASD/arrows, Shift sprint, E interact, pointer-lock mouse look, touch joystick + look drag wired by UI, sprint toggle.

### Entry point (`src/main.js` + `index.html`)
- main(): loads configs (honours `?floors=N`, max 9), creates Engine (quality from `?quality` or 'low' if width < 800 else 'med'), sets the sun from building.json, creates Input/UI/AudioAmbience, loads the manifest + all models with progress, builds the building/flats/doors/lift/street/vehicles/NPCs, assembles per-floor colliders (upper = shell + furniture colliders, shared for floors 1–9; ground = ground core + columns + street), creates the Player, CutscenePlayer, flat-visibility + glass logic (only the player's floor has furniture visible; glass is clear only for the flat the player is in, opaque otherwise), debug overlay when `?debug=1` (FPS + renderer calls/tris + floor + position), keyboard shortcuts V (camera), M (mute), Esc (pause), `game:start` handler (fullscreen request, intro cutscene by default or `#cutscene=lift|flat` with teleports: flat → (0, 2.2, floor 4), lift → (0, −2, floor 0, yaw PI)), game loop.
- `window.__game` exposes `ready` (promise), `teleport(x,z,floor,yaw)`, `playCutscene(name)`, `getStats()`, `setQuality(name)`, `setNoclip(v)`.
- index.html: viewport with maximum-scale=1, user-scalable=no, viewport-fit=cover, import map, #game-root div, module script src/main.js.

### Assets — 36 of 38 models, all CC0/CC-BY (see `docs/assets-report.md`)
- Source: Poly Pizza (mirrors Kenney/Quaternius/Poly by Google models with licences shown per model) — except the auto-rickshaw, from 3DAssets.dev (CC0). Raw 11.2 MB → optimised 1.79 MB total (gltf-transform 4.5.1, meshopt + WebP ≤1024 px; characters used gentle flags so rigs/animations survived — verified).
- Player character: **girl** (Animated Woman, Quaternius, CC0, 1,908 tris, 10 anims incl. Idle/Walking/Running). NPCs: man (11 anims), woman (24 anims).
- **Missing (2):** rickshaw — no free CC0/CC-BY rickshaw model found anywhere searched; alternative bicycle delivered (user decided 2026-11-27 to KEEP the bicycle stand-in). shoe_rack — no free model found; skipped.
- **CNG swap (2026-11-27, user decision):** the golf-cart stand-in was swapped for a real auto-rickshaw — `assets/auto_rickshaw.glb` ("Auto Rickshaw (Indian Bazaar Street and Temple)" by @3dassets, CC0, 3DAssets.dev, 596 tris, 19.0 KB, teal body, "roll" animation kept). Old `assets/cng_tuktuk.glb` deleted; manifest + CREDITS.md + assets-report updated.
- **Stand-ins:** tea stall → market-stall set (CC0, Quaternius); AC unit / drying line / curtains → simple boxes (flat.js).
- **CC-BY attribution needed** for 2 models: Bicycle and Motorcycle by Poly by Google. See `CREDITS.md`.
- **Budget check:** total shipped assets 1.79 MB (target ≤70 MB — well under); download before spawn ~1.79 MB + vendor 2.9 MB (target ≤25 MB — under); all files ≤5 MB; triangles within budget except tea_stall 11,467 (inside the 15k vehicle-class budget).

### Smoke test — re-run after character fix (2026-11-27)
- Servers: `python3 -m http.server 8000` in ~/workspace/tower-game; real headless
  Chrome (Playwright's chromium_headless_shell-1248, HeadlessChrome/156) on port
  9223 with `--use-angle=swiftshader --enable-unsafe-swiftshader`. **Obscura
  does NOT support WebGL** (`Error creating WebGL context`) — use the real
  Chrome for smoke tests. Obscura also blocks private IPs by default
  (`--allow-private-network` needed) and its CDP needs `Target.createTarget` +
  `Target.attachToTarget` (the page target's direct WebSocket and `/json/new`
  do not work). The shared CDP client is `test/cdp.mjs` (port via `CDP_PORT`;
  reuses the first page target so repeated runs don't pile up WebGL pages).
- **First smoke run PASSED (0 console errors, 0 warnings, game ready in 2 s,
  9 screenshots)** but the screenshots showed real bugs (see below).
- **Bugs found by the smoke test (fixed 2026-11-27):**
  - `vendor/three.core.min.js` was missing (the minified build imports it) → game failed to load with a 404. Downloaded from unpkg three@0.180.0.
  - `SkeletonUtils` namespace import — r180 exports bare functions; assets.js now imports `{ clone as cloneSkinned }`.
  - **Characters were invisible/flat — root cause found:** `SkeletonUtils.clone`
    breaks these Quaternius character GLBs (their mesh nodes carry a -90° X
    rotation + 100x scale; the clone comes out 100x too big and lying flat).
    Proven by `test/char-test2.html`: original+normalizeModel = correct 1.7 m
    standing character; clone = [163, 108, 521]; clone+normalize = flat
    [0.19, 0.12, 0.60]; re-bind does NOT fix it. **Fix:** characters are now
    loaded FRESH per instance (`AssetManager.loadFresh`, pre-loaded in main.js
    for the player + 7 NPCs); `assets.clone()` is kept only for non-skinned
    furniture/props. `normalizeModel` now calls `updateMatrixWorld(true)`
    before measuring.
  - **Third-person camera clipped into walls/doors indoors** (screenshot 05:
    camera inside a door). **Fix:** camera pull-in — `Collider2D.raycast`
    (new, tested in `test/collision.test.js`) clamps the camera distance when
    a wall is behind the player (min 0.5 m, 0.25 m clearance).
  - **Smoke-test skip was unreliable** (DOM Skip button click sometimes missed
    because the cutscene hadn't started) — the test now skips via
    `window.__game._cutscenes.skip()` and waits for `playing === null`.
  - **Flat 4B teleport spot (0, 2.2) was on the coffee table** — test now uses
    (-1.0, 5.5) for the living-room view and (0, 3.6) facing south for the
    dining/veranda view; the flat cutscene's player teleport changed to
    (0, 3.6, 4, yaw=PI) for the same reason.
  - **Third-person lookAt bug (found 2026-11-27, fixed):** the lookAt target was
    a point BEHIND the character, so when the pull-in distance dropped below
    1.2 m the camera looked AWAY from her (screenshot 05 was a brown wall
    filling the frame). Target is now past her in the direction she faces.
    Also: over-the-shoulder offset (0.45 m) and the character hides when the
    camera is pulled in under 1.0 m. A "raise the camera when close" variant
    was tried and reverted (it pushed her below the frame). Diagnosed with
    `test/cam-probe.mjs` (dumps camera pos/dir + screenshot).
  - **CNG swap verified visually (2026-11-27):** `test/cng-check.mjs` screenshot
    `test/smoke/cng-parked.png` shows the teal auto-rickshaw on the road, plus
    the blue bicycle, a white car, a walking NPC, wires and poles.
- **Final smoke run PASSED 2026-11-27 (after the camera fix + CNG swap): game
  ready in 4 s, 0 console errors, 0 console warnings, 9 screenshots** (spawn
  road, spawn third-person with the girl visible, flat 4B living/south/third,
  floor 4 lobby, ground lobby, street gate, lift cutscene). Stats at spawn:
  284 calls, 137,972 tris; at end: 75 calls, 30,198 tris.
- Driver: `test/smoke.mjs` (uses shared `test/cdp.mjs` CDP client). Screenshots: spawn road, spawn third-person, flat 4B living (first + south + third-person), floor 4 lobby, ground lobby, street gate, lift cutscene. See `test/smoke/`.

## Next
1. ~~Finish the headless smoke test~~ — DONE 2026-11-27: final run passed clean (0 console errors/warnings, 9 screenshots). See the smoke-test section.
2. Commit the new work (index.html, src/*, vendor/three.core.min.js, test/*, docs/*, .github/workflows/build-apk.yml).
3. ZIP the game folder (excluding `_source/`, `.git`, `node_modules/`) and report to the parent agent with folder path, ZIP path, total size, phone open instructions, test evidence, and substitutions.

## APK (GitHub Actions + Capacitor — 2026-11-27)
- The user also wants a real APK, not only the web link/ZIP. It is **not built on
  this VM** (Gradle/Java networking is blocked here — same as AYAN Drive).
- Workflow file `.github/workflows/build-apk.yml` (placed by the parent agent):
  on push to `main` it copies `index.html`, `styles.css`, `src/`, `assets/`,
  `vendor/`, `config/` into `www/`, installs Capacitor, inits the app ("The Tower",
  `com.ayan.tower`), adds Android, and builds a debug APK with Gradle on GitHub's
  runner. The APK appears under Actions → the run → Artifacts → `the-tower-apk`.
- **Runtime file check (2026-11-27):** the game loads ONLY those files at runtime
  — `index.html` references `styles.css` + `src/main.js`; the code fetches
  `assets/manifest.json` + the 6 `config/*.json`; GLBs come from `assets/` via the
  manifest; the import map points at `vendor/`. No other file is needed at runtime
  (no CREDITS.md/README/docs/`_source/` reference). The workflow's copy list is complete.

## Decisions
- Whole game at once, no M0–M5 gates; MOBILE only; ZIP + playable link, and a real APK via GitHub Actions + Capacitor (see above — not built on this VM).
- ALL REAL FREE models only (CC0/CC-BY); no code-built/procedural furniture (except the clearly-marked veranda dressing boxes and the AC/drying-line/curtain stand-ins, where no free model exists).
- 3 camera modes (first/third/second), switchable with on-screen button + V key.
- Defaults (user did not answer): player a girl; cutscenes intro/lift/flat tour; building name 'Shanti Neer / শান্তি নীড়'.
- Objective "Go to flat 4B"; mini-map early; loading screen with progress.
- Roof NOT walkable (locked door), visible from outside only.
- Prompt middle (rest of 7.2, Sections 8–12, README items 1–2) never arrived — the 3 cutscene stories and NPC details are defaults, not from the brief.

## Blockers / known gaps
- Rickshaw + shoe_rack models missing (bicycle stand-in kept per user decision 2026-11-27; shoe rack skipped).
- CNG is now a real auto-rickshaw (3DAssets.dev, CC0, teal); tea stall is a market-stall stand-in; AC unit / drying line / curtains are simple box stand-ins.
- North-veranda patch 3.4.3 skipped (does not fit the room tiling).
- Interaction raycast does not test wall occlusion (range is short, 1.8 m).
- Street moving vehicles are 3 (car/CNG/bicycle) vs the brief's counts — static vehicles added to reach ≥3 rickshaw-like, 2 CNG on the plot/street.
- Software WebGL is very slow on this VM — the headless smoke test is for console errors and screenshots only, never FPS.
- No GPU on this VM; heavy 3D rendering cannot be judged here.

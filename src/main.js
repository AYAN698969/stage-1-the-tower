/**
 * STAGE 1 - THE TOWER: bootstrap.
 * Loads configs + models, builds the world, wires the systems, runs the loop.
 * URL flags: ?floors=N ?quality=low|med|high ?debug=1 #cutscene=intro|lift|flat
 * Exposes window.__game { ready, teleport, playCutscene, getStats, setQuality, setNoclip }.
 */
import * as THREE from 'three';
import { loadConfigs } from './core/config.js';
import { createMaterials } from './core/materials.js';
import { AssetManager } from './core/assets.js';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { Collider2D } from './core/collision.js';
import { bus } from './core/events.js';
import { buildBuilding } from './building/plan.js';
import { buildFlatTemplates, instantiateFlat } from './building/flat.js';
import { DoorSystem } from './building/doors.js';
import { Lift } from './building/lift.js';
import { buildStreet } from './world/street.js';
import { Vehicles } from './world/vehicles.js';
import { NPCManager } from './npc/npc.js';
import { Player } from './player/player.js';
import { CutscenePlayer } from './cutscenes/cutscenes.js';
import { UI } from './ui/ui.js';
import { AudioAmbience } from './audio/audio.js';

const params = new URLSearchParams(location.search);
const debugMode = params.get('debug') === '1';

let resolveReady;
window.__game = {
  ready: new Promise((r) => { resolveReady = r; }),
  teleport: (x, z, floor = 0, yaw = null) => window.__game._player?.teleport(x, z, floor, yaw),
  playCutscene: (name) => window.__game._cutscenes?.play(name, name === 'flat' ? 4 * 3.05 : 0),
  getStats: () => window.__game._engine?.getStats(),
  setQuality: (name) => window.__game._engine?.setQuality(name),
  setNoclip: (v) => { if (window.__game._player) window.__game._player.noclip = !!v; },
};

async function main() {
  const container = document.getElementById('game-root');
  const configs = await loadConfigs();
  const { building, floorplan: fp } = configs;
  // URL flag: fewer floors (testing).
  const floorsParam = parseInt(params.get('floors') || '', 10);
  if (floorsParam > 0 && floorsParam <= 9) building.floors = floorsParam;

  const engine = new Engine(container, params.get('quality') || (window.innerWidth < 800 ? 'low' : 'med'));
  engine.setSun(building.sun.elevation, building.sun.azimuth);
  window.__game._engine = engine;
  const mats = createMaterials(building);
  const input = new Input();
  input.attach(engine.renderer.domElement);
  const ui = new UI({ container, input, floorplan: fp, building, engine });
  const audio = new AudioAmbience();
  void audio;

  // --- assets ---
  const assets = new AssetManager();
  await assets.loadManifest();
  await assets.loadAll((done, total) => ui.setProgress(done, total));
  ui.ready();

  // --- characters: load each instance FRESH (no SkeletonUtils.clone) ---
  // The Quaternius character GLBs carry a -90° X rotation + 100x scale on
  // their mesh nodes; cloning them comes out 100x too big and lying flat.
  // A fresh load + normalizeModel gives a correct 1.7 m standing character.
  const playerChar = await assets.loadFresh('girl');
  const npcChars = [];
  for (const def of configs.npcs) npcChars.push(await assets.loadFresh(def.model));

  // --- world ---
  const ctx = { ...configs, engine, input, mats, assets, playerChar, npcChars };
  const built = buildBuilding(ctx);
  engine.scene.add(built.group);
  const templates = buildFlatTemplates(ctx);
  const tintCache = new Map();
  const fans = [];
  for (let f = 1; f <= building.floors; f++) {
    for (const flatKey of ['A', 'B', 'C']) {
      const { group, fans: ff } = instantiateFlat(templates[flatKey], f, flatKey, tintCache);
      built.flatGroups[f].add(group);
      fans.push(...ff);
    }
  }
  // Doors (floors 1..9 + ground).
  const doorSpecs = { ...built.doorSpecsByFloor, 0: built.groundDoorSpecs };
  const doors = new DoorSystem(ctx, doorSpecs);
  engine.scene.add(doors.mesh);
  // Lift.
  const lift = new Lift({ ...ctx, scene: engine.scene });
  engine.scene.add(lift.group);
  // Street + vehicles + NPCs.
  const street = buildStreet(ctx);
  engine.scene.add(street.group);
  const vehicles = new Vehicles(ctx);
  engine.scene.add(vehicles.group);
  const npcs = new NPCManager(ctx);
  engine.scene.add(npcs.group);

  // --- colliders ---
  const upper = new Collider2D();
  for (const b of built.shell.collider.boxes) upper.boxes.push(b);
  for (const t of Object.values(templates)) {
    for (const [x0, z0, x1, z1] of t.colliders) upper.addBox(x0, z0, x1, z1);
  }
  const ground = new Collider2D();
  for (const b of built.groundCollider.boxes) ground.boxes.push(b);
  for (const b of street.collider.boxes) ground.boxes.push(b);
  const colliders = { 0: ground };
  for (let f = 1; f <= building.floors; f++) colliders[f] = upper;

  // --- player ---
  const player = new Player({ ...ctx, colliders, doors, lift, roofDoor: built.roofDoor });
  window.__game._player = player;

  // --- cutscenes ---
  const cutscenes = new CutscenePlayer({ engine, cutscenes: configs.cutscenes, input });
  window.__game._cutscenes = cutscenes;

  // --- visibility: only the player's floor has furniture + clear glass ---
  let visFloor = -1;
  let visFlat = null;
  function updateVisibility() {
    if (player.floor === visFloor && visFlat === playerFlat()) return;
    visFloor = player.floor;
    visFlat = playerFlat();
    for (let f = 1; f <= building.floors; f++) built.flatGroups[f].visible = f === visFloor;
    for (const [key, meshes] of Object.entries(built.glassByFlat)) {
      const [f, flat] = key.split(':');
      const clear = Number(f) === visFloor && flat === visFlat;
      for (const m of meshes) m.material = clear ? mats.glassClear : mats.glassOpaque;
    }
  }
  function playerFlat() {
    if (player.floor === 0) return null;
    for (const [key, flat] of Object.entries(fp.flats)) {
      for (const room of flat.rooms) {
        for (const [x0, z0, x1, z1] of room.rects) {
          if (player.pos.x >= x0 && player.pos.x <= x1 && player.pos.z >= z0 && player.pos.z <= z1) return key;
        }
      }
    }
    return null;
  }

  // --- debug overlay ---
  let debugEl = null;
  if (debugMode) {
    debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:absolute;left:8px;bottom:8px;color:#0f0;background:rgba(0,0,0,.6);font:12px monospace;padding:4px 8px;z-index:50;pointer-events:none;';
    container.appendChild(debugEl);
  }

  // --- events ---
  let paused = false;
  bus.on('game:pause', ({ paused: p }) => { paused = p; });
  bus.on('quality:set', ({ quality }) => engine.setQuality(quality));
  bus.on('cutscene:skip', () => cutscenes.skip());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') bus.emit('camera:toggle');
    if (e.code === 'KeyM') bus.emit('audio:mute');
    if (e.code === 'Escape') ui.setPaused(!ui.paused);
  });
  const hashCut = (location.hash.match(/cutscene=(\w+)/) || [])[1];
  bus.on('game:start', () => {
    ui.started();
    document.documentElement.requestFullscreen?.().catch(() => {});
    const name = hashCut || 'intro';
    if (name === 'flat') player.teleport(0, 3.6, 4, Math.PI);
    if (name === 'lift') player.teleport(0, -2, 0, Math.PI);
    cutscenes.play(name, name === 'flat' ? 4 * building.floorHeight : 0);
  });

  // --- loop ---
  const clock = new THREE.Clock();
  let fpsAcc = 0; let fpsN = 0; let fpsTimer = 0;
  engine.start(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!paused) {
      const cutPlaying = cutscenes.update(dt);
      if (!cutPlaying) player.update(dt);
      doors.update(dt, player.pos, player.floor);
      lift.update(dt);
      vehicles.update(dt, player.pos);
      npcs.update(dt);
      for (const fan of fans) fan.rotation.y += dt * 8;
      updateVisibility();
      ui.update(dt, player);
    }
    engine.renderer.render(engine.scene, engine.camera);
    if (debugEl) {
      fpsAcc += 1 / Math.max(dt, 0.001); fpsN++; fpsTimer += dt;
      if (fpsTimer > 0.5) {
        const s = engine.getStats();
        debugEl.textContent = `fps ${Math.round(fpsAcc / fpsN)} | calls ${s.calls} | tris ${s.triangles} | floor ${player.floor} | pos ${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)}`;
        fpsAcc = 0; fpsN = 0; fpsTimer = 0;
      }
    }
  });

  resolveReady({ engine, player, lift, doors });
  console.log('[tower] ready');
}

main().catch((e) => {
  console.error('[tower] failed to start', e);
  document.getElementById('game-root').innerHTML = `<div style="color:#fff;padding:24px;font-family:sans-serif">Failed to load the game: ${e.message}</div>`;
});

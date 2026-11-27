/**
 * NPCs: animated characters from npcs.json. Idle NPCs loop their Idle
 * clip; walkers follow a waypoint path (ping-pong) with the Walk clip.
 */
import * as THREE from 'three';
import { normalizeModel, findClip } from '../core/assets.js';

export class NPCManager {
  /**
   * @param {object} ctx { npcs, assets, building }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.group.name = 'npcs';
    this.list = [];
    for (let i = 0; i < ctx.npcs.length; i++) {
      const def = ctx.npcs[i];
      // Pre-loaded fresh scene per NPC (see main.js) — do NOT clone() a
      // skinned character, SkeletonUtils.clone breaks these models.
      const fresh = (ctx.npcChars || [])[i];
      const obj = fresh?.scene || null;
      if (!obj) { console.warn('[npc] missing model', def.model); continue; }
      const wrap = normalizeModel(obj, [0.6, 1.7, 0.6]);
      wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const y = (def.floor || 0) * ctx.building.floorHeight;
      const start = def.pos || def.path[0];
      wrap.position.set(start[0], y, start[1]);
      if (def.rotY != null) wrap.rotation.y = (def.rotY * Math.PI) / 180;
      this.group.add(wrap);
      const mixer = new THREE.AnimationMixer(wrap);
      const clips = fresh.clips || [];
      const idle = findClip(clips, 'idle');
      const walk = findClip(clips, 'walk');
      let action = null;
      if (def.behavior === 'walk' && walk) {
        action = mixer.clipAction(walk);
      } else if (idle) {
        action = mixer.clipAction(idle);
      }
      if (action) action.play();
      this.list.push({
        def, group: wrap, mixer, idle, walk, action,
        path: def.path || null, pathIdx: 1, dir: 1,
        pos: new THREE.Vector3(start[0], y, start[1]),
      });
    }
  }

  /** @param {number} dt */
  update(dt) {
    for (const n of this.list) {
      n.mixer.update(dt);
      if (n.def.behavior !== 'walk' || !n.path) continue;
      const target = n.path[n.pathIdx];
      const dx = target[0] - n.pos.x;
      const dz = target[1] - n.pos.z;
      const dist = Math.hypot(dx, dz);
      const speed = n.def.speed || 1.0;
      if (dist < 0.15) {
        n.pathIdx += n.dir;
        if (n.pathIdx >= n.path.length) { n.pathIdx = n.path.length - 2; n.dir = -1; }
        if (n.pathIdx < 0) { n.pathIdx = 1; n.dir = 1; }
        continue;
      }
      const step = Math.min(dist, speed * dt);
      n.pos.x += (dx / dist) * step;
      n.pos.z += (dz / dist) * step;
      n.group.position.set(n.pos.x, n.pos.y, n.pos.z);
      n.group.rotation.y = Math.atan2(dx, dz);
      // Walkers play the Walk clip from the start (set in the constructor).
    }
  }

  dispose() { this.group.removeFromParent(); }
}

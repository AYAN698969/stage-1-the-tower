/**
 * Moving street vehicles: loop along the road in the left lane, slow
 * (2-4 m/s), and stop if the player is within 4 m ahead. They never
 * harm the player. Direction follows left-hand traffic: lanes north of
 * the road centre (z < 19.75) travel +X, lanes south travel -X.
 */
import * as THREE from 'three';
import { normalizeModel } from '../core/assets.js';

const ROAD_X0 = -45;
const ROAD_X1 = 45;
const ROAD_CENTRE_Z = 19.75;
const STOP_DIST = 4;

export class Vehicles {
  /**
   * @param {object} ctx { world, assets }
   */
  constructor(ctx) {
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    this.list = [];
    for (const v of ctx.world.moving) {
      const obj = ctx.assets.clone(v.model);
      if (!obj) continue;
      const size = v.model === 'car' ? [1.8, 1.5, 4.2] : v.model === 'cng_tuktuk' ? [1.4, 1.6, 2.6] : [0.6, 1.1, 1.9];
      const wrap = normalizeModel(obj, size);
      wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const dir = v.lane < ROAD_CENTRE_Z ? 1 : -1;
      const x = dir > 0 ? ROAD_X0 + Math.random() * 20 : ROAD_X1 - Math.random() * 20;
      wrap.position.set(x, 0, v.lane);
      wrap.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(wrap);
      this.list.push({ mesh: wrap, lane: v.lane, speed: v.speed, dir, x });
    }
  }

  /** @param {number} dt @param {{x:number,z:number}} playerPos */
  update(dt, playerPos) {
    for (const v of this.list) {
      // Stop if the player is within 4 m ahead in this lane.
      let blocked = false;
      if (playerPos) {
        const dz = Math.abs(playerPos.z - v.lane);
        const dx = (playerPos.x - v.x) * v.dir; // >0 means ahead
        if (dz < 2 && dx > 0 && dx < STOP_DIST) blocked = true;
      }
      if (!blocked) {
        v.x += v.dir * v.speed * dt;
        if (v.x > ROAD_X1) v.x = ROAD_X0;
        if (v.x < ROAD_X0) v.x = ROAD_X1;
      }
      v.mesh.position.x = v.x;
    }
  }

  dispose() { this.group.removeFromParent(); }
}

/**
 * Doors: one InstancedMesh for every swing door in the building.
 * Room/toilet doors auto-open on approach (0.4 s) and auto-close;
 * flat main doors are manual (interact). The lift shaft doors and the
 * open glass entrance have no panel here (lift.js / open doorway).
 * Closed doors block the player: getClosedBoxes(floor) returns their
 * AABBs for the player collision pass.
 */
import * as THREE from 'three';

const SWING = (100 * Math.PI) / 180; // door swing angle
const AUTO_RANGE = 1.2; // auto-open when the player is this close (m)
const ANIM_TIME = 0.4; // seconds to open/close

export class DoorSystem {
  /**
   * @param {object} ctx { mats }
   * @param {object} doorSpecsByFloor floor -> [doorSpec] (doorSpec has
   *   x, z, axis, w, kind, height, edge, y)
   */
  constructor(ctx, doorSpecsByFloor) {
    this.ctx = ctx;
    this.doors = [];
    for (const [floor, specs] of Object.entries(doorSpecsByFloor)) {
      for (const s of specs) {
        const axisX = s.axis === 'x';
        // Hinge at the west (axis x) or north (axis z) end of the gap.
        const hingeX = axisX ? s.x - s.w / 2 : s.x;
        const hingeZ = axisX ? s.z : s.z - s.w / 2;
        // Closed: panel lies along the wall. Open: swings into roomB.
        const closedAngle = axisX ? 0 : -Math.PI / 2;
        let openAngle;
        if (axisX) openAngle = s.edge === 'N' ? closedAngle + SWING : closedAngle - SWING;
        else openAngle = s.edge === 'E' ? closedAngle + SWING : closedAngle - SWING;
        this.doors.push({
          floor: Number(floor), x: s.x, z: s.z, axis: s.axis, w: s.w,
          kind: s.kind, height: s.height, y: s.y ?? Number(floor) * 3.05,
          hingeX, hingeZ, closedAngle, openAngle,
          auto: s.kind === 'room' || s.kind === 'toilet',
          animT: 0, target: 0, // 0 = closed, 1 = open
        });
      }
    }
    // One instanced panel for all doors: unit box, hinge edge at x = 0.
    const geo = new THREE.BoxGeometry(1, 1, 0.05);
    geo.translate(0.5, 0, 0);
    this.mesh = new THREE.InstancedMesh(geo, ctx.mats.doorWood, Math.max(1, this.doors.length));
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = this.doors.length;
    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._pos = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._updateInstances();
    // Raycast support: map instanceId -> door index.
    this.mesh.userData.doorSystem = this;
  }

  _updateInstances() {
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      const angle = d.closedAngle + (d.openAngle - d.closedAngle) * d.animT;
      this._euler.set(0, angle, 0);
      this._quat.setFromEuler(this._euler);
      this._pos.set(d.hingeX, d.y + d.height / 2, d.hingeZ);
      this._scale.set(d.w, d.height, 1);
      this._matrix.compose(this._pos, this._quat, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Door object for a raycast instanceId. */
  doorFromInstanceId(id) { return this.doors[id] || null; }

  /** Toggle a manual (main) door. */
  toggle(door) {
    if (!door || door.auto) return;
    door.target = door.target > 0.5 ? 0 : 1;
  }

  /** AABBs of the doors on `floor` that are currently closed (blocking). */
  getClosedBoxes(floor) {
    const out = [];
    for (const d of this.doors) {
      if (d.floor !== floor || d.animT > 0.5) continue;
      if (d.axis === 'x') out.push({ x0: d.x - d.w / 2, z0: d.z - 0.06, x1: d.x + d.w / 2, z1: d.z + 0.06 });
      else out.push({ x0: d.x - 0.06, z0: d.z - d.w / 2, x1: d.x + 0.06, z1: d.z + d.w / 2 });
    }
    return out;
  }

  /** @param {number} dt @param {{x:number,z:number}} playerPos @param {number} playerFloor */
  update(dt, playerPos, playerFloor) {
    let changed = false;
    for (const d of this.doors) {
      if (d.auto) {
        const dx = playerPos.x - d.x;
        const dz = playerPos.z - d.z;
        const near = d.floor === playerFloor && dx * dx + dz * dz < AUTO_RANGE * AUTO_RANGE;
        d.target = near ? 1 : 0;
      }
      const before = d.animT;
      if (d.animT < d.target) d.animT = Math.min(d.target, d.animT + dt / ANIM_TIME);
      else if (d.animT > d.target) d.animT = Math.max(d.target, d.animT - dt / ANIM_TIME);
      if (d.animT !== before) changed = true;
    }
    if (changed) this._updateInstances();
  }

  dispose() { this.mesh.removeFromParent(); }
}

/**
 * Lift: car + shaft doors on every floor + call buttons.
 * State machine: idle -> opening -> open -> closing -> moving -> opening.
 * The car moves at 1.2 m/s; doors take 1 s to slide. The panel UI is
 * shown through the event bus ('lift:panel' / 'lift:select').
 */
import * as THREE from 'three';
import { bus } from '../core/events.js';

const DOOR_TIME = 1.0; // seconds to slide open/closed
const OPEN_HOLD = 8; // seconds the doors stay open before auto-close
const SPEED = 1.2; // m/s

export class Lift {
  /**
   * @param {object} ctx { building, floorplan, mats, scene }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.floors = ctx.building.floors;
    this.fh = ctx.building.floorHeight;
    const L = ctx.floorplan.lift;
    this.cx = (L.x0 + L.x1) / 2;
    this.cz = (L.z0 + L.z1) / 2;
    this.carW = L.car.w;
    this.carD = L.car.d;
    this.doorX = this.cx; // shaft door centre x
    this.doorZ = L.z1; // shaft south wall
    this.state = 'idle';
    this.currentFloor = 0;
    this.targetFloor = null;
    this.doorT = 0; // 0 = closed, 1 = open
    this.openTimer = 0;
    this.carY = 0;
    this.group = new THREE.Group();
    this.group.name = 'lift';
    this.shaftDoors = {}; // floor -> { left, right }
    this.callButtons = [];
    this._buildCar();
    this._buildShaftDoors();
    this._buildCallButtons();
    bus.on('lift:select', ({ floor }) => this.select(floor));
  }

  _panelGeo() {
    return new THREE.BoxGeometry(0.45, 2.1, 0.05);
  }

  _buildCar() {
    const { mats } = this.ctx;
    const car = new THREE.Group();
    car.name = 'lift-car';
    const w = this.carW; const d = this.carD;
    // Floor plate, ceiling, back + side walls (south face is the door).
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mats.metal);
    floor.position.y = 0.025;
    car.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mats.plaster);
    ceil.position.y = 2.2;
    car.add(ceil);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.05), mats.metal);
    back.position.set(0, 1.1, -d / 2 + 0.025);
    car.add(back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, d), mats.metal);
      side.position.set((s * w) / 2 - (s * 0.025), 1.1, 0);
      car.add(side);
    }
    // Handrail + light.
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w - 0.2, 8), mats.railing);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.0, -d / 2 + 0.12);
    car.add(rail);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2 }));
    lamp.position.set(0, 2.16, 0);
    car.add(lamp);
    // Sliding car doors (south face).
    const doorGeo = this._panelGeo();
    this.carDoorL = new THREE.Mesh(doorGeo, mats.metal);
    this.carDoorR = new THREE.Mesh(doorGeo, mats.metal);
    this.carDoorL.position.set(-0.225, 1.05, d / 2 - 0.025);
    this.carDoorR.position.set(0.225, 1.05, d / 2 - 0.025);
    car.add(this.carDoorL);
    car.add(this.carDoorR);
    car.position.set(this.cx, 0, this.cz);
    this.car = car;
    this.group.add(car);
  }

  _buildShaftDoors() {
    const { mats } = this.ctx;
    const doorGeo = this._panelGeo();
    for (let f = 0; f <= this.floors; f++) {
      const y = f * this.fh;
      const left = new THREE.Mesh(doorGeo, mats.metal);
      const right = new THREE.Mesh(doorGeo, mats.metal);
      left.position.set(this.doorX - 0.225, y + 1.05, this.doorZ);
      right.position.set(this.doorX + 0.225, y + 1.05, this.doorZ);
      left.userData.floor = f;
      right.userData.floor = f;
      this.group.add(left);
      this.group.add(right);
      this.shaftDoors[f] = { left, right };
    }
  }

  _buildCallButtons() {
    const { mats } = this.ctx;
    for (let f = 0; f <= this.floors; f++) {
      const y = f * this.fh;
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.06), mats.dark);
      btn.position.set(this.doorX + 0.85, y + 1.2, this.doorZ + 0.1);
      btn.userData = { type: 'lift-call', floor: f };
      this.group.add(btn);
      this.callButtons.push(btn);
    }
  }

  /** Y (world) of the car floor for a given floor index. */
  floorY(f) { return f * this.fh; }

  /** Is the point (x,z) inside the car footprint? */
  containsPoint(x, z) {
    return Math.abs(x - this.cx) < this.carW / 2 && Math.abs(z - this.cz) < this.carD / 2;
  }

  /** Request the lift to come to `floor` (call button). */
  call(floor) {
    if (floor < 0 || floor > this.floors) return;
    if (this.state === 'idle') {
      this.targetFloor = floor;
      if (floor === this.currentFloor) this.state = 'opening';
    } else if (this.state === 'open' && floor === this.currentFloor) {
      this.openTimer = 0; // keep the doors open
    }
  }

  /** Choose a destination floor (from the panel, player must be inside). */
  select(floor) {
    if (floor < 0 || floor > this.floors) return;
    if (this.state !== 'open') return;
    if (floor === this.currentFloor) return;
    this.targetFloor = floor;
    this.state = 'closing';
    bus.emit('lift:panel-hide');
  }

  /** Apply the door slide amount to the car doors + current floor's shaft doors. */
  _applyDoors() {
    const off = this.doorT * 0.45;
    this.carDoorL.position.x = -0.225 - off;
    this.carDoorR.position.x = 0.225 + off;
    for (let f = 0; f <= this.floors; f++) {
      const d = this.shaftDoors[f];
      const o = f === this.currentFloor ? off : 0;
      d.left.position.x = this.doorX - 0.225 - o;
      d.right.position.x = this.doorX + 0.225 + o;
    }
  }

  /** @param {number} dt seconds */
  update(dt) {
    switch (this.state) {
      case 'idle':
        if (this.targetFloor !== null && this.targetFloor !== this.currentFloor) {
          this.state = 'moving';
        } else if (this.targetFloor !== null) {
          this.state = 'opening';
          this.targetFloor = null;
        }
        break;
      case 'opening':
        this.doorT = Math.min(1, this.doorT + dt / DOOR_TIME);
        if (this.doorT >= 1) {
          this.state = 'open';
          this.openTimer = 0;
          bus.emit('lift:arrived', { floor: this.currentFloor });
        }
        break;
      case 'open':
        this.openTimer += dt;
        if (this.openTimer > OPEN_HOLD && this.targetFloor === null) {
          this.state = 'closing';
          bus.emit('lift:panel-hide');
        }
        break;
      case 'closing':
        this.doorT = Math.max(0, this.doorT - dt / DOOR_TIME);
        if (this.doorT <= 0) {
          if (this.targetFloor !== null && this.targetFloor !== this.currentFloor) {
            this.state = 'moving';
          } else {
            this.state = 'idle';
            this.targetFloor = null;
          }
        }
        break;
      case 'moving': {
        const targetY = this.floorY(this.targetFloor);
        const dy = targetY - this.carY;
        const step = SPEED * dt;
        if (Math.abs(dy) <= step) {
          this.carY = targetY;
          this.currentFloor = this.targetFloor;
          this.targetFloor = null;
          this.state = 'opening';
        } else {
          this.carY += Math.sign(dy) * step;
        }
        this.car.position.y = this.carY;
        break;
      }
      default:
        break;
    }
    this._applyDoors();
  }

  dispose() { this.group.removeFromParent(); }
}

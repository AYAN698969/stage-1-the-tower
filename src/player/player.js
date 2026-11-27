/**
 * Player: movement + collision, stairs, lift riding, 3 camera modes
 * (first / third / second person), visible girl character, interaction
 * (proximity: NPC talk + light switches; raycast: doors, lift call
 * buttons, roof door), footsteps, location + objective.
 */
import * as THREE from 'three';
import { normalizeModel, findClip } from '../core/assets.js';
import { Collider2D, stairHeightAt, inStairwell } from '../core/collision.js';
import { bus } from '../core/events.js';
import { t } from '../i18n/strings.js';

const INTERACT_RANGE = 1.8;
const EYE = 1.6;
const RADIUS = 0.28;

export class Player {
  /**
   * @param {object} ctx { engine, input, building, floorplan, assets,
   *   colliders: {floor -> Collider2D}, doors, lift, roofDoor, mats }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.input;
    this.pos = new THREE.Vector3(ctx.building.spawn.x, 0, ctx.building.spawn.z);
    this.yaw = ctx.building.spawn.yaw || 0;
    this.pitch = 0;
    this.floor = 0;
    this.cameraMode = 'first';
    this.speed = 0;
    this.inLift = false;
    this.lastValid = this.pos.clone();
    this.lastValidFloor = 0;
    this.objectiveDone = false;
    this._stepAcc = 0;
    this._lastPos = this.pos.clone();
    this._ray = new THREE.Raycaster();
    this._ray.far = INTERACT_RANGE;
    this._center = new THREE.Vector2(0, 0);
    this._combined = new Collider2D(); // static + closed-door boxes, rebuilt per frame
    this._location = '';
    // Visible character (girl) for third/second person. The scene + clips
    // come pre-loaded fresh (see main.js) — do NOT clone() a skinned
    // character, SkeletonUtils.clone breaks these models.
    this.character = null;
    this.mixer = null;
    this.charClips = {};
    const obj = ctx.playerChar?.scene || null;
    if (obj) {
      this.character = normalizeModel(obj, [0.6, 1.7, 0.6]);
      this.character.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      this.character.visible = false;
      ctx.engine.scene.add(this.character);
      this.mixer = new THREE.AnimationMixer(this.character);
      const clips = ctx.playerChar.clips || [];
      this.charClips.idle = findClip(clips, 'idle');
      this.charClips.walk = findClip(clips, 'walking', 'walk');
      this.charClips.run = findClip(clips, 'running', 'run');
      this._charAction = null;
      this._playClip('idle');
    }
    bus.on('camera:toggle', () => this.toggleCamera());
  }

  _playClip(name) {
    if (!this.mixer || !this.charClips[name] || this._charClip === name) return;
    this._charClip = name;
    this._charAction?.stop();
    this._charAction = this.mixer.clipAction(this.charClips[name]);
    this._charAction.play();
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'first' ? 'third' : this.cameraMode === 'third' ? 'second' : 'first';
    bus.emit('ui:camera', { mode: this.cameraMode });
  }

  setCameraMode(mode) {
    if (['first', 'third', 'second'].includes(mode)) {
      this.cameraMode = mode;
      bus.emit('ui:camera', { mode });
    }
  }

  /** Teleport (debug + cutscenes). */
  teleport(x, z, floor = 0, yaw = null) {
    this.pos.set(x, floor * this.ctx.building.floorHeight, z);
    this.floor = floor;
    if (yaw !== null) this.yaw = yaw;
    this.inLift = false;
    this.lastValid.copy(this.pos);
    this.lastValidFloor = floor;
  }

  /** Current floor collider (static + furniture). */
  _collider() {
    return this.ctx.colliders[this.floor] || this.ctx.colliders[0];
  }

  /** @param {number} dt */
  update(dt) {
    const { input, building, floorplan: fp } = this.ctx;
    // --- look ---
    const look = input.takeLook();
    this.yaw -= look.x * 0.0028;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * 0.0028, -1.2, 1.2);
    // --- move ---
    const mv = input.moveVector();
    const sprint = input.sprinting();
    const targetSpeed = (mv.x !== 0 || mv.z !== 0) ? (sprint ? building.player.sprint : building.player.walk) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 8, dt);
    const sin = Math.sin(this.yaw); const cos = Math.cos(this.yaw);
    // Camera forward is (-sin yaw, 0, -cos yaw); move z is forward.
    const fwdX = -sin; const fwdZ = -cos;
    const rightX = cos; const rightZ = -sin;
    let dx = (fwdX * mv.z + rightX * mv.x) * this.speed * dt;
    let dz = (fwdZ * mv.z + rightZ * mv.x) * this.speed * dt;
    if (this.inLift) { dx = 0; dz = 0; } // riding: the lift moves the player

    // --- collision (static + closed doors in one move) ---
    const col = this._collider();
    const r = building.player.radius;
    if (!this.noclip) {
      this._combined.boxes.length = 0;
      for (const b of col.boxes) this._combined.boxes.push(b);
      for (const b of this.ctx.doors.getClosedBoxes(this.floor)) this._combined.boxes.push(b);
      const res = this._combined.move(this.pos.x, this.pos.z, dx, dz, r);
      this.pos.x = res.x;
      this.pos.z = res.z;
    } else {
      this.pos.x += dx;
      this.pos.z += dz;
    }

    // --- footsteps (one per stride while moving) ---
    const moved = Math.hypot(this.pos.x - this._lastPos.x, this.pos.z - this._lastPos.z);
    this._lastPos.copy(this.pos);
    if (this.speed > 0.5 && moved > 0) {
      this._stepAcc += moved;
      const stride = sprint ? 0.45 : 0.6;
      if (this._stepAcc >= stride) {
        this._stepAcc = 0;
        bus.emit('audio:footstep', { sprint });
      }
    }

    // --- stairs / floor height ---
    if (this.inLift) {
      this.pos.y = this.ctx.lift.carY;
      this.floor = this.ctx.lift.currentFloor;
    } else if (inStairwell(this.pos.x, this.pos.z, fp.stair)) {
      const h = stairHeightAt(this.pos.x, this.pos.z, fp.stair);
      const lap = Math.round((this.pos.y - h) / building.floorHeight);
      const clampedLap = THREE.MathUtils.clamp(lap, 0, building.floors - 1);
      this.pos.y = clampedLap * building.floorHeight + h;
      this.floor = clampedLap;
    } else {
      // Exiting the stairwell: snap to the nearest floor level.
      const f = Math.round(this.pos.y / building.floorHeight);
      this.floor = THREE.MathUtils.clamp(f, 0, building.floors);
      this.pos.y = this.floor * building.floorHeight;
    }

    // --- lift: step in / out ---
    const lift = this.ctx.lift;
    const insideCar = lift.containsPoint(this.pos.x, this.pos.z) && this.floor === lift.currentFloor;
    if (!this.inLift && insideCar && lift.doorT > 0.5) {
      this.inLift = true;
      bus.emit('lift:panel', { floors: [...Array(building.floors + 1).keys()], current: lift.currentFloor });
    }
    if (this.inLift && !insideCar) this.inLift = false;
    // Show the panel once when the lift arrives while the player is inside.
    if (this.inLift && lift.state === 'open' && this._liftState !== 'open') {
      bus.emit('lift:panel', { floors: [...Array(building.floors + 1).keys()], current: lift.currentFloor });
    }
    this._liftState = lift.state;

    // --- safety reset ---
    const insideWall = col.hits(this.pos.x, this.pos.z, 0);
    if (!insideWall && this.pos.y > -1) {
      this.lastValid.copy(this.pos);
      this.lastValidFloor = this.floor;
    } else {
      this.pos.copy(this.lastValid);
      this.floor = this.lastValidFloor;
      this.pos.y = this.floor * building.floorHeight;
    }

    // --- character ---
    if (this.character) {
      this.character.visible = this.cameraMode !== 'first';
      this.character.position.copy(this.pos);
      this.character.rotation.y = this.yaw + Math.PI;
      const moving = this.speed > 0.3;
      this._playClip(!moving ? 'idle' : this.speed > 3 ? 'run' : 'walk');
      this.mixer.update(dt);
    }

    // --- camera ---
    this._updateCamera();

    // --- interaction ---
    this._updateInteraction();

    // --- location + objective ---
    this._updateLocation();
  }

  _updateCamera() {
    const cam = this.ctx.engine.camera;
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
    if (this.cameraMode === 'first') {
      cam.position.copy(eye);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    // Conventions (see update(): camera forward is (-sin yaw, -cos yaw)).
    // (sin yaw, cos yaw) is BEHIND the character — where the third-person
    // camera sits; (-sin yaw, -cos yaw) is where she faces.
    const bx = Math.sin(this.yaw); const bz = Math.cos(this.yaw); // behind
    const fx = -bx; const fz = -bz; // facing
    const rx = -Math.cos(this.yaw); const rz = Math.sin(this.yaw); // left
    const shoulder = 0.45;
    const dist = 2.6;
    // Third-person: camera behind the character; second-person: camera in
    // front of her, looking back at her face.
    const dirX = this.cameraMode === 'third' ? bx : fx;
    const dirZ = this.cameraMode === 'third' ? bz : fz;
    // Over-the-shoulder view: the camera sits slightly to the character's
    // side so she is off-centre and the room ahead stays visible — without
    // this, in a small room the pulled-in camera is so close that she fills
    // the whole frame.
    const ox = dirX * dist + rx * shoulder;
    const oz = dirZ * dist + rz * shoulder;
    const len = Math.hypot(ox, oz);
    // Pull the camera in when a wall is behind the player (raycast in 2D
    // against the floor's static walls + closed doors), so the camera
    // never ends up inside a wall or a door in small rooms.
    let d = len;
    if (!this.noclip) {
      this._combined.boxes.length = 0;
      for (const b of this._collider().boxes) this._combined.boxes.push(b);
      for (const b of this.ctx.doors.getClosedBoxes(this.floor)) this._combined.boxes.push(b);
      const hit = this._combined.raycast(this.pos.x, this.pos.z, ox / len, oz / len, len);
      if (hit < Infinity) d = Math.max(0.5, hit - 0.25);
    }
    const s = d / len;
    const off = new THREE.Vector3(ox * s, 0, oz * s);
    // Look PAST the character in the direction she faces (third-person) or
    // at her face (second-person). The target must be on the far side of
    // the character from the camera — using a point behind her flips the
    // view when the pull-in distance drops below the look-ahead distance.
    const lookAhead = this.cameraMode === 'third' ? 1.2 : 0;
    const target = new THREE.Vector3(this.pos.x + fx * lookAhead, this.pos.y + 1.4, this.pos.z + fz * lookAhead);
    cam.position.set(this.pos.x + off.x, this.pos.y + 1.5, this.pos.z + off.z);
    cam.lookAt(target);
    // If the camera is pulled in very close, hide the character so she
    // doesn't fill the whole frame (the view is effectively first-person
    // until the player moves away from the wall).
    if (this.character) {
      this.character.visible = this.cameraMode !== 'first' && d >= 1.0;
    }
  }

  _updateInteraction() {
    const cam = this.ctx.engine.camera;
    let prompt = null;
    let target = null;
    // 1) Proximity: talk to an NPC, or use a light switch — nearest wins,
    // so a resident standing next to a switch doesn't shadow it.
    const npc = this.ctx.npcs?.nearest(this.pos);
    const sw = this._nearestSwitch();
    const npcD = npc ? Math.hypot(npc.pos.x - this.pos.x, npc.pos.z - this.pos.z) : Infinity;
    const swD = sw ? Math.hypot(sw.pos.x - this.pos.x, sw.pos.y - (this.pos.y + EYE), sw.pos.z - this.pos.z) : Infinity;
    if (npc && npcD <= swD) {
      prompt = t('promptTalkNpc', { name: npc.def.name_en || npc.def.id });
      target = { type: 'npc', npc };
    } else if (sw) {
      prompt = t('promptLightSwitch');
      target = { type: 'light', id: sw.id };
    }
    // 3) Crosshair raycast: doors, lift call buttons, roof door.
    if (!target) {
      this._ray.setFromCamera(this._center, cam);
      const targets = [this.ctx.doors.mesh, ...this.ctx.lift.callButtons];
      if (this.ctx.roofDoor) targets.push(this.ctx.roofDoor);
      const hits = this._ray.intersectObjects(targets, false);
      if (hits.length > 0) {
        const h = hits[0];
        if (h.object === this.ctx.doors.mesh) {
          const door = this.ctx.doors.doorFromInstanceId(h.instanceId);
          if (door && !door.auto) { prompt = 'Open door'; target = { type: 'door', door }; }
        } else if (h.object.userData?.type === 'lift-call') {
          prompt = 'Call lift';
          target = { type: 'lift-call', floor: h.object.userData.floor };
        } else if (h.object === this.ctx.roofDoor) {
          prompt = 'Roof door';
          target = { type: 'roof' };
        }
      }
    }
    if (prompt !== this._prompt) {
      this._prompt = prompt;
      bus.emit('ui:prompt', { text: prompt });
    }
    this._interactTarget = target;
    if (this.input.takeInteract() && target) {
      if (target.type === 'npc') {
        const def = target.npc.def;
        bus.emit('npc:talk', { id: def.id, name_en: def.name_en, name_bn: def.name_bn });
        bus.emit('mission:talk', { id: def.id });
      } else if (target.type === 'light') {
        bus.emit('light:toggle', { id: target.id });
      } else if (target.type === 'door') this.ctx.doors.toggle(target.door);
      else if (target.type === 'lift-call') this.ctx.lift.call(target.floor);
      else if (target.type === 'roof') bus.emit('ui:toast', { text: 'Roof access closed' });
    }
  }

  /** Nearest light switch within 1.6 m of the player (eye height). */
  _nearestSwitch() {
    const list = this.ctx.lightSwitches;
    if (!list) return null;
    const eyeY = this.pos.y + EYE;
    let best = null; let bestD = 1.6;
    for (const s of list) {
      const d = Math.hypot(s.pos.x - this.pos.x, s.pos.y - eyeY, s.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  _updateLocation() {
    const label = locate(this.pos.x, this.pos.z, this.floor, this.ctx.floorplan, this.ctx.building);
    if (label !== this._location) {
      this._location = label;
      bus.emit('ui:location', { text: label });
    }
    // Objective: reach flat 4B (living room) — the mission chain owns the
    // objective text now (see src/game/missions.js).
    if (!this.objectiveDone && this.floor === 4) {
      const flat = locateFlat(this.pos.x, this.pos.z, this.ctx.floorplan);
      if (flat === 'B') {
        this.objectiveDone = true;
        bus.emit('mission:flat');
      }
    }
  }

  dispose() {
    this.character?.removeFromParent();
  }
}

/** Human-readable location label for (x, z, floor). */
export function locate(x, z, floor, fp, building) {
  if (floor === 0) {
    if (z > 14) return 'Street';
    if (z > 7.62 || Math.abs(x) > 9.15) return 'Compound';
    if (x >= -2.75 && x <= 2.75 && z >= -7.62 && z <= 0) return 'Ground Floor — Lobby';
    return 'Ground Floor — Parking';
  }
  const flat = locateFlat(x, z, fp);
  if (flat) return `Floor ${floor} — Flat ${flat}`;
  if (x >= -2.75 && x <= 2.75 && z >= -7.62 && z <= 0) return `Floor ${floor} — Lobby`;
  return `Floor ${floor}`;
}

/** Which flat (A/B/C) contains (x,z), or null. */
export function locateFlat(x, z, fp) {
  for (const [key, flat] of Object.entries(fp.flats)) {
    for (const room of flat.rooms) {
      for (const [x0, z0, x1, z1] of room.rects) {
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return key;
      }
    }
  }
  return null;
}

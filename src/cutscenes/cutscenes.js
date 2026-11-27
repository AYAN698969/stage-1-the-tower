/**
 * Cutscenes: keyframe camera paths from config/cutscenes.json.
 * Skippable (Skip button / tap). While one plays, player input is off
 * and the cutscene drives the camera. baseY is added to every frame's
 * Y (the flat tour's frames are eye-height above its floor).
 */
import * as THREE from 'three';
import { bus } from '../core/events.js';

export class CutscenePlayer {
  /**
   * @param {object} ctx { engine, cutscenes, input }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.playing = null;
    this.t = 0;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  /** @param {string} name 'intro' | 'lift' | 'flat' @param {number} [baseY=0] */
  play(name, baseY = 0) {
    const def = this.ctx.cutscenes[name];
    if (!def) return false;
    this.playing = { def, baseY, duration: def.frames[def.frames.length - 1].t };
    this.t = 0;
    this.ctx.input.enabled = false;
    bus.emit('ui:cutscene', { label: def.label, playing: true });
    return true;
  }

  skip() {
    if (!this.playing) return;
    this._finish();
  }

  _finish() {
    this.playing = null;
    this.ctx.input.enabled = true;
    bus.emit('ui:cutscene', { playing: false });
    bus.emit('cutscene:done');
  }

  /** @param {number} dt @returns {boolean} true while a cutscene is playing */
  update(dt) {
    if (!this.playing) return false;
    this.t += dt;
    const { def, baseY, duration } = this.playing;
    if (this.t >= duration) {
      this._finish();
      return false;
    }
    const frames = def.frames;
    let i = 0;
    while (i < frames.length - 2 && this.t > frames[i + 1].t) i++;
    const a = frames[i]; const b = frames[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    let k = (this.t - a.t) / span;
    k = k * k * (3 - 2 * k); // smoothstep
    this._pos.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], k),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], k) + baseY,
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], k),
    );
    this._look.set(
      THREE.MathUtils.lerp(a.look[0], b.look[0], k),
      THREE.MathUtils.lerp(a.look[1], b.look[1], k) + baseY,
      THREE.MathUtils.lerp(a.look[2], b.look[2], k),
    );
    const cam = this.ctx.engine.camera;
    cam.position.copy(this._pos);
    cam.lookAt(this._look);
    return true;
  }

  dispose() { this.playing = null; }
}

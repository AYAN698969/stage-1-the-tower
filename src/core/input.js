/** Keyboard + mouse (pointer lock) + touch input state. UI wires touch controls in. */

export class Input {
  constructor() {
    this.keys = new Set();
    this.lookDX = 0; this.lookDY = 0;
    this.joyX = 0; this.joyY = 0; // -1..1, Y forward = -1 (up)
    this.interactQueued = false;
    this.sprintHeld = false;
    this.sprintToggle = false;
    this.pointerLocked = false;
    this.enabled = true;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintHeld = true;
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintHeld = false;
    };
    this._onMouseMove = (e) => {
      if (!this.pointerLocked || !this.enabled) return;
      this.lookDX += e.movementX || 0;
      this.lookDY += e.movementY || 0;
    };
    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
  }

  /** @param {HTMLCanvasElement} canvas */
  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    canvas.addEventListener('click', () => {
      if (!this.isTouch && this.enabled && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
  }

  /** Move vector in camera space: x = strafe right, z = forward. */
  moveVector() {
    let x = 0; let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    x += this.joyX;
    z += -this.joyY;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  sprinting() { return this.sprintHeld || this.sprintToggle; }

  /** Consume one frame of look delta (pixels). */
  takeLook() {
    const d = { x: this.lookDX, y: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return d;
  }

  takeInteract() {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  queueInteract() { this.interactQueued = true; }
  setJoystick(x, y) { this.joyX = x; this.joyY = y; }
  addLook(dx, dy) { this.lookDX += dx; this.lookDY += dy; }
  toggleSprint() { this.sprintToggle = !this.sprintToggle; return this.sprintToggle; }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}

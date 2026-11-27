/**
 * UI: HUD (crosshair, prompt, location, objective), touch controls
 * (joystick, look drag, Interact/Sprint/Camera/Menu buttons), pause menu,
 * mini-map plan view, lift floor panel, loading screen, toasts.
 * All text goes through the string dictionary (i18n/strings.js).
 */
import { t } from '../i18n/strings.js';
import { bus } from '../core/events.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export class UI {
  /**
   * @param {object} ctx { container, input, floorplan, building, engine }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.input;
    this.root = el('div', 'tower-ui', ctx.container);
    this.paused = false;
    this._mapFloor = -1;
    this._mapTimer = 0;
    this._build();
    this._bindBus();
  }

  _build() {
    const r = this.root;
    // Loading + tap-to-start overlay.
    this.loadingEl = el('div', 'tower-loading', r);
    el('div', 'tower-loading-title', this.loadingEl, 'Shanti Neer');
    el('div', 'tower-loading-sub', this.loadingEl, 'শান্তি নীড়');
    this.loadingBar = el('div', 'tower-loading-bar', this.loadingEl);
    this.loadingFill = el('div', 'tower-loading-fill', this.loadingBar);
    this.loadingText = el('div', 'tower-loading-text', this.loadingEl, t('loading'));
    this.startEl = el('button', 'tower-start', r, t('tapToStart'));
    // How-to-play panel on the start screen (shown with Tap to Start).
    this.howtoEl = el('div', 'tower-howto', r);
    el('div', 'tower-howto-title', this.howtoEl, t('howtoTitle'));
    for (const k of ['howtoWalk', 'howtoLook', 'howtoInteract', 'howtoSprint', 'howtoCamera', 'howtoSound']) {
      el('div', 'tower-howto-row', this.howtoEl, t(k));
    }
    this.howtoEl.style.display = 'none';
    this.startEl.style.display = 'none';
    // HUD.
    this.hud = el('div', 'tower-hud', r);
    this.crosshair = el('div', 'tower-crosshair', this.hud);
    this.locationEl = el('div', 'tower-location', this.hud, '');
    this.objectiveEl = el('div', 'tower-objective', this.hud, `${t('objective')}: ${t('objectiveText')}`);
    this.promptEl = el('div', 'tower-prompt', this.hud, '');
    this.toastEl = el('div', 'tower-toast', this.hud, '');
    this.liftIndicator = el('div', 'tower-lift-indicator', this.hud, '');
    this.liftIndicator.style.display = 'none';
    // NPC dialogue box (hidden until the player talks to someone).
    this.dialogueEl = el('div', 'tower-dialogue', r);
    this.dialogueName = el('div', 'tower-dialogue-name', this.dialogueEl, '');
    this.dialogueText = el('div', 'tower-dialogue-text', this.dialogueEl, '');
    this.dialogueBn = el('div', 'tower-dialogue-bn', this.dialogueEl, '');
    const dlgClose = el('button', 'tower-dialogue-close', this.dialogueEl, t('dialogueClose'));
    dlgClose.addEventListener('click', () => this._hideDialogue());
    this.dialogueEl.style.display = 'none';
    this.hintEl = el('div', 'tower-hint', this.hud, t('helpText'));
    // Mini-map.
    this.mapWrap = el('div', 'tower-map-wrap', this.hud);
    this.mapCanvas = el('canvas', 'tower-map', this.mapWrap);
    this.mapCanvas.width = 150; this.mapCanvas.height = 150;
    el('div', 'tower-map-label', this.mapWrap, t('youAreHere'));
    // Touch controls.
    this.touchEl = el('div', 'tower-touch', r);
    this.joyBase = el('div', 'tower-joy-base', this.touchEl);
    this.joyKnob = el('div', 'tower-joy-knob', this.joyBase);
    this.lookArea = el('div', 'tower-look', this.touchEl);
    this.btnInteract = el('button', 'tower-btn tower-btn-interact', this.touchEl, '');
    this.btnSprint = el('button', 'tower-btn tower-btn-sprint', this.touchEl, 'Sprint');
    this.btnCamera = el('button', 'tower-btn tower-btn-camera', this.touchEl, t('camera'));
    this.btnMenu = el('button', 'tower-btn tower-btn-menu', this.touchEl, t('menu'));
    this.btnMap = el('button', 'tower-btn tower-btn-map', this.touchEl, 'Map');
    // Cutscene skip.
    this.btnSkip = el('button', 'tower-btn tower-btn-skip', r, t('skip'));
    this.btnSkip.style.display = 'none';
    // Lift panel.
    this.liftPanel = el('div', 'tower-lift', r);
    el('div', 'tower-lift-title', this.liftPanel, t('promptLiftFloor'));
    this.liftBtns = el('div', 'tower-lift-btns', this.liftPanel);
    for (let f = 0; f <= this.ctx.building.floors; f++) {
      const b = el('button', 'tower-lift-btn', this.liftBtns, f === 0 ? 'G' : String(f));
      b.addEventListener('click', () => bus.emit('lift:select', { floor: f }));
    }
    this.liftPanel.style.display = 'none';
    // Pause menu.
    this.pauseEl = el('div', 'tower-pause', r);
    el('div', 'tower-pause-title', this.pauseEl, t('pause'));
    const resume = el('button', 'tower-pause-btn', this.pauseEl, t('resume'));
    resume.addEventListener('click', () => this.setPaused(false));
    this.soundBtn = el('button', 'tower-pause-btn', this.pauseEl, t('soundOn'));
    this.soundBtn.addEventListener('click', () => bus.emit('audio:mute'));
    const help = el('button', 'tower-pause-btn', this.pauseEl, t('help'));
    help.addEventListener('click', () => { this.hintEl.style.display = 'block'; setTimeout(() => { this.hintEl.style.display = 'none'; }, 5000); });
    const quality = el('div', 'tower-quality', this.pauseEl);
    el('span', '', quality, `${t('quality')}: `);
    for (const q of ['low', 'med', 'high']) {
      const b = el('button', 'tower-quality-btn', quality, t(`quality${q[0].toUpperCase()}${q.slice(1)}`));
      b.addEventListener('click', () => bus.emit('quality:set', { quality: q }));
    }
    const restart = el('button', 'tower-pause-btn', this.pauseEl, t('restart'));
    restart.addEventListener('click', () => location.reload());
    this.pauseEl.style.display = 'none';
    // Wire the buttons.
    this.btnInteract.addEventListener('click', () => this.input.queueInteract());
    this.btnSprint.addEventListener('click', () => {
      const on = this.input.toggleSprint();
      this.btnSprint.classList.toggle('on', on);
    });
    this.btnCamera.addEventListener('click', () => bus.emit('camera:toggle'));
    this.btnMenu.addEventListener('click', () => this.setPaused(true));
    this.btnMap.addEventListener('click', () => {
      this.mapWrap.style.display = this.mapWrap.style.display === 'none' ? 'block' : 'none';
    });
    this.btnSkip.addEventListener('click', () => bus.emit('cutscene:skip'));
    this.startEl.addEventListener('click', () => bus.emit('game:start'));
    this._bindTouch();
    // Hide the touch controls on non-touch devices.
    if (!this.input.isTouch) this.touchEl.classList.add('no-touch');
    // Dismiss the controls hint after a while.
    setTimeout(() => { this.hintEl.style.display = 'none'; }, 9000);
  }

  _bindTouch() {
    // Joystick (left bottom): pointer drag sets the move vector.
    const joy = this.joyBase;
    let joyId = null;
    const joyCenter = () => {
      const r = joy.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    };
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      joy.setPointerCapture(joyId);
      this._joyMove(e, joyCenter());
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) this._joyMove(e, joyCenter()); });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      this.input.setJoystick(0, 0);
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
    };
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);
    // Look area (right half): drag to look.
    let lookId = null; let lx = 0; let ly = 0;
    this.lookArea.addEventListener('pointerdown', (e) => {
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      this.lookArea.setPointerCapture(lookId);
    });
    this.lookArea.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.input.addLook((e.clientX - lx) * 2.2, (e.clientY - ly) * 2.2);
      lx = e.clientX; ly = e.clientY;
    });
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
    this.lookArea.addEventListener('pointerup', lookEnd);
    this.lookArea.addEventListener('pointercancel', lookEnd);
  }

  _joyMove(e, c) {
    let dx = (e.clientX - c.x) / c.r;
    let dy = (e.clientY - c.y) / c.r;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.input.setJoystick(dx, dy);
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
  }

  _bindBus() {
    bus.on('ui:prompt', ({ text }) => {
      this.promptEl.textContent = text || '';
      this.btnInteract.style.display = text ? 'block' : 'none';
      this.btnInteract.textContent = text || '';
    });
    bus.on('ui:location', ({ text }) => { this.locationEl.textContent = text; });
    bus.on('ui:toast', ({ text }) => {
      this.toastEl.textContent = text;
      this.toastEl.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2500);
    });
    bus.on('ui:camera', ({ mode }) => {
      this.btnCamera.textContent = `${t('camera')}: ${t(mode === 'first' ? 'camFirst' : mode === 'third' ? 'camThird' : 'camSecond')}`;
    });
    bus.on('ui:cutscene', ({ playing }) => {
      this.btnSkip.style.display = playing ? 'block' : 'none';
    });
    // Lift floor indicator: shows the current floor while riding.
    this._lastLiftFloor = 0;
    const showFloor = (f) => {
      this._lastLiftFloor = f;
      this.liftIndicator.textContent = f === 0 ? t('liftGround') : t('locationFloor', { n: f });
      this.liftIndicator.style.display = f > 0 ? 'block' : 'none';
    };
    bus.on('lift:arrived', ({ floor }) => showFloor(Number(floor)));
    bus.on('lift:panel', ({ current }) => {
      this.liftPanel.style.display = 'block';
      if (current != null) {
        this._lastLiftFloor = current;
        this.liftIndicator.textContent = current === 0 ? t('liftGround') : t('locationFloor', { n: current });
        this.liftIndicator.style.display = 'block';
      }
    });
    bus.on('lift:panel-hide', () => {
      this.liftPanel.style.display = 'none';
      if (this._lastLiftFloor === 0) this.liftIndicator.style.display = 'none';
    });
    // NPC dialogue box.
    bus.on('npc:talk', ({ id, name_en, name_bn }) => {
      const key = `greet${id[0].toUpperCase()}${id.slice(1)}`;
      this.dialogueName.textContent = name_bn ? `${name_en} · ${name_bn}` : (name_en || id);
      this.dialogueText.textContent = t(key);
      this.dialogueBn.textContent = t(`${key}Bn`);
      this.dialogueEl.style.display = 'block';
      clearTimeout(this._dlgTimer);
      this._dlgTimer = setTimeout(() => this._hideDialogue(), 8000);
    });
    // Mission chain objective text.
    bus.on('mission:objective', ({ text, done }) => {
      this.objectiveEl.textContent = done ? `✓ ${text}` : text;
      this.objectiveEl.classList.toggle('done', done);
    });
    // Sound toggle label.
    bus.on('audio:muted', ({ muted }) => {
      if (this.soundBtn) this.soundBtn.textContent = muted ? t('soundOff') : t('soundOn');
    });
    bus.on('cutscene:skip', () => { this.btnSkip.style.display = 'none'; });
  }

  _hideDialogue() {
    this.dialogueEl.style.display = 'none';
    clearTimeout(this._dlgTimer);
  }

  /** Loading progress 0..1. */
  setProgress(done, total, name) {
    const p = total ? done / total : 0;
    this.loadingFill.style.width = `${Math.round(p * 100)}%`;
    this.loadingText.textContent = `${t('loading')} ${Math.round(p * 100)}%`;
  }

  /** Loading done: show the Tap to Start button + how-to panel. */
  ready() {
    this.loadingEl.style.display = 'none';
    this.startEl.style.display = 'block';
    this.howtoEl.style.display = 'grid';
  }

  /** Game started: hide the start button + how-to panel, show the HUD. */
  started() {
    this.startEl.style.display = 'none';
    this.howtoEl.style.display = 'none';
    this.hud.style.display = 'block';
  }

  setPaused(p) {
    this.paused = p;
    this.pauseEl.style.display = p ? 'block' : 'none';
    bus.emit('game:pause', { paused: p });
  }

  /** @param {number} dt @param {{x:number,z:number,yaw:number,floor:number}} player */
  update(dt, player) {
    if (!player) return;
    this._mapTimer += dt;
    if (this._mapTimer > 0.25 || player.floor !== this._mapFloor) {
      this._mapTimer = 0;
      this._drawMap(player);
    }
  }

  _drawMap(player) {
    const fp = this.ctx.floorplan;
    const c = this.mapCanvas.getContext('2d');
    const W = this.mapCanvas.width; const H = this.mapCanvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(20,24,20,0.55)';
    c.fillRect(0, 0, W, H);
    // Fit the footprint (18.29 x 15.24) into the canvas.
    const s = Math.min(W / 20, H / 17);
    const ox = (W - 18.29 * s) / 2; const oy = (H - 15.24 * s) / 2;
    const X = (x) => ox + (x + 9.15) * s;
    const Z = (z) => oy + (z + 7.62) * s;
    c.strokeStyle = '#e8e0cc';
    c.lineWidth = 1.5;
    c.strokeRect(X(-9.15), Z(-7.62), 18.29 * s, 15.24 * s);
    if (player.floor === 0) {
      c.fillStyle = '#8a7a5f';
      c.fillRect(X(-2.75), Z(-7.62), 5.5 * s, 7.62 * s);
    } else {
      for (const flat of Object.values(fp.flats)) {
        for (const room of flat.rooms) {
          for (const [x0, z0, x1, z1] of room.rects) {
            c.strokeStyle = room.type === 'veranda' ? '#9ec49a' : '#cfc4a8';
            c.strokeRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s);
          }
        }
      }
      c.fillStyle = '#b5533c';
      c.fillRect(X(-2.75), Z(-7.62), 5.5 * s, 3.66 * s);
    }
    // Player dot + facing.
    const px = X(player.x); const pz = Z(player.z);
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(px, pz, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffd23f';
    c.beginPath();
    c.moveTo(px, pz);
    c.lineTo(px - Math.sin(player.yaw) * 10, pz - Math.cos(player.yaw) * 10);
    c.stroke();
    this._mapFloor = player.floor;
  }

  dispose() { this.root.remove(); }
}

/**
 * Light procedural ambience (WebAudio, no audio files): soft filtered
 * noise for a morning breeze + occasional synthesized bird chirps,
 * a gentle pentatonic music loop, lift ding, footsteps and door sounds.
 * Starts on the first user gesture (Tap to Start). M toggles mute.
 */
import { bus } from '../core/events.js';

// C major pentatonic, for the gentle music loop.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25];

export class AudioAmbience {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._birdTimer = null;
    this._musicTimer = null;
    this._lastStep = 0;
    bus.on('game:start', () => this.start());
    bus.on('audio:mute', () => this.toggleMute());
    bus.on('lift:arrived', () => this.ding());
    bus.on('audio:footstep', ({ sprint } = {}) => this.footstep(!!sprint));
    bus.on('audio:door', () => this.doorSound());
    bus.on('audio:click', () => this.click());
  }

  start() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Shared 2 s noise buffer (breeze + footsteps + door).
      const len = this.ctx.sampleRate * 2;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // Breeze: looped noise through a low-pass filter, slow LFO on the gain.
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf; src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      // Occasional bird chirps (a few short sine blips).
      const chirp = () => {
        if (!this.ctx || this.muted) return;
        const t0 = this.ctx.currentTime + 0.05;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0, t0);
        const f = 2200 + Math.random() * 1200;
        o.frequency.setValueAtTime(f, t0);
        o.frequency.exponentialRampToValueAtTime(f * 1.4, t0 + 0.08);
        o.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + 0.16);
        og.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
        og.gain.linearRampToValueAtTime(0, t0 + 0.2);
        o.connect(og); og.connect(this.master);
        o.start(t0); o.stop(t0 + 0.25);
      };
      const schedule = () => {
        chirp();
        if (Math.random() < 0.5) setTimeout(chirp, 180);
        this._birdTimer = setTimeout(schedule, 4000 + Math.random() * 8000);
      };
      this._birdTimer = setTimeout(schedule, 2000);
      // Gentle music: soft pad + slow pentatonic plucks.
      this._startMusic();
    } catch (e) {
      console.warn('[audio] unavailable', e);
    }
  }

  /** Soft pad (two detuned triangles) + a slow random-walk melody. */
  _startMusic() {
    const ctx = this.ctx;
    // Pad: C3 + G3, very quiet, slow breathing gain.
    const padGain = ctx.createGain();
    padGain.gain.value = 0.018;
    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.05;
    const padLfoGain = ctx.createGain();
    padLfoGain.gain.value = 0.008;
    padLfo.connect(padLfoGain); padLfoGain.connect(padGain.gain);
    for (const f of [130.81, 196.0]) {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      o.connect(padGain); o.start();
    }
    padGain.connect(this.master);
    padLfo.start();
    // Melody: one soft pluck every ~0.9 s, random-walk on the pentatonic.
    let idx = 3;
    const pluck = () => {
      if (!ctx) return;
      idx = Math.max(0, Math.min(PENTA.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0)));
      const t0 = ctx.currentTime + 0.02;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = PENTA[idx];
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t0);
      og.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      o.connect(og); og.connect(this.master);
      o.start(t0); o.stop(t0 + 1.5);
      this._musicTimer = setTimeout(pluck, 700 + Math.random() * 600);
    };
    this._musicTimer = setTimeout(pluck, 1200);
  }

  /** Two-note lift ding (E6 then B5, soft). */
  ding() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.02;
    for (const [i, f] of [[0, 1318.5], [1, 987.77]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const og = this.ctx.createGain();
      const t = t0 + i * 0.35;
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.1, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(og); og.connect(this.master);
      o.start(t); o.stop(t + 0.55);
    }
  }

  /** Short soft footstep (filtered noise burst). */
  footstep(sprint) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this._lastStep < 120) return;
    this._lastStep = now;
    const t0 = this.ctx.currentTime + 0.01;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.3;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = sprint ? 700 : 450; filt.Q.value = 1.2;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.09, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    src.connect(filt); filt.connect(og); og.connect(this.master);
    src.start(t0, Math.random()); src.stop(t0 + 0.1);
  }

  /** Wooden door slide: soft noise sweep + low thump. */
  doorSound() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.01;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, t0);
    filt.frequency.exponentialRampToValueAtTime(250, t0 + 0.22);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.08, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    src.connect(filt); filt.connect(og); og.connect(this.master);
    src.start(t0, Math.random()); src.stop(t0 + 0.3);
    const thump = this.ctx.createOscillator();
    thump.type = 'sine'; thump.frequency.value = 90;
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.06, t0 + 0.18);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    thump.connect(tg); tg.connect(this.master);
    thump.start(t0 + 0.18); thump.stop(t0 + 0.32);
  }

  /** Short switch click (light switch / UI). */
  click() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + 0.01;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 1800;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.04, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    o.connect(og); og.connect(this.master);
    o.start(t0); o.stop(t0 + 0.06);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    bus.emit('ui:toast', { text: this.muted ? 'Muted' : 'Sound on' });
    bus.emit('audio:muted', { muted: this.muted });
    return this.muted;
  }

  dispose() {
    clearTimeout(this._birdTimer);
    clearTimeout(this._musicTimer);
    this.ctx?.close();
    this.ctx = null;
  }
}

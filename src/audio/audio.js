/**
 * Light procedural ambience (WebAudio, no audio files): soft filtered
 * noise for a morning breeze + occasional synthesized bird chirps.
 * Starts on the first user gesture (Tap to Start). M toggles mute.
 */
import { bus } from '../core/events.js';

export class AudioAmbience {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._birdTimer = null;
    bus.on('game:start', () => this.start());
    bus.on('audio:mute', () => this.toggleMute());
  }

  start() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Breeze: looped noise through a low-pass filter, slow LFO on the gain.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
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
    } catch (e) {
      console.warn('[audio] unavailable', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    bus.emit('ui:toast', { text: this.muted ? 'Muted' : 'Sound on' });
    return this.muted;
  }

  dispose() {
    clearTimeout(this._birdTimer);
    this.ctx?.close();
    this.ctx = null;
  }
}

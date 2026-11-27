/**
 * Simple 3-step mission chain (the user asked for game logic):
 *  1. Talk to the guard in the lobby
 *  2. Go to flat 4B (lift -> Floor 4)
 *  3. Turn on the light in flat 4B
 * Each step updates the objective text; finishing shows a toast.
 * Steps only advance in order, so the player cannot skip ahead.
 */
import { bus } from '../core/events.js';
import { t } from '../i18n/strings.js';

export class Missions {
  constructor() {
    this.step = 0;
    this.done = false;
    bus.on('mission:talk', ({ id }) => {
      if (this.step === 0 && id === 'guard') this._advance();
    });
    bus.on('mission:flat', () => {
      if (this.step === 1) this._advance();
    });
    bus.on('mission:light', () => {
      if (this.step === 2) this._advance();
    });
    this._emit();
  }

  _emit() {
    const text = this.done ? t('missionDone') : t(`missionStep${this.step + 1}`);
    bus.emit('mission:objective', { step: this.step, done: this.done, text });
  }

  _advance() {
    this.step++;
    if (this.step >= 3) {
      this.done = true;
      bus.emit('ui:toast', { text: t('missionDone') });
    }
    this._emit();
  }
}

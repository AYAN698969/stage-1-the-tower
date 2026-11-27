/**
 * Verifies the lift floor indicator on a real ride to floor 4.
 * Tiny viewport so headless software rendering runs faster; waits for
 * the lift state to be 'open' before clicking a floor button (select()
 * ignores clicks while the doors are still opening).
 * Usage: CDP_PORT=9223 node test/lift-ride-check.mjs
 */
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({ onConsole: () => {}, onException: (p) => console.log('EXC:', p.exceptionDetails?.text), onLog: () => {} });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 240, height: 135, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: GAME });

let ready = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  try {
    const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
    if (s === 'ready') { ready = true; break; }
  } catch (e) { /* keep waiting */ }
}
if (!ready) throw new Error('game did not become ready');
console.log('game ready');
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
await sleep(1000);

const liftState = () => evalJs(send, `(() => { const l = window.__game._player.ctx.lift; return JSON.stringify({ state: l.state, doorT: +l.doorT.toFixed(2), floor: l.currentFloor, carY: +l.carY.toFixed(2) }); })()`, true);
const indicator = () => evalJs(send, `(() => { const el = document.querySelector('.tower-lift-indicator'); return JSON.stringify({ text: el?.textContent || '', display: getComputedStyle(el).display }); })()`, true);
const panelDisplay = () => evalJs(send, `getComputedStyle(document.querySelector('.tower-lift')).display`);

// Call the lift from floor 0 (aim down at the button: positive pitch looks UP).
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game._player.pitch = -0.45; window.__game.teleport(2.68, -4.5, 0, 0); 'ok'`);
await sleep(2000);
await evalJs(send, `window.__game._player.input.queueInteract(); 'ok'`);
let ls = '{}';
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  ls = await liftState();
  if (JSON.parse(ls).doorT > 0.5) break;
}
console.log('lift after call:', ls);

// Step into the car; wait for the panel AND for the lift to be fully 'open'.
await evalJs(send, `window.__game.teleport(1.83, -6.55, 0, 0); 'ok'`);
let panel = 'none';
for (let i = 0; i < 45; i++) {
  await sleep(2000);
  panel = await panelDisplay();
  if (panel !== 'none') break;
}
console.log('lift panel:', panel, '| indicator at ground:', await indicator());
for (let i = 0; i < 45; i++) {
  await sleep(2000);
  ls = await liftState();
  if (JSON.parse(ls).state === 'open') break;
}
console.log('lift state before clicking floor 4:', ls);

// Click floor 4 and ride up.
await evalJs(send, `document.querySelectorAll('.tower-lift-btn')[4]?.click(); 'ok'`);
await sleep(2000);
console.log('lift state right after click:', await liftState());
let ind = '{}';
for (let i = 0; i < 300; i++) {
  await sleep(2000);
  ind = await indicator();
  if (JSON.parse(ind).text.includes('4')) break;
}
console.log('lift indicator after ride:', ind, '| lift state:', await liftState());
console.log('LIFT RIDE CHECK DONE');
process.exit(0);

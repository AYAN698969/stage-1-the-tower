/**
 * Fast verification (no screenshots): checks the three new prop models
 * exist at their placed positions (scene-graph query) and that the lift
 * floor indicator updates on a real lift ride.
 * Uses a small viewport so headless software rendering runs faster.
 * Usage: CDP_PORT=9223 node test/verify-check.mjs
 */
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({ onConsole: () => {}, onException: (p) => console.log('EXC:', p.exceptionDetails?.text), onLog: () => {} });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 270, deviceScaleFactor: 1, mobile: true });
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

// 1) Prop meshes at their placed world positions (floor 4 => y + 12.2).
const props = await evalJs(send, `(() => {
  const scene = window.__game._engine.scene;
  scene.updateMatrixWorld(true);
  const near = (x, y, z, r) => {
    let n = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const e = o.matrixWorld.elements;
      const d = Math.hypot(e[12] - x, e[13] - y, e[14] - z);
      if (d < r) n++;
    });
    return n;
  };
  return JSON.stringify({
    ac4B: near(-3.0, 14.4, 6.58, 0.6),
    rack4B: near(-3.0, 12.7, 7.01, 0.6),
    curtains4A: near(-4.2, 13.55, -7.5, 0.6),
    switch4B: near(0.8, 13.45, 0.06, 0.3),
  });
})()`, true);
console.log('prop meshes near placed positions:', props);

await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
await sleep(1000);

const liftState = () => evalJs(send, `(() => { const l = window.__game._player.ctx.lift; return JSON.stringify({ state: l.state, doorT: +l.doorT.toFixed(2), floor: l.currentFloor }); })()`, true);
const panelDisplay = () => evalJs(send, `getComputedStyle(document.querySelector('.tower-lift')).display`);
const indicator = () => evalJs(send, `(() => { const el = document.querySelector('.tower-lift-indicator'); return JSON.stringify({ text: el?.textContent || '', display: getComputedStyle(el).display }); })()`, true);

// 2) Call the lift from floor 0 (aim down at the button: positive pitch looks UP).
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game._player.pitch = -0.45; window.__game.teleport(2.68, -4.5, 0, 0); 'ok'`);
await sleep(2000);
await evalJs(send, `window.__game._player.input.queueInteract(); 'ok'`);
let ls = '{}';
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  ls = await liftState();
  if (JSON.parse(ls).doorT > 0.5) break;
}
console.log('lift after call (doorT > 0.5 expected):', ls);

// 3) Step into the car: the floor-select panel should open.
await evalJs(send, `window.__game.teleport(1.83, -6.55, 0, 0); 'ok'`);
let panel = 'none';
for (let i = 0; i < 30; i++) {
  await sleep(2000);
  panel = await panelDisplay();
  if (panel !== 'none') break;
}
console.log('lift panel after stepping in:', panel, '| indicator at ground:', await indicator());

// 4) Choose floor 4 from the panel and ride up.
await evalJs(send, `document.querySelectorAll('.tower-lift-btn')[4]?.click(); 'ok'`);
let ind = '{}';
for (let i = 0; i < 150; i++) {
  await sleep(2000);
  ind = await indicator();
  if (JSON.parse(ind).text.includes('4')) break;
}
console.log('lift indicator after ride:', ind, '| lift state:', await liftState());
console.log('VERIFY CHECK DONE');
process.exit(0);

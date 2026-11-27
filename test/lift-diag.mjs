/**
 * Diagnose the lift call-button interaction headlessly.
 * Usage: CDP_PORT=9223 node test/lift-diag.mjs
 */
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({ onConsole: () => {}, onException: (p) => console.log('EXC:', p.exceptionDetails?.text), onLog: () => {} });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
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

const state = () => evalJs(send, `(() => {
  const p = window.__game._player;
  return JSON.stringify({
    pos: [p.pos.x.toFixed(2), p.pos.y.toFixed(2), p.pos.z.toFixed(2)],
    floor: p.floor, yaw: p.yaw.toFixed(2), pitch: p.pitch.toFixed(2),
    prompt: p._prompt, target: p._interactTarget?.type || null,
    inLift: p.inLift,
    lift: [p.ctx.lift.state, p.ctx.lift.doorT.toFixed(2), p.ctx.lift.currentFloor, p.ctx.lift.carY.toFixed(2)].join('/'),
    panel: getComputedStyle(document.querySelector('.tower-lift')).display,
    indicator: document.querySelector('.tower-lift-indicator')?.textContent || '',
  });
})()`, true);

await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game._player.pitch = -0.45; window.__game.teleport(2.68, -4.5, 0, 0); 'ok'`);
for (let i = 0; i < 6; i++) {
  await sleep(1000);
  console.log('before interact:', await state());
  if ((JSON.parse(await state())).prompt) break;
}
await evalJs(send, `window.__game._player.input.queueInteract(); 'ok'`);
for (let i = 0; i < 6; i++) {
  await sleep(1000);
  console.log('after interact:', await state());
}
await evalJs(send, `window.__game.teleport(1.83, -6.55, 0, 0); 'ok'`);
for (let i = 0; i < 8; i++) {
  await sleep(1000);
  console.log('in car:', await state());
}
console.log('LIFT DIAG DONE');
process.exit(0);

/** Visual check: the parked auto-rickshaw (CNG) at (-8, 17.8) and the moving one. */
import { connectCDP, evalJs, sleep } from './cdp.mjs';
import fs from 'node:fs';

const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({
  onConsole: (p) => {
    const t = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (p.type === 'error') console.log('[console.error]', t.slice(0, 300));
  },
});
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: GAME });
let ready = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
  if (s === 'ready') { ready = true; break; }
}
if (!ready) throw new Error('game did not become ready');
console.log('game ready');
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
for (let i = 0; i < 20; i++) {
  await sleep(500);
  const p = await evalJs(send, `window.__game._cutscenes.playing ? 'playing' : 'stopped'`);
  if (p === 'stopped') break;
}
// Face west from spawn: the parked CNG is at (-8, 17.8). Facing (-sin yaw, -cos yaw);
// yaw = PI/2 gives facing (-1, 0) = west.
await evalJs(send, `window.__game.teleport(0, 20, 0, Math.PI / 2); 'ok'`);
await sleep(1000);
await send('Page.captureScreenshot', { format: 'png' }).then((r) => {
  fs.writeFileSync('test/smoke/cng-parked.png', Buffer.from(r.data, 'base64'));
  console.log('shot saved test/smoke/cng-parked.png');
});
// Confirm the auto-rickshaw model is in the scene (count meshes using it).
const info = await evalJs(send, `JSON.stringify((() => {
  const scene = window.__game._engine.scene;
  let found = 0;
  scene.traverse((o) => { if (o.userData && o.userData.model === 'cng_tuktuk') found++; });
  return { cngNodes: found };
})())`);
console.log('cng check:', info);
process.exit(0);

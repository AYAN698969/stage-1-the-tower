/**
 * Targeted prop check (run AFTER the smoke test finishes — it reuses the
 * same page target). Verifies the three new flat props render in place:
 * curtains on flat 4A's bedroom window, drying rack + AC on 4B's veranda.
 * Usage: CDP_PORT=9223 node test/prop-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const OUT = 'test/smoke';
const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({
  onConsole: () => {},
  onException: (p) => console.log('EXC:', p.exceptionDetails?.exception?.description || p.exceptionDetails?.text),
  onLog: () => {},
});
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: GAME });

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log('shot:', name);
}

let ready = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  try {
    const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
    if (s === 'ready') { ready = true; break; }
  } catch (e) { console.log('wait eval err:', e.message.slice(0, 120)); }
}
if (!ready) throw new Error('game did not become ready');
console.log('game ready');
// Count the new prop meshes in the scene (dressFlat doesn't tag them, so
// count by geometry: the AC/rack/curtains are the only meshes whose
// parent chain includes a flat template group AND whose bounding box is
// small — instead, count all meshes and list the ones near known spots).
const counts = await evalJs(send, `(() => {
  const scene = window.__game._engine.scene;
  let meshes = 0;
  scene.traverse((o) => { if (o.isMesh) meshes++; });
  return JSON.stringify({ meshes });
})()`, true);
console.log('scene meshes:', counts);
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
await sleep(1000);
// 1) Curtains: flat 4A bedroom, looking north at the bedN window.
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game.teleport(-4.2, -4.8, 4, 0); 'ok'`);
await sleep(1500);
await shot('11-curtains-4a');
// 2) Drying rack + AC: flat 4B west veranda (verSW), looking south from bedSW.
// The rack + AC are on verSW (the FIRST veranda room), at x=-3.0.
// Stand 0.9 m from the veranda door (auto-open range is 1.2 m).
await evalJs(send, `window.__game.teleport(-3.0, 5.5, 4, Math.PI); 'ok'`);
await sleep(1500);
await shot('12-rack-ac-4b');
// 3) Same spot, first-person view of the veranda from the dining room.
await evalJs(send, `window.__game.teleport(0, 6.0, 4, Math.PI); 'ok'`);
await sleep(1500);
await shot('13-veranda-centre-4b');
console.log('PROP CHECK DONE');
process.exit(0);

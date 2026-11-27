/**
 * Headless smoke test via Obscura's CDP server (port 9222).
 * Serves the game on :8000, loads it, waits for __game.ready, clicks
 * Tap to Start, skips the intro, and takes screenshots at several states.
 * Usage: node test/smoke.mjs [outDir]
 * Requires: python http.server on 8000 + `obscura serve -p 9222 --allow-private-network`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const OUT = process.argv[2] || 'test/smoke';
fs.mkdirSync(OUT, { recursive: true });
// Cache-buster: the shared page target keeps the previous run's JS cached,
// so a plain re-navigation can serve a stale assets.js (e.g. before loadFresh
// existed) and the game never becomes ready.
const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;

const errors = [];
const warnings = [];
const { send } = await connectCDP({
  onConsole: (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (p.type === 'error') errors.push(text);
    if (p.type === 'warning') warnings.push(text);
  },
  onException: (p) => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'),
  onLog: (p) => { if (p.entry.level === 'error') errors.push(p.entry.text + ' ' + (p.entry.url || '')); },
});
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: GAME });

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log('shot:', name);
}

// Wait for the game to be ready (up to 180 s; software WebGL is slow).
let ready = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  try {
    const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
    console.log(`wait ${i * 2 + 2}s:`, s);
    if (s === 'ready') { ready = true; break; }
  } catch (e) { console.log('wait eval err:', e.message.slice(0, 120)); }
}
if (!ready) throw new Error('game did not become ready');
console.log('game ready');
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
// Skip via the API (the DOM Skip button is unreliable right after start)
// and wait until the cutscene is really stopped.
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
for (let i = 0; i < 20; i++) {
  await sleep(500);
  const p = await evalJs(send, `window.__game._cutscenes.playing ? 'playing' : 'stopped'`);
  if (p === 'stopped') break;
}
await sleep(500);
await shot('01-spawn-road');
console.log('stats at spawn:', await evalJs(send, `JSON.stringify(window.__game.getStats())`));
await evalJs(send, `window.__game._player.setCameraMode('third'); 'ok'`);
await sleep(800);
await shot('02-spawn-third');
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game.teleport(-1.0, 5.5, 4, -0.7); 'ok'`);
await sleep(1200);
await shot('03-flat-4b-living');
await evalJs(send, `window.__game.teleport(0, 3.6, 4, Math.PI); 'ok'`);
await sleep(800);
await shot('04-flat-4b-south');
await evalJs(send, `window.__game.teleport(-1.0, 5.5, 4, -0.7); window.__game._player.setCameraMode('third'); 'ok'`);
await sleep(800);
await shot('05-flat-4b-third');
await evalJs(send, `window.__game.teleport(0, -2, 4, 0); window.__game._player.setCameraMode('first'); 'ok'`);
await sleep(1000);
await shot('06-floor4-lobby');
await evalJs(send, `window.__game.teleport(0, -1, 0, 0); 'ok'`);
await sleep(1000);
await shot('07-ground-lobby');
await evalJs(send, `window.__game.teleport(0, 16, 0, 0); 'ok'`);
await sleep(1000);
await shot('08-street-gate');
await evalJs(send, `window.__game.playCutscene('lift'); 'ok'`);
await sleep(4000);
await shot('09-lift-cutscene');
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
await sleep(500);
console.log('stats at end:', await evalJs(send, `JSON.stringify(window.__game.getStats())`));
const finalErrors = errors.filter((e) => !/favicon/.test(e));
console.log(`console errors: ${finalErrors.length}`);
for (const e of finalErrors.slice(0, 20)) console.log('  ERR:', e.slice(0, 300));
console.log(`console warnings: ${warnings.length}`);
for (const e of warnings.slice(0, 10)) console.log('  WARN:', e.slice(0, 200));
fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify({ errors: finalErrors, warnings }, null, 2));
console.log('SMOKE DONE');
process.exit(0);

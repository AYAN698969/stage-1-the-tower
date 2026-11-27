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
// Polish checks (start screen, before Tap to Start).
const startChecks = await evalJs(send, `(() => {
  const howto = document.querySelector('.tower-howto');
  const objective = document.querySelector('.tower-objective')?.textContent || '';
  const skyline = window.__game._engine.scene.getObjectByName('skyline');
  const npcs = window.__game._engine.scene.getObjectByName('npcs');
  return JSON.stringify({
    howtoVisible: howto && getComputedStyle(howto).display !== 'none',
    howtoRows: document.querySelectorAll('.tower-howto-row').length,
    objective,
    skylinePresent: !!skyline,
    skyDome: !!skyline?.getObjectByName('sky-dome'),
    skylineBuildings: !!skyline?.getObjectByName('skyline-buildings'),
    npcCount: npcs ? npcs.children.length : -1,
  });
})()`, true);
console.log('start checks:', startChecks);
await shot('00-start-screen');
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
// NPC dialogue: walk up to the guard and Interact (mission step 1).
// Stand 0.7 m from the guard (walker1's path is at z=15, so it stays
// out of the 2.2 m talk range); first person so the boundary wall
// behind the player can't fill the frame.
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game.teleport(-7.6, 12.3, 0, 0); 'ok'`);
await sleep(1000);
await evalJs(send, `window.__game._player.input.queueInteract(); 'ok'`);
// Poll: software rendering runs few frames per second, so a fixed 600 ms
// wait can land before any frame processes the interact.
let talkCheck = '{}';
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  talkCheck = await evalJs(send, `(() => {
    const dlg = document.querySelector('.tower-dialogue');
    return JSON.stringify({
      dialogueVisible: dlg && getComputedStyle(dlg).display !== 'none',
      dialogueName: document.querySelector('.tower-dialogue-name')?.textContent || '',
      objective: document.querySelector('.tower-objective')?.textContent || '',
    });
  })()`, true);
  if (JSON.parse(talkCheck).dialogueVisible) break;
}
console.log('npc talk check:', talkCheck);
await shot('02b-npc-dialogue');
await evalJs(send, `window.__game._player.setCameraMode('first'); window.__game.teleport(-1.0, 5.5, 4, -0.7); 'ok'`);
await sleep(1200);
await shot('03-flat-4b-living');
await evalJs(send, `window.__game.teleport(0, 3.6, 4, Math.PI); 'ok'`);
await sleep(800);
await shot('04-flat-4b-south');
await evalJs(send, `window.__game.teleport(-1.0, 5.5, 4, -0.7); window.__game._player.setCameraMode('third'); 'ok'`);
await sleep(800);
await shot('05-flat-4b-third');
// Light switch: stand by the 4B living-room switch and Interact (mission step 3).
// (1.2, 0.15) is 0.4 m from the switch and 2.4 m from the flat resident,
// so the switch wins the nearest-interaction check.
const beforeLight = await evalJs(send, `document.querySelector('.tower-objective')?.textContent || ''`);
console.log('objective before light:', beforeLight);
await evalJs(send, `window.__game.teleport(1.2, 0.15, 4, 0); window.__game._player.setCameraMode('first'); 'ok'`);
await sleep(1000);
await evalJs(send, `window.__game._player.input.queueInteract(); 'ok'`);
let lightCheck = '{}';
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  lightCheck = await evalJs(send, `(() => {
    const prompt = document.querySelector('.tower-prompt')?.textContent || '';
    const objective = document.querySelector('.tower-objective')?.textContent || '';
    return JSON.stringify({ prompt, objective });
  })()`, true);
  if (JSON.parse(lightCheck).objective.includes('All done')) break;
}
console.log('light switch check:', lightCheck);
await shot('05b-flat-4b-light-on');
await evalJs(send, `window.__game.teleport(0, -2, 4, 0); window.__game._player.setCameraMode('first'); 'ok'`);
await sleep(1000);
await shot('06-floor4-lobby');
await evalJs(send, `window.__game.teleport(0, -1, 0, 0); 'ok'`);
await sleep(1000);
await shot('07-ground-lobby');
await evalJs(send, `window.__game.teleport(0, 16, 0, 0); 'ok'`);
await sleep(1000);
await shot('08-street-gate');
// Veranda skyline: stand on flat 4B's veranda facing south.
await evalJs(send, `window.__game.teleport(0, 7.0, 4, Math.PI); window.__game._player.setCameraMode('first'); 'ok'`);
await sleep(1000);
await shot('10-veranda-skyline');
console.log('stats at veranda:', await evalJs(send, `JSON.stringify(window.__game.getStats())`));
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

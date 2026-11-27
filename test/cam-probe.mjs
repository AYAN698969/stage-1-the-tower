/** Probe the third-person camera in flat 4B: dump player/camera positions
 * and what the camera is looking at, to diagnose the brown-screen shot. */
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const GAME = `http://127.0.0.1:8000/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const { send } = await connectCDP({
  onConsole: (p) => {
    const t = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (p.type === 'error') console.log('[console.error]', t.slice(0, 300));
  },
  onException: (p) => console.log('[exception]', (p.exceptionDetails?.exception?.description || '').slice(0, 300)),
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
// Teleport into flat 4B dining, face south-west like the smoke test, third-person.
await evalJs(send, `window.__game.teleport(-1.0, 5.5, 4, -0.7); window.__game._player.setCameraMode('third'); 'ok'`);
await sleep(1000);
// Force a frame first: in headless Chrome rAF only runs when a frame is
// produced, so a screenshot is needed before the camera position is current.
await send('Page.captureScreenshot', { format: 'png' });
await sleep(300);
const info = await evalJs(send, `JSON.stringify((() => {
  const p = window.__game._player;
  const cam = window.__game._engine.camera;
  // Recompute the camera raycast the same way _updateCamera does.
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
  const ox = fx * 2.6 + rx * 0.45, oz = fz * 2.6 + rz * 0.45;
  const len = Math.hypot(ox, oz);
  const col = p._collider();
  const tmp = new (Object.getPrototypeOf(p._combined).constructor)();
  for (const b of col.boxes) tmp.boxes.push(b);
  for (const b of p.ctx.doors.getClosedBoxes(p.floor)) tmp.boxes.push(b);
  const hit = tmp.raycast(p.pos.x, p.pos.z, ox / len, oz / len, len);
  // What is directly in front of the camera? Raycast against the scene.
  const THREE = window.__game._engine.scene ? null : null;
  return {
    pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, floor: p.floor,
    camPos: [cam.position.x, cam.position.y, cam.position.z],
    camDir: (() => { const v = new (cam.position.constructor)(); cam.getWorldDirection(v); return [v.x, v.y, v.z]; })(),
    offset: [ox, oz], len, rayHit: hit, colliderBoxes: col.boxes.length,
  };
})())`);
console.log('probe:', info);
// Screenshot the third-person view for reference.
const shot = await send('Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('test/smoke/cam-probe.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved test/smoke/cam-probe.png');
process.exit(0);

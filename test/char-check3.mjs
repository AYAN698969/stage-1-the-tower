import fs from 'node:fs';
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const errors = [];
const { send } = await connectCDP({
  onConsole: (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' ')); },
  onException: (p) => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'),
});
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8000/index.html?debug=1&quality=low' });
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
  if (s === 'ready') break;
}
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1000);
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
await sleep(500);
console.log('cutscene:', await evalJs(send, `window.__game._cutscenes.playing ? 'playing' : 'stopped'`));
// Manually drive one player update and catch any error.
console.log('manual update:', await evalJs(send, `(async () => {
  const p = window.__game._player;
  try {
    p.update(0.016);
    return 'OK mode=' + p.cameraMode + ' camPos=' + JSON.stringify(window.__game._engine.camera.position.toArray().map(v => +v.toFixed(2)));
  } catch (e) { return 'THREW: ' + e.message + ' | ' + (e.stack || '').split('\\n')[1]; }
})()`, true));
await evalJs(send, `window.__game._player.setCameraMode('third'); 'ok'`);
console.log('manual update third:', await evalJs(send, `(async () => {
  const p = window.__game._player;
  try {
    p.update(0.016);
    return 'OK mode=' + p.cameraMode + ' charVisible=' + p.character?.visible + ' camPos=' + JSON.stringify(window.__game._engine.camera.position.toArray().map(v => +v.toFixed(2)));
  } catch (e) { return 'THREW: ' + e.message + ' | ' + (e.stack || '').split('\\n')[1]; }
})()`, true));
// Character box after the mixer has run.
console.log('char box after update:', await evalJs(send, `(async () => {
  const THREE = await import('three');
  const c = window.__game._player.character;
  const box = new THREE.Box3().setFromObject(c);
  const size = box.getSize(new THREE.Vector3());
  return JSON.stringify({ size: size.toArray().map(v => +v.toFixed(2)), min: box.min.toArray().map(v => +v.toFixed(2)) });
})()`, true));
// Is the loop's player.update running on its own? Sample camera twice, 1 s apart, no manual calls.
await sleep(1000);
const a = await evalJs(send, `JSON.stringify(window.__game._engine.camera.position.toArray())`);
await sleep(1000);
const b = await evalJs(send, `JSON.stringify(window.__game._engine.camera.position.toArray())`);
console.log('cam drift check (should change if loop runs in third):', a, '->', b);
console.log('page console errors:', JSON.stringify(errors.slice(0, 5)));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('test/smoke/char-third3.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved');
process.exit(0);

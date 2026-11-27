import fs from 'node:fs';
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const { send } = await connectCDP({});
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8000/index.html?debug=1&quality=low' });
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const s = await evalJs(send, `(async () => { if (!window.__game) return 'no-game'; try { await Promise.race([window.__game.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 500))]); return 'ready'; } catch (e) { return 'loading'; } })()`, true);
  if (s === 'ready') break;
}
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1500);
await evalJs(send, `document.querySelector('.tower-btn-skip')?.click(); 'ok'`);
await sleep(1000);
console.log('character state:', await evalJs(send, `(async () => {
  const THREE = await import('three');
  const p = window.__game._player;
  const c = p.character;
  if (!c) return 'character is NULL';
  const box = new THREE.Box3().setFromObject(c);
  const size = box.getSize(new THREE.Vector3());
  return JSON.stringify({ visible: c.visible, pos: c.position.toArray(), boxMin: box.min.toArray().map(v => +v.toFixed(2)), boxMax: box.max.toArray().map(v => +v.toFixed(2)), size: size.toArray().map(v => +v.toFixed(2)), inScene: !!c.parent });
})()`, true));
await evalJs(send, `window.__game._player.setCameraMode('third'); 'ok'`);
await sleep(1000);
console.log('after third:', await evalJs(send, `JSON.stringify({ mode: window.__game._player.cameraMode, charVisible: window.__game._player.character?.visible, charPos: window.__game._player.character?.position.toArray(), camPos: window.__game._engine.camera.position.toArray() })`));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('test/smoke/char-third.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved');
process.exit(0);

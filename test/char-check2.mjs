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
// Raw girl model box (before normalizeModel) + NPC models.
console.log('raw boxes:', await evalJs(send, `(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const out = {};
  for (const name of ['girl', 'man', 'woman']) {
    const gltf = await loader.loadAsync('assets/' + name + '.glb');
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const root = gltf.scene;
    out[name] = { size: size.toArray().map(v => +v.toFixed(2)), min: box.min.toArray().map(v => +v.toFixed(2)), rootRot: [root.rotation.x, root.rotation.y, root.rotation.z].map(v => +v.toFixed(2)), anims: gltf.animations.map(a => a.name).slice(0, 4) };
  }
  return JSON.stringify(out);
})()`, true));
await evalJs(send, `document.querySelector('.tower-start')?.click(); 'ok'`);
await sleep(1000);
// Skip via the API (not the DOM button) and wait until really not playing.
await evalJs(send, `window.__game._cutscenes.skip(); 'ok'`);
for (let i = 0; i < 20; i++) {
  await sleep(500);
  const p = await evalJs(send, `window.__game._cutscenes.playing ? 'playing' : 'stopped'`);
  if (p === 'stopped') break;
}
console.log('cutscene after skip:', await evalJs(send, `window.__game._cutscenes.playing ? 'playing' : 'stopped'`));
// Now third person, sample the camera over 1.5 s.
await evalJs(send, `window.__game._player.setCameraMode('third'); 'ok'`);
for (let i = 0; i < 3; i++) {
  await sleep(500);
  console.log(`cam sample ${i}:`, await evalJs(send, `JSON.stringify({ mode: window.__game._player.cameraMode, charVisible: window.__game._player.character?.visible, camPos: window.__game._engine.camera.position.toArray().map(v => +v.toFixed(2)) })`));
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('test/smoke/char-third2.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved');
process.exit(0);

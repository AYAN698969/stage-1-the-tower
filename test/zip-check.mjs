/** Quick check: the ZIP-extracted game (port 8001) loads and becomes ready. */
import { connectCDP, evalJs, sleep } from '/home/hatch/workspace/tower-game/test/cdp.mjs';

const GAME = `http://127.0.0.1:8001/index.html?debug=1&quality=low&_cb=${Date.now()}`;
const errors = [];
const { send } = await connectCDP({
  onConsole: (p) => {
    const t = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (p.type === 'error') { console.log('[console.error]', t.slice(0, 200)); errors.push(t); }
  },
  onException: (p) => console.log('[exception]', (p.exceptionDetails?.exception?.description || '').slice(0, 200)),
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
console.log('ZIP game ready:', ready, '| console errors:', errors.length);
process.exit(ready && errors.length === 0 ? 0 : 1);

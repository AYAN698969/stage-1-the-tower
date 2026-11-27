/** Quick debug: load the game page, dump console output + loading state. */
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const GAME = 'http://127.0.0.1:8000/index.html?debug=1&quality=low';
const errors = [];
const { send } = await connectCDP({
  onConsole: (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[console.${p.type}]`, text.slice(0, 300));
    if (p.type === 'error') errors.push(text);
  },
  onException: (p) => console.log('[exception]', (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 500)),
  onLog: (p) => console.log('[log]', p.entry.level, (p.entry.text || '').slice(0, 200), p.entry.url || ''),
});
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
console.log('eval 1+1:', await evalJs(send, '1+1'));
await send('Page.navigate', { url: GAME });
for (let i = 0; i < 20; i++) {
  await sleep(3000);
  const state = await evalJs(send, `JSON.stringify({ hasGame: !!window.__game, loadingText: document.querySelector('.tower-loading-text')?.textContent, startDisplay: document.querySelector('.tower-start') ? getComputedStyle(document.querySelector('.tower-start')).display : 'missing', bodyText: document.body.innerText.slice(0, 150) })`);
  console.log(`t=${(i + 1) * 3}s`, state);
  if (state) {
    const s = JSON.parse(state);
    if (s.startDisplay === 'block') { console.log('START BUTTON VISIBLE — game loaded'); break; }
  }
}
process.exit(0);

import fs from 'node:fs';
import { connectCDP, evalJs, sleep } from './cdp.mjs';

const { send } = await connectCDP({});
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8000/test/char-test2.html' });
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const done = await evalJs(send, `window.__charTest?.done ? 'done' : 'no'`).catch(() => 'err');
  if (done === 'done') break;
}
console.log('info:', await evalJs(send, `JSON.stringify(window.__charTest?.info)`));
await sleep(2000);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('test/smoke/char-test2.png', Buffer.from(shot.data, 'base64'));
console.log('shot saved');
process.exit(0);

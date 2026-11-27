import { connectCDP, evalJs, sleep } from './cdp.mjs';
const { send } = await connectCDP({});
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'about:blank' });
await sleep(1500);
console.log('webgl2:', await evalJs(send, `(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); return gl ? gl.getParameter(gl.RENDERER) + ' | ' + gl.getParameter(gl.VERSION) : 'NULL'; })()`));
console.log('webgl1:', await evalJs(send, `(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); return gl ? 'OK' : 'NULL'; })()`));
process.exit(0);

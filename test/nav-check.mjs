import { connectCDP, evalJs, sleep } from '/home/hatch/workspace/tower-game/test/cdp.mjs';
const { send } = await connectCDP({
  onConsole: (p) => console.log('[console]', p.type, p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)),
  onException: (p) => console.log('[exc]', (p.exceptionDetails?.exception?.description || '').slice(0, 300)),
  onLog: (p) => console.log('[log]', p.entry.level, (p.entry.text || '').slice(0, 200)),
});
await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
console.log('nav result:', JSON.stringify(await send('Page.navigate', { url: 'http://127.0.0.1:8000/index.html?debug=1' })));
await sleep(8000);
console.log('href:', await evalJs(send, 'location.href'));
console.log('title:', await evalJs(send, 'document.title'));
console.log('body len:', await evalJs(send, 'document.body.innerHTML.length'));
console.log('scripts:', await evalJs(send, 'JSON.stringify([...document.scripts].map(s=>s.src))'));
process.exit(0);

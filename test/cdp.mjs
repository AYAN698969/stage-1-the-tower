/**
 * Minimal CDP client for Obscura's serve mode: attaches to a page target
 * via the browser-level socket (Target.attachToTarget, flatten).
 */
const PORT = process.env.CDP_PORT || '9222';
const CDP = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectCDP({ onConsole = () => {}, onException = () => {}, onLog = () => {} } = {}) {
  const version = await (await fetch(`${CDP}/json/version`)).json();
  const BROWSER_WS = version.webSocketDebuggerUrl;
  if (!BROWSER_WS) throw new Error('no browser webSocketDebuggerUrl');
  const ws = new WebSocket(BROWSER_WS);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  let sessionId = null;
  const sendRaw = (obj) => ws.send(JSON.stringify(obj));
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    sendRaw({ sessionId, id, method, params });
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result || {});
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') onConsole(m.params);
    if (m.method === 'Runtime.exceptionThrown') onException(m.params);
    if (m.method === 'Log.entryAdded') onLog(m.params);
  };
  // Reuse the first page target if one exists (avoids piling up targets
  // that each run a WebGL render loop); otherwise create one.
  const list = await (await fetch(`${CDP}/json/list`)).json();
  let targetId = list.find((t) => t.type === 'page')?.id;
  if (!targetId) {
    const created = await new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      sendRaw({ id, method: 'Target.createTarget', params: { url: 'about:blank' } });
    });
    targetId = created.targetId;
  }
  const attach = await new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    sendRaw({ id, method: 'Target.attachToTarget', params: { targetId, flatten: true } });
  });
  sessionId = attach.sessionId;
  return { ws, send, sessionId };
}

export async function evalJs(send, expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(r.exceptionDetails).slice(0, 500)}`);
  return r.result?.value;
}

export { sleep };

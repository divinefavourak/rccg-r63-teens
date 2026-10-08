// Screenshot a Console route, signed in, with headless Chrome over CDP.
//   node shot.mjs <url> <out.png> [--dark] [--size=1440x1000] [--click=<selector>]
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [url, out, ...flags] = process.argv.slice(2);
const dark = flags.includes('--dark');
const size = (flags.find((f) => f.startsWith('--size=')) ?? '--size=1440x1000').slice(7).split('x').map(Number);
const PORT = 9333;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=C:/Temp/cdp-console',
  `--window-size=${size[0]},${size[1]}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not start');
}

try {
  const ws = new WebSocket(await target());
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg.result ?? msg); waiting.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((r) => { id += 1; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

  const user = { id: 'u-tunde', email: 'tunde.adeyemi@gmail.com', first_name: 'Tunde', last_name: 'Adeyemi', role: 'admin', token: 'fixture', refresh: 'fixture' };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('rccg_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('theme', ${JSON.stringify(dark ? 'dark' : 'light')});`,
  });
  await send('Page.navigate', { url });
  // A cold Vite transform can take a while; wait for the Console to draw.
  for (let i = 0; i < 80; i += 1) {
    await sleep(500);
    const ready = await send('Runtime.evaluate', { expression: "!!document.querySelector('aside, h1')", returnByValue: true });
    if (ready.result?.value) break;
  }
  await sleep(2500);
  // --click=<css selector> presses something before the picture is taken.
  const click = flags.find((f) => f.startsWith('--click='));
  if (click) {
    await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click.slice(8))})?.click()` });
    await sleep(1200);
  }
  if (dark) await send('Runtime.evaluate', { expression: "document.documentElement.classList.add('dark')" });
  await sleep(500);
  const where = await send('Runtime.evaluate', { expression: 'location.pathname', returnByValue: true });
  const scope = await send('Runtime.evaluate', { expression: "Object.keys(localStorage).filter((k) => /scope/i.test(k)).map((k) => k + '=' + localStorage.getItem(k)).join(' | ')", returnByValue: true });
  console.log('stored scope: ' + (scope.result?.value || 'none'));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${out} at ${where.result?.value}`);
  if (errors.length) console.log(`page errors:\n- ${[...new Set(errors)].slice(0, 8).join('\n- ')}`);
  ws.close();
} finally {
  chrome.kill();
}

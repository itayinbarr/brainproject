// Smoke-test the VR wiring without a headset: confirm the scene exposes the VR API
// and the in-headset info panel, selecting a structure drives setVRInfo with no errors,
// and setVRInfo(payload)/setVRInfo(null) are safe to call directly.
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import path from 'node:path';

const ROOT = path.resolve('brain-atlas');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p); const d = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__BA && window.BRAIN, { timeout: 20000 });

// pick a real node id, then deep-link select it (drives the React setVRInfo effect)
const id = await page.evaluate(() => window.BRAIN.nodes[0].id);
await page.goto(`http://localhost:${port}/?sel=${id}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__BA, { timeout: 20000 });
await page.waitForTimeout(1500); // let the model load + selection apply

const checks = await page.evaluate(() => {
  const s = window.__BA; const out = {};
  out.hasSetVRInfo = typeof s.setVRInfo === 'function';
  out.hasVrApi = !!(s.vr && typeof s.vr.enter === 'function' && typeof s.vr.exit === 'function');
  // calling setVRInfo before any VR session must be a no-op (no panel yet) and must not throw
  let threw = false;
  try { s.setVRInfo({ title: 'Test', side: 'Left', body: 'A '.repeat(80), color: '#3A66FF' }); s.setVRInfo(null); }
  catch (e) { threw = true; out.err = e.message; }
  out.setVRInfoSafe = !threw;
  return out;
});

await browser.close(); server.close();
console.log(JSON.stringify({ errors, checks }, null, 2));
const ok = errors.length === 0 && checks.hasSetVRInfo && checks.hasVrApi && checks.setVRInfoSafe;
console.log(ok ? '\nVR WIRING OK' : '\nVR WIRING FAILED');
process.exit(ok ? 0 : 1);

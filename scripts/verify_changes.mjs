// Headless smoke test: serve brain-atlas/, load it, assert the app boots with no
// console/page errors, then exercise the three changed areas via window.SYS data.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('brain-atlas');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}/`;

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle' });
// React app mounts into #root
await page.waitForFunction(() => document.querySelector('#root') && document.querySelector('#root').children.length > 0, { timeout: 15000 });

const checks = await page.evaluate(() => {
  const out = {};
  const SYS = window.SYS;
  out.lessonsWithQuiz = SYS.LESSONS.filter(l => l.quiz && l.quiz.length).length;
  out.totalLessons = SYS.LESSONS.length;
  out.quizCounts = SYS.LESSONS.map(l => (l.quiz ? l.quiz.length : 0));
  // every 'find' option must resolve to a real mesh id so it can glow
  const badFind = [];
  SYS.LESSONS.forEach(l => (l.quiz || []).forEach(q => {
    if (q.type === 'find') {
      (q.options || []).forEach(k => { if (SYS.idsForKey(k).length === 0) badFind.push(l.id + ':' + k); });
      if (!q.options.includes(q.answer)) badFind.push(l.id + ' answer-not-in-options');
    }
    if (q.type === 'mc' && (typeof q.answer !== 'number' || !q.options[q.answer])) badFind.push(l.id + ' bad-mc-answer');
  }));
  out.badFind = badFind;
  // VR api present
  out.vrApi = !!(window.__BA && window.__BA.vr && typeof window.__BA.vr.enter === 'function');
  out.xrEnabled = !!(window.__BA && window.__BA.renderer && window.__BA.renderer.xr && window.__BA.renderer.xr.enabled);
  out.headsetIcon = !!(window.ICONS && window.ICONS.headset);
  return out;
});

await browser.close();
server.close();

console.log(JSON.stringify({ errors, checks }, null, 2));
const ok = errors.length === 0 && checks.lessonsWithQuiz === checks.totalLessons
  && checks.badFind.length === 0 && checks.vrApi && checks.xrEnabled && checks.headsetIcon
  && checks.quizCounts.every(n => n >= 4);
console.log(ok ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
process.exit(ok ? 0 : 1);

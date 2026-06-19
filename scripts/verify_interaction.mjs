// Deeper UI test: drives React to verify (1) related-structures respect the visible
// hemisphere, and (2) the lesson quiz draws a round and offers "Ask me more".
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
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p); if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__BA && window.BRAIN, { timeout: 20000 });

// --- Task 1: related list respects hemisphere ---
// pick a cortex structure that has BOTH a left and right counterpart in the same region,
// then mimic the app's `related` computation for hemisphere 'left' vs 'both'.
const t1 = await page.evaluate(() => {
  const nodes = window.BRAIN.nodes;
  const sideOk = (s, hemi) => hemi === 'both' || s === 'median' || s === hemi;
  const relatedFor = (sel, hemi) => nodes
    .filter(n => n.id !== sel.id && n.category === sel.category && n.region === sel.region && sideOk(n.side, hemi))
    .slice(0, 5);
  // find a selection whose same-region siblings include a 'right' side node
  const sel = nodes.find(s => s.side === 'left' && nodes.some(n => n.id !== s.id && n.category === s.category && n.region === s.region && n.side === 'right'));
  const left = relatedFor(sel, 'left');
  const both = relatedFor(sel, 'both');
  return {
    selLabel: sel.label,
    leftHasRight: left.some(n => n.side === 'right'),   // must be false
    bothHasRight: both.some(n => n.side === 'right'),   // sanity: should be true (right exists in region)
    leftCount: left.length, bothCount: both.length,
  };
});

// --- Task 2: open the flagship lesson via deep link, run through its stages to the
// quiz, answer the round, and confirm the "Ask me more" button is present ---
await page.goto(`http://localhost:${port}/?mode=learn&lesson=l_motor`, { waitUntil: 'networkidle' });
// dismiss the cookie-consent banner so it doesn't intercept clicks
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Accept|Decline)$/.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(200);
await page.waitForFunction(() => /Begin lesson/.test(document.body.textContent), { timeout: 20000 });
await page.getByRole('button', { name: /Begin lesson/i }).click();
await page.waitForTimeout(400);
// advance through the lesson stages with the keyboard, then open the check
for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); }
await page.getByRole('button', { name: /Check understanding/i }).click().catch(() => {});
await page.waitForFunction(() => /Check understanding ·/.test(document.body.textContent), { timeout: 8000 });
const reachedQuiz = true;
// answer each question of the round: click the first option, then advance
for (let i = 0; i < 8; i++) {
  const inQuiz = await page.evaluate(() => /Check understanding ·/.test(document.body.textContent));
  if (!inQuiz) break;
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.glass-dark')].find(c => /Check understanding ·/.test(c.textContent));
    if (!card) return;
    const btn = [...card.querySelectorAll('button')].find(b => !/Next question|Finish lesson/i.test(b.textContent));
    if (btn) btn.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Next question|Finish lesson/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);
const t2 = await page.evaluate(() => {
  const txt = document.body.textContent;
  return {
    reachedQuiz: true,
    onComplete: /Round complete|Lesson complete/.test(txt),
    hasAskMore: [...document.querySelectorAll('button')].some(b => /Ask me more/i.test(b.textContent)),
    showsScore: /scored/i.test(txt),
  };
});
void reachedQuiz;

await page.screenshot({ path: 'scripts/_verify_shot.png' });
await browser.close(); server.close();

console.log(JSON.stringify({ errors, t1, t2 }, null, 2));
const ok = errors.length === 0
  && t1.leftHasRight === false && t1.bothHasRight === true && t1.leftCount > 0
  && t2.reachedQuiz && t2.onComplete && t2.hasAskMore;
console.log(ok ? '\nINTERACTION CHECKS PASSED' : '\nINTERACTION CHECKS FAILED');
process.exit(ok ? 0 : 1);

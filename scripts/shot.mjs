import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8847/index.html';
const out = process.argv[3] || '/tmp/brain_shot.png';
const actions = process.argv[4] || '';        // optional: search term to type
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1500, height:950 }, deviceScaleFactor:2 });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
await page.goto(url, { waitUntil:'networkidle' });
// wait until loading overlay is gone (model parsed)
await page.waitForSelector('#loading.done', { timeout: 60000 }).catch(()=>errors.push('TIMEOUT: model never finished loading'));
await page.waitForTimeout(2500);              // let draco decode + first frames render
if (actions){
  await page.fill('#search', actions);
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: out });
console.log('STRUCTURES:', await page.textContent('#count').catch(()=>'?'));
console.log('ERRORS:', errors.length ? '\n'+errors.join('\n') : 'none');
await browser.close();

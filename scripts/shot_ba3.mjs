import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:950},deviceScaleFactor:2});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8861/index.html',{waitUntil:'load'});
await p.waitForTimeout(6500);
// click roughly on the cortex surface (center-right of viewport)
await p.mouse.click(900,470); await p.waitForTimeout(900);
await p.mouse.click(950,430); await p.waitForTimeout(1200);
await p.screenshot({path:'/tmp/ba_select.png'});
// report whether a selection card exists
const h2 = await p.$$eval('h2', els=>els.map(e=>e.textContent));
console.log('H2s:', h2);
console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close();

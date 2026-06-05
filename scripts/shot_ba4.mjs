import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:950},deviceScaleFactor:2});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8861/index.html',{waitUntil:'load'});
await p.waitForTimeout(6000);
// expand the Deep grey / basal ganglia group, then click a structure
await p.getByText('Deep grey / basal ganglia',{exact:false}).first().click();
await p.waitForTimeout(500);
await p.getByText('Putamen',{exact:false}).first().click();
await p.waitForTimeout(1500);
await p.screenshot({path:'/tmp/ba_card.png'});
const h2 = await p.$$eval('h2', els=>els.map(e=>e.textContent));
console.log('H2 (selection title):', h2);
console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close();

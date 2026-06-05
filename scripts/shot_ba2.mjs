import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:950},deviceScaleFactor:2});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8861/index.html',{waitUntil:'load'});
await p.waitForTimeout(6500);
// click the Vasculature preset
const vasc = p.getByText('Vasculature',{exact:false}).first();
await vasc.click().catch(e=>errs.push('vasc click: '+e.message));
await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/ba_vasc.png'});
// now search a specific cortical structure
const inp = await p.$('.glass input');
await inp.fill('calcarine'); await p.waitForTimeout(1600);
await p.screenshot({path:'/tmp/ba_search.png'});
console.log('ERRORS:', errs.length?errs.join('\n'):'none');
await b.close();

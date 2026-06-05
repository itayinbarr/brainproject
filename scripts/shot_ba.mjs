import { chromium } from 'playwright';
const url=process.argv[2], out=process.argv[3], term=process.argv[4]||'';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:950},deviceScaleFactor:2});
const errs=[];
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
p.on('requestfailed',r=>errs.push('REQFAIL: '+r.url()+' '+(r.failure()&&r.failure().errorText)));
await p.goto(url,{waitUntil:'load'});
await p.waitForTimeout(6500);
if(term){ const i=await p.$('.glass input'); if(i){await i.fill(term); await p.waitForTimeout(1500);} }
await p.screenshot({path:out});
console.log('ERRORS:', errs.length? '\n'+errs.slice(0,12).join('\n'):'none');
await b.close();

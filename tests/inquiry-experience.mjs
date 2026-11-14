// First-time visitor recovery, isolated mocked delivery: no real email is sent.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {start} from './serve.mjs';
const out=process.env.INQUIRY_RESULTS||join(tmpdir(),'photografik-inquiry-experience');await mkdir(out,{recursive:true});
const server=await start(0),base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),results=[];
try{for(const width of [1440,390,320]){
 const p=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});let calls=0,success=false,payload;
 await p.route('**/api/inquiry',r=>{calls++;payload=r.request().postDataJSON();return r.fulfill({status:success?200:502,contentType:'application/json',body:JSON.stringify({ok:success})});});
 await p.goto(base+'/contact?type=architecture-design');await p.locator('#i-name').fill('QC example');await p.locator('#i-email').fill('test@example.com');
 const long='x'.repeat(4001);await p.locator('#i-deliverables').fill(long);await p.locator('#inquiry button[type=submit]').click();
 assert.equal(calls,0);assert.equal(await p.locator('#i-deliverables').inputValue(),long);assert.match(await p.locator('#i-deliverables-err').innerText(),/4,000/);assert.equal(await p.locator('#i-deliverables').evaluate(e=>e===document.activeElement),true);
 assert.match(await p.locator('#i-deliverables-count').innerText(),/4,001/);
 const details='First paragraph.\n\nSecond paragraph: website & social.';await p.locator('#i-deliverables').fill(details);await p.locator('#more-details summary').click();await p.locator('#i-phone').fill('1'.repeat(41));await p.locator('#more-details summary').click();await p.locator('#inquiry button[type=submit]').click();
 assert.equal(calls,0);assert.equal(await p.locator('#more-details').evaluate(e=>e.open),true);assert.equal(await p.locator('#i-phone').evaluate(e=>e===document.activeElement),true);
 await p.locator('#i-phone').fill('');await p.locator('#inquiry button[type=submit]').click();await p.locator('#form-fallback:not([hidden])').waitFor();
 assert.equal(calls,1);assert.equal(payload.deliverables,details);assert.ok((await p.locator('#fallback-text').innerText()).includes(details));await p.locator('#fallback-back').click();assert.equal(await p.locator('#i-deliverables').inputValue(),details);
 assert.equal(await p.locator('#i-deliverables').getAttribute('aria-describedby'),'i-deliverables-count');success=true;await p.locator('#inquiry button[type=submit]').click();await p.locator('#form-done:not([hidden])').waitFor();assert.equal(calls,2);assert.equal(payload.deliverables,details);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:join(out,`success-${width}.png`),fullPage:true});results.push({width,oversizeTextRetained:true,invalidOptionalRevealed:true,paragraphsRetained:true,failureRecovery:true,mockedSuccess:true});console.log('PASS inquiry recovery',width);await p.close();
}}finally{await browser.close();server.close();await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));}

import { chromium, firefox } from 'playwright';
import { start } from './serve.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const evidence=process.env.EVIDENCE_DIR || '/tmp/photografik-commercial-layout';await mkdir(evidence,{recursive:true});
const server=await start();const base=`http://127.0.0.1:${server.address().port}`;
let failures=0;
try {for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]) {
 const browser=await engine.launch({headless:true});
 try {for(const width of [1440,2048,390]) {
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await page.goto(base+'/commercial');await page.locator('#com-value-h').scrollIntoViewIfNeeded();
 await page.locator('.features--4 .block-fig img').first().waitFor();
 for (const image of await page.locator('.features--4 .block-fig img').all()) {
   await image.scrollIntoViewIfNeeded();
   await image.evaluate(im => im.decode());
 }
 await page.locator('#com-value-h').scrollIntoViewIfNeeded();
 const boxes=await page.locator('.features--4 .block-fig img').evaluateAll(ims=>ims.map(im=>({width:im.getBoundingClientRect().width,height:im.getBoundingClientRect().height,attrHeight:im.getAttribute('height'),loaded:im.complete&&im.naturalWidth>0})));
 console.log(name,width,JSON.stringify(boxes));
 await page.screenshot({path:`${evidence}/commercial-${process.env.CHECK_STAGE||'after'}-${name}-${width}.png`});
 await page.locator('.features--4').screenshot({path:`${evidence}/commercial-cards-${name}-${width}.png`});
 try{assert.equal(boxes.length,4);for(const b of boxes){assert.ok(b.loaded);assert.ok(Math.abs(b.width/b.height-1.5)<.02,`${name} ${width}: ${b.width} x ${b.height}`);}}catch(e){failures++;console.log(e.message);}
 await page.close(); }
 }finally{await browser.close();}
}}finally{server.close();}
if(failures)process.exitCode=1;

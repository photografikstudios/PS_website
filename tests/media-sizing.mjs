// Browser regression for saved Page Media size choices. Operates only on local build DOM.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { start } from './serve.mjs';
import { PAGES, isGallery } from '../src/lib/page-media-core.js';
const server=await start(0), base=`http://localhost:${server.address().port}`;
const b=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
const results=[];
const out=process.env.EVIDENCE_DIR;
try {
 for(const width of [1440,390,320]){
  const page=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  for(const def of PAGES){
   const res=await page.goto(base+def.route,{waitUntil:'networkidle'});assert.equal(res.status(),200);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const saved=JSON.parse(await readFile(new URL(`../content/page-media/${def.file}.json`,import.meta.url)));
   for(const slot of def.slots.filter(s=>!isGallery(s))){
    const value=saved[slot.key], items=Array.isArray(value)?value:value?[value]:[];
    if(!items.length || slot.key==='sessionOther') continue; // fallback card only exists for future session types
    const frames=page.locator(`[data-page-media="${def.file}.${slot.key}"]`);
    assert.equal(await frames.count(),items.length,`${def.file}.${slot.key} all placements have a size frame`);
    for(let i=0;i<items.length;i++)assert.equal(await frames.nth(i).getAttribute('data-media-size'),items[i].size||'default');
   }
   for(const size of ['small','medium','large','default']){
    await page.locator('[data-page-media]').evaluateAll((els,size)=>els.forEach(el=>el.dataset.mediaSize=size),size);
    const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth, invalid:[...document.querySelectorAll('[data-page-media]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>innerWidth+1||r.x<-1||r.right>innerWidth+1;}).map(el=>el.dataset.pageMedia)}));
    assert.equal(check.overflow,false,`${def.route} ${width} ${size}: page overflow`);assert.deepEqual(check.invalid,[],`${def.route} ${width} ${size}: media outside viewport`);
   }
   if(def.file==='about'){
    const reel=page.locator('[data-page-media="about.locationMedia"]');
    const widths=[];
    for(const size of ['small','medium','large']){
     await reel.evaluate((el,size)=>el.dataset.mediaSize=size,size);
     const box=await reel.locator('video').boundingBox();widths.push(box.width);
     assert.ok(Math.abs(box.width/box.height-9/16)<.005,'reel retains 9:16 aspect');
     assert.ok(box.width<=420.5,'large portrait bounded');
    }
    assert.ok(widths[0]<=widths[1]&&widths[1]<=widths[2]);
    if(width===1440) assert.ok(widths[0]<widths[1]&&widths[1]<widths[2],'desktop size choices distinct');
    await reel.evaluate(el=>el.dataset.mediaSize='medium');
    if(out){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/about-sized-${width}.png`,fullPage:true});await page.locator('.about-bts').first().screenshot({path:`${out}/about-reel-${width}.png`});}
   }
   assert.deepEqual(errors,[]);results.push({route:def.route,width,status:'pass'});console.log('PASS',width,def.route);
  }
  await page.close();
 }
 if(out)await writeFile(`${out}/media-sizing.json`,JSON.stringify(results,null,2));
 console.log(`${results.length} route/viewport checks passed; four sizes each`);
}finally{await b.close();server.close();}

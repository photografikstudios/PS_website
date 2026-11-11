// Local real-asset coverage for uncropped portraits, fixed-frame focal overrides and phone layouts.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {start} from './serve.mjs';
import {PAGES} from '../src/lib/page-media-core.js';
const s=await start(0),b=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),out=process.env.EVIDENCE_DIR,results=[];
try{for(const width of [1440,390,320]){const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(const def of PAGES){await p.goto(`http://localhost:${s.address().port}${def.route}`);await p.locator('main').waitFor();
  for(const fit of ['default','original','fill']){await p.locator('[data-page-media]').evaluateAll((els,fit)=>els.forEach(el=>{el.dataset.mediaFit=fit;el.setAttribute('data-media-focus','');el.style.setProperty('--pm-focus','33% 12%');}),fit);
   const check=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,wrong:[...document.querySelectorAll('[data-page-media] img')].filter(el=>getComputedStyle(el).objectPosition!=='33% 12%').map(el=>el.currentSrc)}));
   assert.equal(check.overflow,false,`${def.route} ${width} ${fit} overflow`);assert.deepEqual(check.wrong,[],`${def.route} ${fit} respects placement focus over template defaults`);
  }
  results.push({route:def.route,width,status:'pass'});
 }
 // A real portrait asset in a normal placement must display its native 2:3, not a 3:2 crop.
 await p.goto(`http://localhost:${s.address().port}/architecture-design`);
 const root=p.locator('[data-page-media="architecture-design.introPhoto"]');
 await root.evaluate(el=>{el.dataset.mediaShape='vertical';el.dataset.mediaFit='default';el.style.setProperty('--pm-ratio','2 / 3');const im=el.querySelector('img');im.removeAttribute('srcset');im.src='/v/ph-revivaluxe-portrait.webp';});
 const image=root.locator('img');await image.scrollIntoViewIfNeeded();await p.waitForFunction(()=>{const im=document.querySelector('[data-page-media="architecture-design.introPhoto"] img');return im.complete&&im.naturalWidth>0;});
 const box=await image.boundingBox();assert.ok(Math.abs(box.width/box.height-2/3)<.01,`portrait ${width} keeps source ratio`);assert.equal(await image.evaluate(el=>getComputedStyle(el).objectFit),'contain');
 await p.goto(`http://localhost:${s.address().port}/`);const tile=p.locator('[data-page-media="home.brandTile"]');
 await tile.evaluate(el=>{el.dataset.mediaFit='fill';el.setAttribute('data-media-focus','');el.style.setProperty('--pm-focus','50% 8%');const im=el.querySelector('img');im.removeAttribute('srcset');im.src='/v/ph-revivaluxe-portrait.webp';});
 await tile.scrollIntoViewIfNeeded();await p.waitForFunction(()=>{const im=document.querySelector('[data-page-media="home.brandTile"] img');return im.complete&&im.naturalWidth>0;});
 assert.equal(await tile.locator('img').evaluate(el=>getComputedStyle(el).objectPosition),'50% 8%');assert.equal(await tile.locator('img').evaluate(el=>getComputedStyle(el).objectFit),'cover');
 if(out){await mkdir(out,{recursive:true});await p.locator('.quick__tile').nth(1).screenshot({path:`${out}/portrait-filled-focus-${width}.png`});}
 assert.deepEqual(errs,[]);await p.close();}
 if(out)await writeFile(`${out}/media-focus.json`,JSON.stringify(results,null,2));console.log(`${results.length} route/viewport checks across three fit modes passed; native portraits and upper-focus crops passed.`);
}finally{await b.close();s.close();}

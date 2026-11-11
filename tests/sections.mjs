// Disposable full-site section layouts: never modifies owner content, Git or deployed previews.
import {mkdtemp,cp,mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';import {runInNewContext} from 'node:vm';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {PAGES,pageMediaRefs} from '../src/lib/page-media-core.js';
import {sectionLayout,sectionCapabilities,duplicatePageSection,newPageSection} from '../src/lib/page-editor-core.js';
const root=fileURLToPath(new URL('..',import.meta.url)),fixture=await mkdtemp(join(tmpdir(),'pg-sections-site-')),evidence=process.env.EVIDENCE_DIR;
for(const p of ['src','scripts','content','static','package.json','vercel.json'])await cp(join(root,p),join(fixture,p),{recursive:true});
await mkdir(join(fixture,'tests'));await cp(join(root,'tests/serve.mjs'),join(fixture,'tests/serve.mjs'));
await symlink(join(root,'node_modules'),join(fixture,'node_modules'),'dir');
const build=()=>execFileSync('node',['src/build.mjs'],{cwd:fixture,env:{...process.env,VERCEL_GIT_COMMIT_SHA:'sectionstest'},stdio:'pipe'});
build();let scope={window:{}};runInNewContext(await readFile(join(fixture,'dist/admin/config.js'),'utf8'),scope);
const models=scope.window.PHOTOGRAFIK_PAGE_EDITORS,originals={};
for(const pg of PAGES){
 const path=join(fixture,'content/page-media',pg.file+'.json'),v=JSON.parse(await readFile(path,'utf8')),m=models[pg.file];originals[pg.file]=structuredClone(v);
 const layout=sectionLayout(m),add=newPageSection('text','section-qa-'+pg.file);add.title='QA added section';add.body='QA fixture text, saved only in a disposable local site.';
 const eligible=m.sections.find(s=>sectionCapabilities(s).duplicate);
 if(eligible){const original=layout.find(s=>s.id===eligible.key),copy=duplicatePageSection(original,m,v,'section-copy-'+pg.file);const h=eligible.fields.find(f=>f.type==='heading');if(h)copy.copy[h.key]='QA independent duplicate';layout.push(copy);}
 for(const item of layout)if(item.id===item.source&&sectionCapabilities(m.sections.find(s=>s.key===item.source)).remove)item.hidden=true;
 const top=layout.shift();layout.reverse();layout.unshift(top,add);
 if(pg.file==='about'){
  const gallery=newPageSection('gallery','section-qa-gallery');gallery.title='QA photo gallery';gallery.items=[{media:'revivaluxe-still',focal:{x:50,y:5}},{media:'ph-clos-lighting'}];layout.push(gallery);
  const split=newPageSection('split','section-qa-split');split.title='QA text and portrait';split.body='Independent section copy.';split.media={media:'revivaluxe-still',size:'medium',fit:'original'};split.side='left';layout.push(split);
  const cta=newPageSection('cta','section-qa-cta');cta.title='QA next step';cta.theme='dark';layout.push(cta);
 }
 v._sections=layout;await writeFile(path,JSON.stringify(v,null,2)+'\n');
 const refs=pageMediaRefs({[pg.file]:v});assert.ok(pg.file!=='about'||refs.some(r=>r.key.includes('_sections')&&r.media==='revivaluxe-still'));
}
build();
const {start}=await import(pathToFileURL(join(fixture,'tests/serve.mjs'))),server=await start(0),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),results=[];
try{
 for(const width of [1440,390,320]){const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const pg of PAGES){await page.goto(`http://localhost:${server.address().port}${pg.route}`);await page.locator('main').waitFor();
   assert.equal(await page.getByRole('heading',{level:1}).count(),1,pg.route+' keeps one H1');
   assert.equal(await page.getByRole('heading',{name:'QA added section',exact:true}).count(),1);
   const check=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {overflow:document.documentElement.scrollWidth>innerWidth,duplicateIds:ids.filter((id,i)=>ids.indexOf(id)!==i)};});
   assert.equal(check.overflow,false,`${pg.route} ${width} overflow`);assert.deepEqual(check.duplicateIds,[],`${pg.route} repeated IDs`);
   if(pg.file==='contact')assert.equal(await page.locator('form').count(),1,'the inquiry form is preserved');
   if(pg.file==='real-estate-pricing')assert.equal(await page.locator('#sqft').count(),1,'the calculator is preserved');
   if(['real-estate','creator-studios'].includes(pg.file)){const graph=await page.locator('script[type="application/ld+json"]').allTextContents();assert.ok(!graph.join().includes('FAQPage'),'removed FAQ content is not claimed in schema');}
   results.push({route:pg.route,width,status:'pass'});
  }
  await page.goto(`http://localhost:${server.address().port}/about`);const gallery=page.locator('#section-qa-gallery'),first=gallery.locator('[data-section-image]').first();await first.click();
  const viewer=page.getByRole('dialog',{name:'Photo viewer',exact:true});await viewer.waitFor();assert.equal(await viewer.locator('img').getAttribute('alt'),'RevivaLuxe client holding a hand mirror during a consultation');
  await viewer.getByRole('button',{name:'Next photo',exact:true}).click();assert.match(await viewer.locator('img').getAttribute('alt'),/lighting|CLOS/i);
  await page.keyboard.press('Escape');assert.equal(await viewer.isVisible(),false);assert.equal(await first.evaluate(e=>e===document.activeElement),true);
  if(evidence){await mkdir(evidence,{recursive:true});await gallery.screenshot({path:join(evidence,'fixture-gallery-'+width+'.png')});}
  assert.deepEqual(errors,[],'no client-side errors at '+width);await page.close();
 }
 // A saved removal can be restored without losing the section's own copy or source selection.
 const file=join(fixture,'content/page-media/about.json'),value=JSON.parse(await readFile(file,'utf8')),removed=value._sections.find(s=>s.source==='about-purpose'&&s.id===s.source);removed.hidden=false;await writeFile(file,JSON.stringify(value));build();
 const restored=await readFile(join(fixture,'dist/about.html'),'utf8');assert.match(restored,/You did great work/);assert.match(restored,/oct15-in-house-v2/);
 if(evidence)await writeFile(join(evidence,'sections.json'),JSON.stringify({fixture,results,restored:true},null,2));
 console.log(`Sections: ${results.length} route/viewport checks; image viewers and saved restoration pass. Fixture: ${fixture}`);
}finally{await browser.close();server.close();}

// Actual pinned Decap + isolated in-memory backend. All requests outside localhost are blocked; no GitHub writes.
// Reproduces the global-entry onChange race that a widget-only stand-in cannot: old /new -> list -> fresh /new.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {start} from './serve.mjs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
const out=process.env.CMS_UPLOAD_RESULTS||join(tmpdir(),'photografik-cms-upload-check');await mkdir(out,{recursive:true});
if(!process.env.DECAP_TEST_BUNDLE)throw new Error('Set DECAP_TEST_BUNDLE to the official pinned Decap bundle. Its SRI is verified before use.');
const bundle=await readFile(process.env.DECAP_TEST_BUNDLE);
assert.equal('sha384-'+createHash('sha384').update(bundle).digest('base64'),JSON.parse(await readFile('src/admin/decap.json','utf8')).integrity);
const server=await start(0),base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);
const errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept()); // Disposable test drafts only.
try {
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname==='/decap.js')return r.fulfill({contentType:'text/javascript',body:bundle});return r.continue();});
  const html=(await readFile('dist/admin/index.html','utf8')).replace(/https:\/\/unpkg.com\/decap-cms@[^\"]+\/dist\/decap-cms.js/,'/decap.js');await page.route(base+'/admin/',r=>r.fulfill({contentType:'text/html',body:html}));
  const config=await readFile('dist/admin/config.js','utf8');
  const fields=[{name:'title',label:'Title',widget:'string',default:'QA draft'},
    {name:'src',label:'Photo',widget:'pgk-photo',required:false,media_folder:'/static/images/library',public_folder:'/images/library'},
    {name:'gallery',label:'Gallery',widget:'pgk-gallery',required:false,media_folder:'/static/images/library',public_folder:'/images/library'},
    {name:'placement',label:'Placement',widget:'pgk-slot',required:false,accepts:'photo',multiple:false,max:1,altMode:'decorative',media_folder:'/static/images/library',public_folder:'/images/library'},
    {name:'captions',label:'Captions',widget:'pgk-captions',required:false,media_folder:'/static/captions',public_folder:'/captions'},
    {name:'published',label:'Show on site',widget:'boolean',default:false}];
  const patch=`\nwindow.PHOTOGRAFIK_CMS_CONFIG.backend.name='test-repo';window.PHOTOGRAFIK_CMS_CONFIG.local_backend=false;window.PHOTOGRAFIK_CMS_CONFIG.collections=window.PHOTOGRAFIK_CMS_CONFIG.collections.filter(c=>c.name==='photos').map(c=>({...c,fields:${JSON.stringify(fields)}}));`;
  await page.route(base+'/admin/config.js*',r=>r.fulfill({contentType:'text/javascript',body:config+patch}));
  await page.goto(base+'/admin/#/collections/photos/new');
  const login=page.getByRole('button',{name:/Login|Log in/i});if(await login.count())await login.first().click();
  await page.getByRole('button',{name:'Choose photo',exact:true}).waitFor({timeout:30000});
  async function fresh(){await page.getByRole('link',{name:/Writing in Photo library collection/}).click();await page.getByRole('link',{name:'Create entry of type Photo',exact:true}).click();await page.getByRole('button',{name:'Choose photo',exact:true}).waitFor();}
  const photo={name:'qa.png',mimeType:'image/png',buffer:await readFile('static/images/clients/bellard-brothers.png')};
  const captions={name:'qa.vtt',mimeType:'text/vtt',buffer:Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nTest caption\n')};
  for(const kind of ['photo','gallery','slot','captions']) {
    await page.getByRole('textbox',{name:'Title',exact:true}).fill('Abandoned '+kind);
    await page.evaluate(kind=>{
      window.__releaseUpload=null;window.__oldPrepared=false;
      window.__realPrepare=window.PHOTOGRAFIK_PHOTO_UPLOAD.prepare;window.__realText=File.prototype.text;
      if(kind==='captions')File.prototype.text=function(){const f=this;return new Promise((resolve,reject)=>{window.__releaseUpload=()=>window.__realText.call(f).then(x=>{window.__oldPrepared=true;resolve(x);},reject);});};
      else window.PHOTOGRAFIK_PHOTO_UPLOAD.prepare=f=>new Promise((resolve,reject)=>{window.__releaseUpload=()=>window.__realPrepare(f).then(x=>{window.__oldPrepared=true;resolve(x);},reject);});
    },kind);
    const selector=kind==='gallery'?'.pgk-gallery > .pgk-gallery__bar input[type=file]':'.pgk-'+kind+' input[type=file]';
    await page.locator(selector).first().setInputFiles(kind==='captions'?captions:photo);
    await page.waitForFunction(()=>!!window.__releaseUpload);
    await fresh();
    const title='Retained '+kind;await page.getByRole('textbox',{name:'Title',exact:true}).fill(title);
    // A cancelled old task must release Save before its decoder eventually returns.
    await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Save now',{exact:true}).click();
    await page.waitForURL(new RegExp('#/collections/photos/entries/retained-'+kind+'$'));
    await page.evaluate(()=>{window.__releaseUpload();window.PHOTOGRAFIK_PHOTO_UPLOAD.prepare=window.__realPrepare;File.prototype.text=window.__realText;});
    await page.waitForFunction(()=>window.__oldPrepared);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.pgk-photo img').count(),0,'old photo must not enter new draft');
    assert.equal(await page.locator('.pgk-gallery__list .pgk-row').count(),0,'old gallery/placement must not enter new draft');
    assert.equal(await page.getByRole('radio',{name:'No captions yet',exact:true}).isChecked(),true,'old captions must not enter new draft');
    // Reopen the saved entry and verify its state, not just a transient empty screen.
    await page.getByRole('link',{name:/Writing in Photo library collection/}).click();await page.getByRole('link',{name:new RegExp(title)}).click();
    assert.equal(await page.locator('.pgk-photo img').count(),0);assert.equal(await page.locator('.pgk-gallery__list .pgk-row').count(),0);
    assert.equal(await page.getByRole('radio',{name:'No captions yet',exact:true}).isChecked(),true);
    results.push({kind,oldCompletionIgnored:true,newEntrySavedBeforeOldCompletion:true,reopenedClean:true});
    console.log('ok',kind,'old completion ignored; new entry Save and reopen clean');
    await fresh();
  }
  // Normal upload still reaches Decap, is saved, and is retained after re-opening.
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Normal upload');
  await page.locator('.pgk-photo input[type=file]').setInputFiles(photo);
  await page.getByRole('button',{name:'Replace photo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Save now',{exact:true}).click();
  await page.waitForURL(/#\/collections\/photos\/entries\/normal-upload$/);
  await page.getByRole('link',{name:/Writing in Photo library collection/}).click();await page.getByRole('link',{name:/Normal upload/}).click();
  assert.equal(await page.locator('.pgk-photo img').count(),1);
  await page.frameLocator('#preview-pane').getByText('Hidden.',{exact:true}).waitFor();
  await page.screenshot({path:out+'/native-upload-reopened.png'});
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(out+'/upload-lifecycle.json',JSON.stringify({backend:'isolated Decap test-repo, no GitHub writes',decap:'3.16.3',sriVerified:true,results,normalUploadSavedAndReopened:true,errors},null,2));
  console.log('Native lifecycle, normal upload Save/reopen and draft preservation passed');
} finally {await browser.close();server.close();}

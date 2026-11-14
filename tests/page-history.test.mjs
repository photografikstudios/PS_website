import {test}from'node:test';import assert from'node:assert/strict';import handler from'../api/cms-manage.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}});
test('saved page versions read only the allowed page at pinned branch commits; caller paths and writes are refused',async()=>{
 const oldFetch=globalThis.fetch,keys=['VERCEL_GIT_REPO_OWNER','VERCEL_GIT_REPO_SLUG','VERCEL_GIT_COMMIT_REF'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),requests=[];
 Object.assign(process.env,{VERCEL_GIT_REPO_OWNER:'qa-owner',VERCEL_GIT_REPO_SLUG:'qa-site',VERCEL_GIT_COMMIT_REF:'review/only'});
 const sha='a'.repeat(40),version='b'.repeat(40),value={hero:{media:'original'},_copy:{'top.heading':'Earlier heading'},_page:'never restore the virtual widget'};
 globalThis.fetch=async(url,init)=>{requests.push({url,method:init.method});assert.equal(init.method,'GET');let body;if(url.endsWith('/git/ref/heads/review/only'))body={object:{sha}};else if(url.includes('/commits?')){assert.ok(url.includes('sha='+sha));assert.ok(url.includes('path=content%2Fpage-media%2Fabout.json'));body=[{sha:version,commit:{message:'Update About\nLong body',committer:{date:'2026-11-14T12:00:00Z'}}}];}else {assert.ok(url.endsWith('/contents/content/page-media/about.json?ref='+version));body={encoding:'base64',size:100,content:Buffer.from(JSON.stringify(value)).toString('base64')};}return {status:200,ok:true,text:async()=>JSON.stringify(body)};};
 try{
  let r=response();await handler({method:'POST',headers:{authorization:'Bearer qc_test_token_1234567890'},body:{action:'pageHistory',page:'about',branch:'main',path:'../../private'}},r);
  assert.equal(r.statusCode,200);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.body.head,sha);assert.equal(r.body.versions[0].label,'Update About');assert.equal(r.body.versions[0].value._page,undefined);assert.equal(r.body.versions[0].value._copy['top.heading'],'Earlier heading');assert.equal(requests.length,3);
  for(const page of ['../../private','content/page-media/about.json','main','about?ref=main']){r=response();await handler({method:'POST',headers:{authorization:'Bearer qc_test_token_1234567890'},body:{action:'pageHistory',page}},r);assert.equal(r.statusCode,400);}assert.equal(requests.length,3);
  r=response();await handler({method:'POST',headers:{},body:{action:'pageHistory',page:'about'}},r);assert.equal(r.statusCode,401);assert.equal(requests.length,3);
 }finally{globalThis.fetch=oldFetch;for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});

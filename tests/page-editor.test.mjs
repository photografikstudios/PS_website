import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageEditingModel,pageEditProblems,safePageUrl,renderInline} from '../src/lib/page-editor-core.js';
const page={file:'about'};
const html='<section aria-labelledby="purpose-h"><h2 id="purpose-h">Your work. <em>Your people.</em></h2><p>Meet <a href="/creator-studios" data-track="creator_click">the studio</a>.</p><div data-page-media="about.locationMedia"><img src="/images/a.webp" alt="Original"></div><p class="photo-caption">Original caption</p></section><section id="reviews"><blockquote><p>Client quote verbatim.</p></blockquote><p class="plan__price">$249</p><article class="package-card"><h3>Luxury Media</h3><ul><li>Photography and floor plan</li></ul></article></section>';
test('page editor targets copy and media in page order, preserves source quotes, prices and captions',()=>{
 const m=pageEditingModel(html,page);assert.equal(m.sections.length,2);assert.deepEqual(m.sections[0].media,['locationMedia']);
 assert.equal(m.sections[0].fields.length,2);assert.equal(m.sections[0].fields[0].value,'Your work. *Your people.*');assert.equal(m.sections[1].fields.length,0);
 assert.equal(m.body.replace(/ data-page-(?:copy|section)="[^"]*"/g,''),html,'no edit changes visible text, links, source media or layout');
});
test('one page copy edit preserves formatting, tracking, other pages and media fields',()=>{
 const m=pageEditingModel(html,page),key=m.sections[0].fields[1].key;
 const values={locationMedia:{media:'original',size:'medium',focal:{x:50,y:5}},_copy:{[key]:'Record with [the studio](/creator-studios).'}};
 const edited=pageEditingModel(html,page,values);assert.match(edited.body,/Record with <a href="\/creator-studios" data-track="creator_click">the studio<\/a>\./);
 assert.match(edited.body,/Original caption/);assert.deepEqual(pageEditProblems(values,m),[]);assert.deepEqual(values.locationMedia,{media:'original',size:'medium',focal:{x:50,y:5}});
 assert.ok(!pageEditingModel(html,{file:'home'},{}).body.includes('Record with'));
});
test('rich text cannot inject HTML or unsafe link destinations; stale keys fail visibly',()=>{
 const m=pageEditingModel(html,page),key=m.sections[0].fields[0].key;
 assert.match(renderInline('<img src=x onerror=alert(1)>',''),/&lt;img/);
 assert.ok(!renderInline('[click](javascript:alert)','').includes('href'));
 for(const url of ['javascript:alert(1)','//host.test','/path\\bad','https://host.test/\nfoo','data:text/html,x'])assert.equal(safePageUrl(url),false,url);
 for(const url of ['/contact?type=architecture','#portfolio','https://licreatorstudios.com/','mailto:info@photografikstudios.com'])assert.equal(safePageUrl(url),true,url);
 assert.ok(pageEditProblems({_copy:{[key]:'',removed:'old'}},m).length===2);
 assert.ok(pageEditProblems({_seo:{title:'x'.repeat(71)}},m).length===1);
});
test('copy identifiers survive unrelated media changes and empty optional media',()=>{
 const a=pageEditingModel(html,page),b=pageEditingModel(html.replace('/images/a.webp','/images/new.webp'),page);
 assert.deepEqual(a.sections[0].fields.map(f=>f.key),b.sections[0].fields.map(f=>f.key));
 const card='<section><a href="/commercial"><span class="path__body"><span class="path__title">Brand stories</span><span class="path__text">Meet the people.</span></span></a></section>';
 const m=pageEditingModel(card,page);assert.equal(m.sections[0].fields.length,2);assert.ok(m.sections[0].fields.every(f=>!f.value.includes('<span')));
});

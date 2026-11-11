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

const sectionsCore=await import('../src/lib/page-editor-core.js');
const {sectionLayout,sectionLayoutProblems,sectionCapabilities,newPageSection,duplicatePageSection,composePageSections,sectionInstanceValues}=sectionsCore;
const sectionPage='<section><h1>Page heading</h1></section><section id="story" aria-labelledby="story-h"><h2 id="story-h">Our story</h2><p>Original words.</p><a href="#story-h">Read this story</a></section><section id="next"><h2>Next step</h2></section>';
test('sections: reordered, removed and restored native sections persist without changing the untouched default',()=>{
 const m=pageEditingModel(sectionPage,{file:'about'});assert.equal(composePageSections(m.body,m,{}),m.body);
 const layout=sectionLayout(m);assert.equal(layout[0].id,'top');const last=layout.pop();layout.splice(1,0,last);
 let out=composePageSections(m.body,m,{_sections:layout});assert.ok(out.indexOf('Next step')<out.indexOf('Our story'));
 layout.find(s=>s.id==='story').hidden=true;out=composePageSections(m.body,m,{_sections:layout});assert.ok(!out.includes('Original words.'));assert.match(out,/id="story"/,'old links retain an anchor');
 const saved=JSON.parse(JSON.stringify({_sections:layout}));saved._sections.find(s=>s.id==='story').hidden=false;assert.match(composePageSections(m.body,m,saved),/Original words\./);
});
test('sections: a native duplicate has independent copy and media; IDs and local ARIA/links are isolated',()=>{
 const m=pageEditingModel(sectionPage,{file:'about'});m.sections[1].media=['portrait'];
 const key=m.sections[1].fields.find(f=>f.type==='heading').key,root={portrait:{src:'/images/first.jpg',alt:'First',focal:{x:50,y:5}},_copy:{[key]:'Current story'}};
 const layout=sectionLayout(m),copy=duplicatePageSection(layout[1],m,root,'section-copy');layout.splice(2,0,copy);
 root.portrait.src='/images/second.jpg';root._copy[key]='Changed original';
 assert.equal(copy.media.portrait.src,'/images/first.jpg');assert.equal(copy.copy[key],'Current story');
 copy.copy[key]='Independent story';const scoped=sectionInstanceValues(copy,root);assert.equal(scoped._copy[key],'Independent story');assert.equal(root._copy[key],'Changed original');
 const out=composePageSections(m.body,m,{...root,_sections:layout});assert.match(out,/id="story-h--section-copy"/);assert.match(out,/aria-labelledby="story-h--section-copy"/);assert.match(out,/href="#story-h--section-copy"/);
});
test('sections: required openings/forms and interactive duplicates cannot be bypassed through saved data',()=>{
 const m=pageEditingModel('<section><h1>Title</h1></section><section id="form"><form id="brief"><input name="name"></form></section><section id="portfolio" data-showcase><h2>Gallery</h2></section>',{file:'contact'}),layout=sectionLayout(m);
 assert.equal(sectionCapabilities(m.sections[1]).remove,false);assert.equal(sectionCapabilities(m.sections[2]).duplicate,false);
 assert.throws(()=>duplicatePageSection(layout[2],m,{},'bad-copy'),/cannot be duplicated/);
 layout[0].hidden=true;assert.ok(sectionLayoutProblems({_sections:layout},m).some(x=>/required|stay/.test(x)));
 layout[0].hidden=false;layout[1].hidden=true;assert.ok(sectionLayoutProblems({_sections:layout},m).length);
});
test('sections: new templates validate, unsafe text is escaped, and removal retains an unfinished block for recovery',()=>{
 const m=pageEditingModel(sectionPage,{file:'about'}),layout=sectionLayout(m),text=newPageSection('text','section-new');layout.push(text);
 assert.ok(sectionLayoutProblems({_sections:layout},m).length);text.title='New heading';text.body='Text with <script>unsafe()</script> and **emphasis**.';
 assert.deepEqual(sectionLayoutProblems({_sections:layout},m),[]);const out=composePageSections(m.body,m,{_sections:layout});assert.match(out,/&lt;script&gt;/);assert.match(out,/<strong>emphasis<\/strong>/);
 const duplicate=duplicatePageSection(text,m,{},'section-new-copy');duplicate.body='Separate text';assert.notEqual(duplicate.body,text.body);
 text.title='';text.body='';text.hidden=true;assert.deepEqual(sectionLayoutProblems({_sections:layout},m),[]);
 const bad={...text,hidden:false,type:'cta',title:'Contact',button:{label:'Go',href:'javascript:bad'}};assert.ok(sectionLayoutProblems({_sections:sectionLayout(m).concat([bad])},m).some(x=>/destination/.test(x)));
});

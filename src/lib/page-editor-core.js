// Shared, dependency-free page editing model. Only named copy and link values are editable;
// templates, tracking attributes, forms, prices, quotations and policy data stay intact.
export const plain = (s) => String(s ?? '').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|#\d+);/gi, (x) => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[x.toLowerCase()] ?? String.fromCharCode(Number(x.slice(2,-1)))));
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safePageUrl = (s) => typeof s === 'string' && /^(?:https:\/\/[^\s<>"\\]+|\/(?!\/)[^\s<>"\\]*|#[\w-]+|mailto:[^\s<>"\\]+|tel:[+\d(). -]+)$/.test(s) && !/[\u0000-\u001f\u007f]/.test(s);
const hash = (s) => { let n=2166136261; for (let i=0;i<s.length;i++) n=Math.imul(n^s.charCodeAt(i),16777619); return (n>>>0).toString(36); };
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
export function pageTree(html) {
  const root={tag:'#root',children:[],start:0,openEnd:0,closeStart:html.length,end:html.length,attrs:{}}; const stack=[root];
  const re=/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g; let m;
  while((m=re.exec(html))) {
    if(m[0].startsWith('<!--')) continue;
    const close=/^<\//.test(m[0]); const tag=m[0].match(/^<\/?([\w:-]+)/)[1].toLowerCase();
    if(close) { const i=stack.map(n=>n.tag).lastIndexOf(tag); if(i>0) { for(let j=stack.length-1;j>=i;j--) {stack[j].closeStart=m.index;stack[j].end=re.lastIndex;} stack.length=i;} continue; }
    const attrs={}; for(const a of m[0].slice(tag.length+1,-1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]]=plain(a[2]??a[3]??a[4]??'');
    const p=stack[stack.length-1], n={tag,attrs,start:m.index,openEnd:re.lastIndex,closeStart:re.lastIndex,end:re.lastIndex,children:[],parent:p}; p.children.push(n);
    if(!VOID.has(tag)&&!m[0].endsWith('/>')) stack.push(n);
    if(['script','style','textarea'].includes(tag)) { const end=new RegExp('</'+tag+'\\s*>','ig');end.lastIndex=re.lastIndex; const e=end.exec(html); if(e) {n.closeStart=e.index;n.end=end.lastIndex;re.lastIndex=end.lastIndex;stack.pop();} }
  }
  return root;
}
const all = (n) => n.children.flatMap(c=>[c,...all(c)]);
const text = (html,n) => plain(html.slice(n.openEnd,n.closeStart).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const ancestors = (n) => {const a=[];for(let p=n.parent;p&&p.tag!=='#root';p=p.parent)a.push(p);return a;};
const blocked = (n) => {
  const cls=n.attrs.class||'';
  if (/(?:^|\s)(?:package|pkg|plan|price|rate|sizer)(?:[-_\s]|$)/.test(cls)) return true;
  return ['script','style','svg','select','button','label','form','blockquote','figcaption'].includes(n.tag) || n.attrs['aria-hidden']==='true' || n.attrs.hidden!==undefined || /(?:^|\s)(?:sr-only|photo-caption|pgrid(?:__\S+)?|case(?:__\S+)?|sizer(?:__\S+)?|package(?:__\S+|--\S+)?|pricing-notes|review(?:__\S+)?|review--\S+|reviews__rating|reviews__more|reviews__list|fn-card(?:__\S+)?|project-card(?:__\S+)?|sw-card|cpm(?:__\S+)?|pkg(?:__\S+|--\S+)?|plan(?:__\S+|--\S+)?|price-\S+|rate-\S+|needs-approval|client-logos(?:__\S+)?|faq)(?:\s|$)/.test(cls) || n.attrs['data-items']!==undefined || n.attrs['data-project']!==undefined || n.attrs.id==='com-case-h';
};
const inlineTags = new Set(['em','strong','b','i','br','a','span']);
function markdown(html,n) {
  let value=html.slice(n.openEnd,n.closeStart);
  value=value.replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g,'');
  value=value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<(em|i)\b[^>]*>/gi,'*').replace(/<\/(em|i)>/gi,'*').replace(/<(strong|b)\b[^>]*>/gi,'**').replace(/<\/(strong|b)>/gi,'**');
  value=value.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,(_,url,label)=>`[${label}](${plain(url)})`).replace(/<\/?span\b[^>]*>/gi,'');
  return plain(value).replace(/[ \t\r]+/g,' ').trim();
}
export function renderInline(value, original) {
  const kept=[];
  let s=escape(value).replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,(_,label,url)=>{
    const u=plain(url);if(!safePageUrl(u))return label;
    const source=Array.from(original.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)).find(m=>plain(m[1])===u);
    const open=source?source[0]:`<a href="${escape(u)}"${/^https:/.test(u)?' rel="noopener"':''}>`;
    return `\u0000${kept.push(open+label+'</a>')-1}\u0000`;
  });
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>kept[+i]);
}
const shorten = (s,n=64) => s.length>n?s.slice(0,n-1)+'…':s;
export function pageEditingModel(html, page, values={}) {
  const tree=pageTree(html), nodes=all(tree); const sections=nodes.filter(n=>n.tag==='section'&&!ancestors(n).some(p=>p.tag==='section'));
  const edits=[], model=[]; const copy=values._copy||{}, links=values._links||{}; const counts={};
  sections.forEach((sec,index)=>{
    const heading=all(sec).find(n=>/^h[1-3]$/.test(n.tag));
    const base=sec.attrs.id||(sec.attrs['aria-labelledby']||'').replace(/-h$/,'')||(index===0?'top':(sec.attrs.class||'').split(/\s+/).filter(s=>!['section','section--tint','on-dark','section--ink','reveal'].includes(s))[0])||'content-'+hash(heading?html.slice(heading.openEnd,heading.closeStart).replace(/\s+/g,' ').trim():sec.attrs['aria-label']||html.slice(sec.start,sec.openEnd));
    const count=counts[base]=(counts[base]||0)+1, key=base+(count>1?'-'+count:'');
    const group={key,label:index===0?'Top of page':shorten(heading?text(html,heading):sec.attrs['aria-label']||'Section '+(index+1)),fields:[],media:[],html:undefined};
    const descendants=all(sec);
    for(const n of [sec,...descendants]) {
      const ref=n.attrs['data-page-media'];if(ref&&ref.startsWith(page.file+'.'))group.media.push(ref.slice(page.file.length+1));
    }
    const eligible=(n)=>{
      const permitted=/^h[1-6]$/.test(n.tag)||['p','li','a','summary'].includes(n.tag)||(n.tag==='span'&&/(?:path__|feature__|step__)/.test(n.attrs.class||''));
      if(n.tag==='span' && (n.attrs.class||'').indexOf('path__body')>=0)return false;
      if(all(n).some(c=>c.tag==='span' && /path__/.test(c.attrs.class||'')))return false;
      if(!permitted||blocked(n)||ancestors(n).some(blocked))return false;
      if(n.children.some(c=>!inlineTags.has(c.tag))||all(n).some(c=>!inlineTags.has(c.tag)||blocked(c)))return false;
      const s=text(html,n);return s.length>1&&!/[$€£]|\b(?:copyright|cancellation|licensing|refund|1-year contract)\b/i.test(s)&&!s.includes('★');
    };
    const candidates=descendants.filter(eligible).filter(n=>!ancestors(n).some(p=>p!==sec&&eligible(p)));
    const used={};
    for(const n of candidates) {
      const original=html.slice(n.openEnd,n.closeStart), initial=markdown(html,n);if(!initial)continue;
      const baseKey=n.attrs.id||'c-'+hash(n.tag+'|'+original.replace(/\s+/g,' ').trim());const repeats=used[baseKey]=(used[baseKey]||0)+1;
      const fieldKey=key+'.'+baseKey+(repeats>1?'-'+repeats:'');
      const type=/^h[1-6]$/.test(n.tag)?'heading':n.tag==='a'?'link':n.tag==='p'&&/eyebrow/.test(n.attrs.class||'')?'label':'text';
      const field={key:fieldKey,type,label:type==='heading'?'Heading':type==='link'?'Button / link text':type==='label'?'Small label':'Text',value:initial,tag:n.tag};
      if(n.tag==='a'&&n.attrs.href)field.href=n.attrs.href;
      group.fields.push(field);
      const value=Object.prototype.hasOwnProperty.call(copy,fieldKey)?copy[fieldKey]:initial;
      if(typeof value==='string'&&value!==initial)edits.push({start:n.openEnd,end:n.closeStart,text:renderInline(value,original)+(original.match(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g)||[]).join('')});
      // Markings are inert on the public site and give the unsaved editor preview exact targets.
      edits.push({start:n.openEnd-1,end:n.openEnd-1,text:` data-page-copy="${escape(fieldKey)}"`});
      if(field.href&&links[fieldKey]&&links[fieldKey]!==field.href) {
        const open=html.slice(n.start,n.openEnd), m=open.match(/href="[^"]*"/);
        if(m)edits.push({start:n.start+m.index,end:n.start+m.index+m[0].length,text:`href="${escape(links[fieldKey])}"`});
      }
    }
    edits.push({start:sec.openEnd-1,end:sec.openEnd-1,text:` data-page-section="${escape(key)}"`});
    group.media=[...new Set(group.media)];model.push(group);
  });
  let body=html;for(const e of edits.sort((a,b)=>b.start-a.start))body=body.slice(0,e.start)+e.text+body.slice(e.end);
  const parts=sectionHtmlParts(body);
  for(const section of model){section.html=parts.find(p=>p.key===section.key)?.html||'';section.capabilities=sectionCapabilities(section);}
  return {body,sections:model};
}
export function pageEditProblems(values, model) {
  const errors=[];
  for(const k of ['_copy','_links','_seo'])if(values[k]!=null&&(typeof values[k]!=='object'||Array.isArray(values[k])))errors.push('Invalid '+k+' settings.');
  const fields=new Map(model.sections.flatMap(s=>s.fields.map(f=>[f.key,f])));
  for(const [k,v] of Object.entries(values._copy||{})) {
    if(!fields.has(k)) errors.push(`A text field has moved (${k}). Reload this page before editing it.`);
    if(typeof v!=='string'||v.length>3000||!v.trim())errors.push(`Keep ${k} to 1–3,000 characters.`);
    if(typeof v==='string'&&/\]\(\s*(?:javascript|data|vbscript):/i.test(v))errors.push('Choose a website, email, phone or page link.');
  }
  for(const [k,v] of Object.entries(values._links||{}))if(!fields.get(k)?.href||!safePageUrl(v))errors.push(`Choose a valid destination for ${k}.`);
  const seo=values._seo||{};
  for(const k of Object.keys(seo))if(!['title','description','image'].includes(k))errors.push('Unknown SEO setting.');
  if(seo.title!=null&&(typeof seo.title!=='string'||!seo.title.trim()||seo.title.length>70))errors.push('SEO title must be 1–70 characters.');
  if(seo.description!=null&&(typeof seo.description!=='string'||!seo.description.trim()||seo.description.length>180))errors.push('Search description must be 1–180 characters.');
  if(seo.image&&!safePageUrl(seo.image))errors.push('Choose a valid social image.');
  if(values._clients!=null)errors.push(...clientListProblems(values._clients));
  errors.push(...sectionLayoutProblems(values,model));
  return errors;
}

// The Architecture client board is edited in its page, alongside the other page content.
export function clientListProblems(list) {
  if(!Array.isArray(list)||list.length>100)return ['Use a list of up to 100 client brands.'];
  const errors=[];
  for(const [i,c] of list.entries()) {
    const where='Brand '+(i+1)+': ';
    if(!c||typeof c!=='object'||Array.isArray(c)){errors.push(where+'add a brand name.');continue;}
    if(typeof c.name!=='string'||!c.name.trim()||c.name.length>120)errors.push(where+'use a name of 1–120 characters.');
    if(c.wordmark!=null&&(typeof c.wordmark!=='string'||c.wordmark.length>120))errors.push(where+'keep the displayed name to 120 characters.');
    if(c.logo&&(typeof c.logo!=='string'||!safePageUrl(c.logo)||!/^\/images\/[^?#]+\.(?:png|jpe?g|webp|avif|svg)$/i.test(c.logo)||c.logo.includes('..')))errors.push(where+'choose a logo image from this website or upload one.');
    if(c.hidden!=null&&typeof c.hidden!=='boolean')errors.push(where+'choose whether to show the brand.');
    if(c.size!=null&&!['default','small','medium','large'].includes(c.size))errors.push(where+'choose a valid logo size.');
    if(c.tone!=null&&!['default','original','dark'].includes(c.tone))errors.push(where+'choose a valid logo appearance.');
    if(c.style!=null&&!/^[a-z-]{1,40}$/.test(c.style))errors.push(where+'choose a valid brand style.');
    for(const k of ['width','height'])if(c[k]!=null&&(!Number.isInteger(c[k])||c[k]<=0||c[k]>20000))errors.push(where+'the logo dimensions are invalid.');
  }
  return [...new Set(errors)];
}
export function renderClientBrands(list) {
  return (list||[]).filter(c=>!c.hidden).map(c=>`<li class="client-logos__item client-logos__item--${escape(c.style||'standard')}"${c.size&&c.size!=='default'?` data-brand-size="${escape(c.size)}"`:''}${c.tone&&c.tone!=='default'?` data-logo-tone="${escape(c.tone)}"`:''}>${c.logo
    ? `<img src="${escape(c.logo)}" alt="${escape(c.name)}"${c.width&&c.height?` width="${c.width}" height="${c.height}"`:''} loading="lazy" decoding="async">`
    : `<span class="client-logos__wordmark">${escape(c.wordmark||c.name)}${c.wordmark&&c.name!==c.wordmark?`<small>${escape(c.name)}</small>`:''}</span>`}</li>`).join('');
}
export function renderClientBoard(list) {
  const brands=renderClientBrands(list);if(!brands)return '';
  return `<section class="client-logos" data-client-logos aria-labelledby="arch-clients-h">
  <div class="wrap client-logos__heading"><h2 class="eyebrow" id="arch-clients-h">Clients we work with</h2><button type="button" class="client-logos__toggle" data-client-logos-toggle aria-controls="arch-client-board" aria-pressed="false" hidden>Pause scrolling</button></div>
  <div class="client-logos__viewport" id="arch-client-board" tabindex="0" role="region" aria-label="Client logos. Scroll to see all clients.">
    <div class="client-logos__track"><ul class="client-logos__group" role="list">${brands}</ul><ul class="client-logos__group client-logos__copy" aria-hidden="true" inert>${brands}</ul></div>
  </div>
</section>`;
}

// Page section instances. Original sections retain their keys; copies own their text/media
// snapshots. Removed entries stay in this list so Restore also works after Save/reload.
export const SECTION_LIBRARY = [
  {type:'text',label:'Text',description:'A heading, paragraphs and an optional button.'},
  {type:'split',label:'Text + photo or video',description:'Text beside a photo or film; choose the media side.'},
  {type:'media',label:'Photo or video',description:'A full photo or playable film, with an optional heading.'},
  {type:'gallery',label:'Gallery',description:'Your own selection of photos and films, in your order.'},
  {type:'cta',label:'Call to action',description:'A clear next step with a button.'},
];
const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
export function sectionMediaGroups(sections, slots=[]) {
  const groups=sections.map(s=>({...s,media:[...(s.media||[])]})),used=new Set(groups.flatMap(s=>s.media));
  const fallbacks={teamMedia:'about-james',locationMedia:'about-purpose',studioMedia:'about-studio',clientVideo:'reviews',closing:'closing',selectedWork:'selected-work',portfolio:'portfolio',introMedia:'project-inquiry',hero:'top',caseStudy:'case-study',clientWork:'portfolio',examples:'portfolio',openingExamples:'cs-story',sessionOther:'sessions',askFirstMedia:'agency-ask',introPhoto:'approach',storyPhoto:'which-story',storyBrand:'which-story',detailPhoto:'why',designDetail:'arch-detail',stepTell:'how-it-works',stepPlan:'how-it-works',stepProduce:'how-it-works',listingsTile:'quick',brandTile:'quick',pathRealEstate:'paths',pathArchitecture:'paths',pathCommercial:'paths',pathCreator:'paths',coverageFilm:'re-coverage',featurePhotography:'re-coverage',featureVideo:'re-coverage',featureDrone:'re-coverage',featureFloorPlan:'re-coverage',featureTwilight:'re-coverage',featureAgent:'re-coverage',loopLuxury:'section--pricing',loopSignature:'section--pricing',loopSocial:'section--pricing',starterStills:'section--pricing',rowPhotography:'section--pricing',rowPhotoFloorPlan:'section--pricing',rowFloorPlan:'section--pricing',rowExteriorDrone:'section--pricing',rowTwilight:'section--pricing',whyFilm:'ac-why',shootDayPhoto:'ac-day',featureBrand:'com-value',featureFilm:'com-value',featureStudio:'com-value',featureRecurring:'com-value',agencyPhoto:'agencies',sessionPodcast:'sessions',sessionContent:'sessions',sessionMonthly:'sessions',spaceReel:'cs-space',formatPodcasts:'formats',formatMulticam:'formats',formatLongform:'formats',formatSolo:'formats',formatShort:'formats',formatPlanned:'formats',conversations:'cs-conv'};
  for(const slot of slots) {
    const name=slot.key||slot.name;if(used.has(name))continue;
    let group=groups.find(s=>s.key===fallbacks[name]);
    if(!group&&name==='selectedWork')group=groups.find(s=>s.key==='portfolio');
    if(!group&&name==='closing')group=groups[groups.length-1];
    if(group){group.media.push(name);used.add(name);}
  }
  return groups;
}
export function sectionCapabilities(section) {
  const html=section.html||'',top=section.key==='top'||/<h1\b/i.test(html);
  const form=/<form\b/i.test(html),pricing=/section--pricing|id="sqft"/.test(html),policy=section.key==='about-details';
  const interactive=/data-showcase|data-gallery-items|data-work-gallery|data-tabs|class="[^"]*\b(?:faq|reviews|pgrid|case|client-logos)\b/.test(html);
  return {move:!top,remove:!top&&!form&&!pricing&&!policy,duplicate:!top&&!form&&!pricing&&!policy&&!interactive,
    reason:top?'The page opening stays first so the page keeps one main heading.':form?'The project form stays on this page.':pricing?'Keep one working pricing calculator.':policy?'Approved usage information stays available.':interactive?'This section uses shared or interactive content. Add a new gallery, media or text section for another block.':''};
}
export function sectionLayout(model, values={}) {
  return Array.isArray(values._sections)?clone(values._sections):model.sections.map(s=>({id:s.key,source:s.key}));
}
export function sectionId() {return 'section-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
export function newPageSection(type,id=sectionId()) {
  if(!SECTION_LIBRARY.some(t=>t.type===type))throw new Error('Choose a section from the section library.');
  return {id,type,title:'',body:'',theme:'light',width:'standard',side:'right',...(type==='gallery'?{items:[]}:{}),...(['split','media'].includes(type)?{media:null}:{}),...(type==='cta'?{button:{label:'Send a Project Brief',href:'/contact'}}:{})};
}
export function duplicatePageSection(instance, model, values={}, id=sectionId()) {
  if(instance.type)return {...clone(instance),id,hidden:false};
  const source=model.sections.find(s=>s.key===instance.source);
  if(!source||!sectionCapabilities(source).duplicate)throw new Error('This section cannot be duplicated.');
  if(instance.id!==instance.source)return {...clone(instance),id,hidden:false};
  const copy={},links={},media={};
  for(const f of source.fields){copy[f.key]=Object.prototype.hasOwnProperty.call(values._copy||{},f.key)?values._copy[f.key]:f.value;if(f.href)links[f.key]=(values._links||{})[f.key]||f.href;}
  for(const k of source.media||[])media[k]=clone(values[k]??null);
  return {id,source:instance.source,copy,links,media};
}
export function sectionInstanceValues(instance,values={}) {
  return instance&&instance.source&&instance.id!==instance.source?{...values,...clone(instance.media||{}),_copy:{...(values._copy||{}),...(instance.copy||{})},_links:{...(values._links||{}),...(instance.links||{})}}:values;
}
export function sectionLayoutProblems(values,model) {
  if(values._sections==null)return [];
  if(!Array.isArray(values._sections))return ['The page section list is invalid.'];
  const errors=[],ids=new Set(),native=new Map(model.sections.map(s=>[s.key,s]));
  if(values._sections.length>50)errors.push('Use no more than 50 sections on one page, including removed sections.');
  for(const [i,s] of values._sections.entries()) {
    if(!s||typeof s!=='object'||Array.isArray(s)){errors.push('A section is invalid.');continue;}
    if(!/^[a-zA-Z0-9][\w-]{0,99}$/.test(s.id||'')||ids.has(s.id))errors.push('Every section needs a unique identifier.');ids.add(s.id);
    if(s.hidden!=null&&typeof s.hidden!=='boolean')errors.push('A removed-section setting is invalid.');
    if(s.source) {
      const source=native.get(s.source);if(!source){if(s.id!==s.source)errors.push('A source section has moved. Reload before saving.');continue;}
      const caps=sectionCapabilities(source);
      if(s.id!==s.source&&!caps.duplicate)errors.push('This shared or required section cannot be duplicated.');
      if(s.id===s.source&&s.hidden&&!caps.remove)errors.push('This required section must stay on the page.');
      if(s.id===s.source&&!caps.move&&i!==0)errors.push('The page opening must stay first.');
      for(const [key,v] of Object.entries(s.copy||{}))if(!source.fields.some(f=>f.key===key)||typeof v!=='string'||!v.trim()||v.length>3000)errors.push('A duplicated text field is invalid.');
      for(const [key,v] of Object.entries(s.links||{}))if(!source.fields.some(f=>f.key===key&&f.href)||!safePageUrl(v))errors.push('A duplicated link destination is invalid.');
      for(const key of Object.keys(s.media||{}))if(!(source.media||[]).includes(key))errors.push('A duplicated media placement is invalid.');
    } else {
      if(!SECTION_LIBRARY.some(t=>t.type===s.type))errors.push('Choose a supported section type.');
      for(const k of ['title','body','eyebrow'])if(s[k]!=null&&(typeof s[k]!=='string'||s[k].length>(k==='body'?5000:200)))errors.push('Keep section text within its field limit.');
      if(!['light','tint','dark'].includes(s.theme||'light')||!['narrow','standard','wide'].includes(s.width||'standard')||!['left','right'].includes(s.side||'right'))errors.push('Choose a valid section appearance.');
      if(!s.hidden&&['text','split','cta'].includes(s.type)&&!(s.title||'').trim()&&!(s.body||'').trim())errors.push('Add a heading or text to the new section.');
      if(!s.hidden&&['split','media'].includes(s.type)&&!s.media)errors.push('Choose a photo or film for the new section.');
      if(s.type==='gallery'&&(!Array.isArray(s.items)||s.items.length>24||(!s.hidden&&!s.items.length)))errors.push('Choose 1–24 gallery items.');
      if(s.button&&(typeof s.button.label!=='string'||!s.button.label.trim()||s.button.label.length>100||!safePageUrl(s.button.href)))errors.push('Add button text and a valid destination.');
      if(s.type==='cta'&&!s.button)errors.push('The call to action needs a button.');
    }
  }
  for(const s of model.sections)if(!sectionCapabilities(s).remove&&!values._sections.some(x=>x&&x.id===s.key&&x.source===s.key&&!x.hidden))errors.push('Restore the required '+s.label+' section.');
  return [...new Set(errors)];
}
export function sectionHtmlParts(body) {
  const nodes=all(pageTree(body)).filter(n=>n.tag==='section'&&n.attrs['data-page-section']&&!ancestors(n).some(p=>p.tag==='section'));
  return nodes.map(n=>({key:n.attrs['data-page-section'],start:n.start,end:n.end,html:body.slice(n.start,n.end)}));
}
export function isolateSectionHtml(html,id) {
  const nodes=all(pageTree(html)),ids=new Map(nodes.filter(n=>n.attrs.id).map(n=>[n.attrs.id,n.attrs.id+'--'+id]));
  const edits=[];
  for(const n of nodes) {
    const open=html.slice(n.start,n.openEnd);let next=open;
    next=next.replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls|href)="([^"]*)"/g,(m,k,v)=>{
      const prefix=k==='href'?'#':'';if(prefix&&!v.startsWith('#'))return m;
      const parts=(prefix?v.slice(1):v).split(/\s+/).map(t=>ids.get(t)||t);return `${k}="${prefix}${parts.join(' ')}"`;
    });
    next=next.replace(/url\(#([^)]+)\)/g,(m,k)=>ids.has(k)?'url(#'+ids.get(k)+')':m);
    if(next!==open)edits.push({start:n.start,end:n.openEnd,text:next});
  }
  let result=html;for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.text+result.slice(e.end);
  return result.replace(/data-page-section="[^"]*"/,`data-page-section="${escape(id)}"`);
}
export function renderNewSection(s, renderMedia=(it)=>it&&it.src?`<img src="${escape(it.src)}" alt="${escape(it.alt||'')}">`:'') {
  const theme=s.theme==='dark'?' section--ink on-dark':s.theme==='tint'?' section--tint':'';
  const heading=s.title?`<h2 class="h2" id="${escape(s.id)}-heading">${renderInline(s.title,'')}</h2>`:'';
  const body=(s.body||'').split(/\n\s*\n/).filter(x=>x.trim()).map(x=>`<p>${renderInline(x,'')}</p>`).join('');
  const button=s.button?`<p class="actions"><a class="btn ${s.theme==='dark'?'btn--gold':'btn--solid'}" href="${escape(s.button.href)}" data-track="project_click" data-track-location="custom_section">${escape(s.button.label)}</a></p>`:'';
  const writing=`<div class="page-section__text">${s.eyebrow?`<p class="eyebrow">${escape(s.eyebrow)}</p>`:''}${heading}${body}${button}</div>`;
  let contents=writing;
  if(s.type==='split')contents=`<div class="page-section__split${s.side==='left'?' page-section__split--left':''}">${writing}<div class="page-section__media">${renderMedia(s.media,0)}</div></div>`;
  if(s.type==='media')contents=writing+`<div class="page-section__media">${renderMedia(s.media,0)}</div>`;
  if(s.type==='gallery')contents=writing+`<div class="page-section__gallery">${(s.items||[]).map((it,i)=>`<div class="page-section__gallery-item">${renderMedia(it,i)}</div>`).join('')}</div>`;
  return `<section class="section page-section page-section--${escape(s.type)}${theme}" id="${escape(s.id)}" data-page-section="${escape(s.id)}"${s.title?` aria-labelledby="${escape(s.id)}-heading"`:''}><div class="wrap page-section__wrap${s.width==='narrow'?' narrow':s.width==='wide'?' page-section__wrap--wide':''}">${contents}</div></section>`;
}
export function composePageSections(body,model,values={},renderCopy=(instance,source)=>source.html,renderMedia, options={}) {
  if(values._sections==null)return body;
  const errors=options.draft?[]:sectionLayoutProblems(values,model);if(errors.length)throw new Error(errors.join(' '));
  const parts=sectionHtmlParts(body);if(!parts.length)return body;
  const sources=new Map(model.sections.map(s=>[s.key,s]));
  const chunks=sectionLayout(model,values).map(instance=>{
    const source=instance.source&&sources.get(instance.source);
    if(instance.hidden){if(!source||instance.id!==instance.source)return '';const nodes=all(pageTree(source.html));return nodes.filter(n=>n.attrs.id&&(/^(?:section|h[1-6])$/.test(n.tag))).map(n=>`<span id="${escape(n.attrs.id)}" class="page-section-anchor" aria-hidden="true"></span>`).join('');}
    if(instance.source&&!source)return '';
    if(instance.type)return renderNewSection(instance,renderMedia);
    return instance.id===instance.source?source.html:isolateSectionHtml(renderCopy(instance,source),instance.id);
  });
  // Non-section content is kept once; native template sections are replaced only when a layout was saved.
  const gaps=parts.slice(0,-1).map((p,i)=>body.slice(p.end,parts[i+1].start)).filter(s=>s.trim()).join('');
  return body.slice(0,parts[0].start)+chunks.join('\n')+gaps+body.slice(parts[parts.length-1].end);
}

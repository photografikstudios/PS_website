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
    const base=sec.attrs.id||(sec.attrs['aria-labelledby']||'').replace(/-h$/,'')||(index===0?'top':(sec.attrs.class||'').split(/\s+/).filter(s=>!['section','section--tint','on-dark','section--ink','reveal'].includes(s))[0])||'section-'+(index+1);
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
  return errors;
}

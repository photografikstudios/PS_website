import {esc, focalPosition} from './html.js';

export function renderSectionMedia(ctx, item, index=0) {
  if(!item)return '';
  const m=item.media?ctx.work.media.find(m=>m.id===item.media):null;
  if(m&&(!ctx.visible(m)||m.rights!=='approved'))return '';
  const src=item.src||m?.src;if(!src)return '';
  const alt=item.alt||m?.alt||m?.title||'',focus=focalPosition(item.focal||m?.focal)||'50% 50%';
  const size=ctx.imageInfo(item.src||m?.poster||m?.src),vertical=size?size.height>size.width:m?.orientation==='vertical';
  const ratio=size?`${size.width}/${size.height}`:vertical?'9/16':'3/2';
  const attrs=`data-page-media="custom.${index}" data-media-layout="natural" data-media-size="${esc(item.size||'default')}" data-media-fit="${esc(item.fit||'default')}" data-media-shape="${vertical?'vertical':'horizontal'}" data-media-focus style="--pm-ratio:${ratio};--pm-focus:${focus}"`;
  const content=m?.type==='video'?ctx.videoPlayer(m):`<a href="${esc(ctx.mediaUrl(src))}" data-section-image aria-label="View photo: ${esc(alt)}">${ctx.img(src,{alt,focal:item.focal||m?.focal,sizes:'(min-width: 900px) 45vw, 100vw'})}</a>`;
  return `<div class="page-section__asset" ${attrs}>${content}</div>`;
}

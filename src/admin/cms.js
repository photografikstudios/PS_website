/* global CMS, h, createClass */
// Site dashboard setup: site styles in the preview pane, a block for Photografik library media, and previews that
// follow the live article and project templates closely enough to proofread (the real check is the Vercel preview).
(function () {
  var config = window.PHOTOGRAFIK_CMS_CONFIG;
  // Sign-in runs through this site's own /api/cms-auth (never a third-party auth service).
  if (!config.backend.base_url) config.backend.base_url = window.location.origin;
  var library = window.PHOTOGRAFIK_LIBRARY || [];
  var byId = {};
  library.forEach(function (m) { byId[m.value] = m; });

  CMS.registerPreviewStyle('/assets/styles.css');
  CMS.registerPreviewStyle('/admin/preview.css');

  CMS.registerEditorComponent({
    id: 'libraryMedia',
    label: 'Photografik library photo or film',
    fields: [{ name: 'id', label: 'Library item', widget: 'select', options: library }],
    pattern: /^::media\[([a-z0-9-]+)\]$/m,
    fromBlock: function (m) { return { id: m[1] }; },
    toBlock: function (d) { return '::media[' + (d.id || '') + ']'; },
    toPreview: function (d) {
      var m = byId[d.id];
      if (!m) return '<p><em>Choose a library item</em></p>';
      return '<figure class="fn-figure"><img src="' + m.image + '" alt=""><figcaption>' + m.label + '</figcaption></figure>';
    },
  });

  var Preview = createClass({
    render: function () {
      var e = this.props.entry;
      var get = function (k) { return e.getIn(['data', k]); };
      var hero = get('hero');
      var heroSrc = hero ? this.props.getAsset(hero) : null;
      var cats = {};
      (window.PHOTOGRAFIK_CATEGORIES || []).forEach(function (c) { cats[c.value] = c.label; });
      return h('article', { className: 'fn-article' },
        h('div', { className: 'wrap fn-narrow', style: { paddingTop: '32px' } },
          get('published') ? null : h('p', { className: 'fn-draft' }, h('strong', {}, 'Draft, not published. '), 'This article stays off the live site until Published is switched on.'),
          h('p', { className: 'fn-crumbs' }, 'Field Notes / ' + (cats[get('category')] || '')),
          h('h1', { className: 'display fn-article__title' }, get('title') || 'Untitled'),
          h('p', { className: 'fn-answer' }, get('answer') || get('excerpt') || ''),
          heroSrc ? h('figure', { className: 'fn-figure fn-hero' }, h('img', { src: heroSrc.toString(), alt: get('heroAlt') || '' })) : null,
          h('div', { className: 'fn-body' }, this.props.widgetFor('body'))));
    },
  });
  CMS.registerPreviewTemplate('field-notes', Preview);

  // Projects: name, service, intro and the photos in the order they will appear, with draft and missing-text warnings.
  var FOCAL = { top: '50% 15%', 'upper-third': '50% 30%', bottom: '50% 85%', left: '20% 50%', right: '80% 50%' };
  var catLabels = {};
  (window.PHOTOGRAFIK_WORK_CATEGORIES || []).forEach(function (c) { catLabels[c.value] = c.label; });
  var ProjectPreview = createClass({
    render: function () {
      var e = this.props.entry; var self = this;
      var get = function (k) { return e.getIn(['data', k]); };
      var photos = (get('photos') || []).toJS ? get('photos').toJS() : (get('photos') || []);
      var warn = [];
      if (get('rights') !== 'approved') warn.push('Rights are not marked Approved: it cannot be published yet.');
      photos.forEach(function (p, i) { if (!p.alt) warn.push('Photo ' + (i + 1) + ' needs a description.'); });
      if (get('hero') && !get('heroAlt')) warn.push('The main image needs a description.');
      var fig = function (src, alt, focal, key) {
        var a = src ? self.props.getAsset(src) : null;
        return a ? h('figure', { key: key, className: 'dash-fig' }, h('img', { src: a.toString(), alt: alt || '', style: { objectPosition: FOCAL[focal] || '50% 50%' } }), h('figcaption', {}, alt || 'No description yet')) : null;
      };
      return h('article', { className: 'project dash-project' },
        h('div', { className: 'wrap', style: { paddingTop: '32px' } },
          get('published') ? null : h('p', { className: 'fn-draft' }, h('strong', {}, 'Draft, not published. '), 'The preview site shows it with this note; the live site leaves it out until Published is switched on.'),
          warn.length ? h('ul', { className: 'dash-warn' }, warn.map(function (w, i) { return h('li', { key: i }, w); })) : null,
          h('p', { className: 'eyebrow' }, (catLabels[get('category')] || '') + (get('location') ? ' · ' + get('location') : '')),
          h('h1', { className: 'display' }, get('title') || 'Untitled project'),
          get('story') ? h('p', { className: 'lede' }, get('story')) : null,
          get('client') ? h('p', {}, h('strong', {}, 'Client: '), get('client')) : null,
          fig(get('hero'), get('heroAlt'), get('heroFocal'), 'hero'),
          h('div', { className: 'dash-grid' }, photos.map(function (p, i) { return fig(p.image, p.alt, p.focal, 'p' + i); }))));
    },
  });
  CMS.registerPreviewTemplate('projects', ProjectPreview);

  var PhotoPreview = createClass({
    render: function () {
      var e = this.props.entry; var get = function (k) { return e.getIn(['data', k]); };
      var a = get('src') ? this.props.getAsset(get('src')) : null;
      return h('div', { className: 'wrap', style: { paddingTop: '32px' } },
        get('published') ? null : h('p', { className: 'fn-draft' }, h('strong', {}, 'Hidden. '), 'This photo is left out of the live galleries.'),
        h('div', { className: 'dash-cards' }, ['16 / 9', '4 / 3', '3 / 4'].map(function (r) {
          return h('figure', { key: r, className: 'dash-fig' }, a ? h('img', { src: a.toString(), alt: get('alt') || '', style: { aspectRatio: r, objectFit: 'cover', objectPosition: FOCAL[get('focal')] || '50% 50%' } }) : null, h('figcaption', {}, 'Card crop ' + r));
        })),
        h('p', {}, h('strong', {}, 'Description: '), get('alt') || 'none yet'));
    },
  });
  CMS.registerPreviewTemplate('photos', PhotoPreview);

  // Decap's toolbar says "Publish" for what is really "save to the review copy". On this site "Published" is the
  // switch on each item, so the toolbar words are changed to Save to keep the two ideas apart for the owner.
  CMS.registerLocale('ps', { editor: { editorToolbar: {
    publish: 'Save', published: 'Saved', publishing: 'Saving…', publishNow: 'Save now',
    publishAndCreateNew: 'Save and create new', publishAndDuplicate: 'Save and duplicate',
  } } });
  config.locale = 'ps';
  CMS.init({ config: config });
})();

/* global CMS, h, createClass */
// Field Notes editor setup: site styles in the preview pane, a block for Photografik library media,
// and a preview that follows the live article template closely enough to proofread.
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

  CMS.init({ config: config });
})();

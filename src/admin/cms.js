/* global CMS, h, createClass */
// Site dashboard setup: site styles in the preview pane, a block for Photografik library media, and previews that
// follow the live article and project templates closely enough to proofread (the real check is the Vercel preview).
(function () {
  var config = window.PHOTOGRAFIK_CMS_CONFIG;
  // Sign-in runs through this site's own /api/cms-auth (never a third-party auth service).
  if (!config.backend.base_url) config.backend.base_url = window.location.origin;
  // "View Live" opens the site this dashboard is running on: the review preview now, photografikstudios.com after
  // launch (James, Oct 2 2026). Only the canonical host keeps the canonical address.
  if (window.location.origin !== config.site_url) { config.site_url = window.location.origin; config.display_url = window.location.origin; }
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
      // Historic records that were never cleared keep their pending state (set before Oct 2 2026); say so plainly.
      if (get('rights') === 'pending') warn.push('This older project was never cleared to show. Ask us to clear it before switching Published on.');
      photos.forEach(function (p, i) { if (!p.alt) warn.push('Photo ' + (i + 1) + ' needs a description.'); });
      if (get('hero') && !get('heroAlt')) warn.push('The main image needs a description.');
      var fig = function (src, alt, focal, key) {
        var a = src ? (thumbs[src] || self.props.getAsset(src).toString()) : null;
        return a ? h('figure', { key: key, className: 'dash-fig' }, h(Thumb, { src: a, path: src, alt: alt || '' }), h('figcaption', {}, alt || 'No description yet')) : null;
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

  // ---------- Photos: our own upload widgets (Oct 3 2026) ----------
  // Decap's stock image widget showed a broken thumbnail for a photo chosen in an unsaved entry (it asks the site for
  // /images/projects/<file> before that file exists anywhere; reproduced with Decap 3.16.3 and the latest release, in
  // Chrome and Firefox). These widgets keep a local preview of every file picked in this session, add the files to the
  // entry as draft media through Decap (so they are committed together with the entry on Save, exactly as before) and,
  // for photos already saved, fall back to the copy in the public GitHub repository until the next deployment has it.
  var thumbs = window.__pgkThumbs = window.__pgkThumbs || {};
  var repoRaw = 'https://raw.githubusercontent.com/' + config.backend.repo + '/' + encodeURIComponent(config.backend.branch || 'main').replace(/%2F/g, '/') + '/static';
  var ACCEPT = 'image/jpeg,image/png,image/webp';
  var thumbFor = function (path, getAsset, field) {
    if (!path) return '';
    if (thumbs[path]) return thumbs[path];
    try { var a = getAsset && getAsset(path, field); var s = a && a.toString(); if (s && /^blob:|^data:/.test(s)) return s; } catch (e) { /* fall through */ }
    return path;
  };
  // <img> that tries the site copy, then the repository copy, then says what is wrong instead of a broken icon.
  var Thumb = createClass({
    getInitialState: function () { return { step: 0 }; },
    componentDidUpdate: function (prev) { if (prev.src !== this.props.src && this.state.step) this.setState({ step: 0 }); },
    render: function () {
      var p = this.props; var src = p.src; var step = this.state.step; var self = this;
      if (!src) return h('div', { className: 'pgk-thumb pgk-thumb--empty' }, 'No photo yet');
      var url = step === 0 ? src : step === 1 && /^\/images\//.test(p.path || '') ? repoRaw + p.path : null;
      if (!url) return h('div', { className: 'pgk-thumb pgk-thumb--missing', role: 'img', 'aria-label': 'Preview not available yet' }, 'Preview not available yet. It will appear once the site has updated.');
      return h('img', { className: 'pgk-thumb', src: url, alt: p.alt || '', onError: function () { self.setState({ step: step + 1 }); }, onLoad: function (e) { if (p.onSize) p.onSize(e.target.naturalWidth, e.target.naturalHeight); } });
    },
  });
  var publicPathFor = function (field, repoPath) {
    var media = String(field.get('media_folder') || '').replace(/^\/+/, '');
    var pub = field.get('public_folder') || '';
    var name = String(repoPath).split('/').pop();
    return (pub ? pub.replace(/\/+$/, '') : '/' + media.replace(/^static\//, '')) + '/' + name;
  };
  function addFiles(props, files) {
    var list = Array.prototype.slice.call(files || []);
    var bad = list.filter(function (f) { return ACCEPT.split(',').indexOf(f.type) < 0; });
    var ok = list.filter(function (f) { return ACCEPT.split(',').indexOf(f.type) >= 0 && f.size <= 5000000; });
    var big = list.filter(function (f) { return ACCEPT.split(',').indexOf(f.type) >= 0 && f.size > 5000000; });
    var msgs = [];
    if (bad.length) msgs.push(bad.map(function (f) { return f.name; }).join(', ') + ': please export as JPG, PNG or WebP (iPhone HEIC photos do not display in browsers).');
    if (big.length) msgs.push(big.map(function (f) { return f.name; }).join(', ') + ': larger than 5 MB. Export about 2,400 px on the long side.');
    // Every upload gets a clean, unique name from the entry title (camera names such as PS_00314 or DJI_0042 never reach
    // the public site, and a second "IMG_0001.jpg" can never replace an earlier photo with the same name).
    var data = props.entry && props.entry.get && props.entry.get('data');
    var typed = document.querySelector('input[id^="title-field"]'); // the entry prop can lag one keystroke behind
    var base = String((data && (data.get('title') || data.get('shortTitle'))) || (typed && typed.value) || 'photo').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
    // The name ends in a fingerprint of the photo itself: the same photo picked twice (say as the main image and in the
    // gallery) is one file with one address, because Decap keeps only one copy of identical files in a save.
    var fingerprint = function (f) {
      if (!(window.crypto && crypto.subtle)) return Promise.resolve(Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      return f.arrayBuffer().then(function (buf) { return crypto.subtle.digest('SHA-256', buf); })
        .then(function (d) { return Array.prototype.map.call(new Uint8Array(d).slice(0, 5), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); });
    };
    return Promise.all(ok.map(function (orig) {
      var ext = orig.type === 'image/png' ? 'png' : orig.type === 'image/webp' ? 'webp' : 'jpg';
      return fingerprint(orig).then(function (fp) {
        var file = new File([orig], base + '-' + fp + '.' + ext, { type: orig.type, lastModified: orig.lastModified });
        return Promise.resolve(props.onPersistMedia(file, { field: props.field })).then(function (action) { return { action: action, file: file }; });
      }).then(function (res) {
        var action = res.action; var file = res.file;
        var mf = action && action.payload && (action.payload.mediaFile || action.payload);
        var repoPath = (mf && mf.path) || file.name;
        var path = publicPathFor(props.field, repoPath);
        thumbs[path] = URL.createObjectURL(file);
        return path;
      });
    })).then(function (paths) { return { paths: paths, msgs: msgs }; });
  }
  var FOCAL_OPTIONS = [['center', 'Centre'], ['top', 'Top'], ['upper-third', 'Upper third'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']];
  // Always a fresh copy: handing Decap the same array it gave us (mutated in place) is not seen as a change.
  var toArr = function (v) { return !v ? [] : v.toJS ? v.toJS() : Array.isArray(v) ? v.map(function (x) { return Object.assign({}, x); }) : []; };

  // Several photos in one action: thumbnails, a description for each, focus, move up/down, remove.
  var GalleryControl = createClass({
    getInitialState: function () { return { busy: false, msgs: [], sizes: {} }; },
    pick: function () { this.input && this.input.click(); },
    onFiles: function (e) {
      var self = this; var files = e.target.files; self.setState({ busy: true, msgs: [] });
      addFiles(this.props, files).then(function (r) {
        var arr = toArr(self.props.value).concat(r.paths.map(function (p) { return { image: p, alt: '', focal: 'center', orientation: 'auto' }; }));
        self.props.onChange(arr); self.setState({ busy: false, msgs: r.msgs });
      }).catch(function (err) { self.setState({ busy: false, msgs: ['Upload failed: ' + err] }); });
      e.target.value = '';
    },
    update: function (i, key, val) { var arr = toArr(this.props.value); arr[i] = Object.assign({}, arr[i], (function () { var o = {}; o[key] = val; return o; })()); this.props.onChange(arr); },
    move: function (i, d) { var arr = toArr(this.props.value); var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; this.props.onChange(arr); },
    remove: function (i) {
      var arr = toArr(this.props.value); arr.splice(i, 1);
      this.props.onChange(arr);
    },
    render: function () {
      var self = this; var arr = toArr(this.props.value); var id = this.props.forID;
      return h('div', { className: 'pgk-gallery', id: id },
        h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: this.pick, disabled: this.state.busy }, this.state.busy ? 'Adding photos…' : arr.length ? 'Add more photos' : 'Add photos'),
          h('span', { className: 'pgk-gallery__count' }, arr.length ? arr.length + (arr.length === 1 ? ' photo' : ' photos') + '. The first one leads.' : 'Choose several at once: hold Shift or Command.'),
          h('input', { type: 'file', multiple: true, accept: ACCEPT, hidden: true, ref: function (el) { self.input = el; }, onChange: this.onFiles, 'aria-label': 'Choose photos' })),
        this.state.msgs.length ? h('ul', { className: 'pgk-msg', role: 'alert' }, this.state.msgs.map(function (m, i) { return h('li', { key: i }, m); })) : null,
        h('ol', { className: 'pgk-gallery__list' }, arr.map(function (ph, i) {
          var sz = self.state.sizes[ph.image];
          return h('li', { key: ph.image + i, className: 'pgk-row' },
            h(Thumb, { src: thumbFor(ph.image, self.props.getAsset, self.props.field), path: ph.image, alt: ph.alt, onSize: function (w, ht) { if (!sz) { var s = Object.assign({}, self.state.sizes); s[ph.image] = [w, ht]; self.setState({ sizes: s }); } } }),
            h('div', { className: 'pgk-row__fields' },
              h('label', {}, h('span', {}, 'Description (alt text)' + (ph.alt ? '' : ' · needed before publishing')), h('input', { type: 'text', value: ph.alt || '', placeholder: 'e.g. Kitchen with a marble island and brass pendant lights', onChange: function (e) { self.update(i, 'alt', e.target.value); } })),
              h('label', {}, h('span', {}, 'Focus when cropped'), h('select', { value: ph.focal || 'center', onChange: function (e) { self.update(i, 'focal', e.target.value); } }, FOCAL_OPTIONS.map(function (o) { return h('option', { key: o[0], value: o[0] }, o[1]); }))),
              h('p', { className: 'pgk-row__file' }, String(ph.image).split('/').pop() + (sz ? ' · ' + sz[0] + '×' + sz[1] + ' px' + (Math.max(sz[0], sz[1]) < 1200 ? ' · too small for the site (1,600 px or more)' : '') : ''))),
            h('div', { className: 'pgk-row__tools' },
              h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, -1); }, disabled: i === 0, 'aria-label': 'Move photo ' + (i + 1) + ' up' }, '↑'),
              h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, 1); }, disabled: i === arr.length - 1, 'aria-label': 'Move photo ' + (i + 1) + ' down' }, '↓'),
              h('button', { type: 'button', className: 'pgk-icon pgk-icon--danger', onClick: function () { self.remove(i); }, 'aria-label': 'Remove photo ' + (i + 1) }, '✕')));
        })));
    },
  });
  CMS.registerWidget('pgk-gallery', GalleryControl);

  // One photo (main image, hero, Field Notes hero): same upload path and thumbnails as the gallery.
  var PhotoControl = createClass({
    getInitialState: function () { return { busy: false, msgs: [] }; },
    onFiles: function (e) {
      var self = this; self.setState({ busy: true, msgs: [] });
      addFiles(this.props, [e.target.files[0]].filter(Boolean)).then(function (r) { if (r.paths[0]) self.props.onChange(r.paths[0]); self.setState({ busy: false, msgs: r.msgs }); })
        .catch(function (err) { self.setState({ busy: false, msgs: ['Upload failed: ' + err] }); });
      e.target.value = '';
    },
    render: function () {
      var self = this; var v = this.props.value || '';
      return h('div', { className: 'pgk-photo', id: this.props.forID },
        h(Thumb, { src: thumbFor(v, this.props.getAsset, this.props.field), path: v }),
        h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.input.click(); }, disabled: this.state.busy }, this.state.busy ? 'Adding…' : v ? 'Replace photo' : 'Choose photo'),
          v ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.props.onChange(''); } }, 'Remove') : null,
          h('input', { type: 'file', accept: ACCEPT, hidden: true, ref: function (el) { self.input = el; }, onChange: this.onFiles, 'aria-label': 'Choose a photo' })),
        this.state.msgs.length ? h('ul', { className: 'pgk-msg', role: 'alert' }, this.state.msgs.map(function (m, i) { return h('li', { key: i }, m); })) : null);
    },
  });
  CMS.registerWidget('pgk-photo', PhotoControl);

  // Phones: Decap's editor has an 800 px minimum width, so a phone zooms the whole page out. Below 800 px the
  // side-by-side preview is hidden (the Vercel preview link is the real check) and the form takes the full width.
  var phoneCss = document.createElement('style');
  phoneCss.textContent = '@media (max-width: 799px) {' +
    '[class*="-EditorContainer"], [class*="-ToolbarContainer"] { min-width: 0 !important; }' +
    '.SplitPane > .Pane2, .SplitPane > .Resizer { display: none !important; }' +
    '.SplitPane > .Pane1 { width: 100% !important; flex: 1 1 auto !important; }' +
    '[class*="-ToolbarContainer"] { overflow-x: auto; }' +
    '}';
  document.head.appendChild(phoneCss);

  // Decap's toolbar says "Publish" for what is really "save to the review copy". On this site "Published" is the
  // switch on each item, so the toolbar words are changed to Save to keep the two ideas apart for the owner.
  CMS.registerLocale('ps', { editor: { editorToolbar: {
    publish: 'Save', published: 'Saved', publishing: 'Saving…', publishNow: 'Save now',
    publishAndCreateNew: 'Save and create new', publishAndDuplicate: 'Save and duplicate',
  } } });
  config.locale = 'ps';
  CMS.init({ config: config });
})();

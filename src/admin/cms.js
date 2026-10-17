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
          get('published') ? null : h('p', { className: 'fn-draft' }, h('strong', {}, 'Draft, not published. '), 'This article stays off the live site until Show on site is requested, saved and validated.'),
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
  var serviceLabels = {};
  var projectFields = (config.collections || []).find(function (c) { return c.name === 'projects'; });
  var serviceField = projectFields && projectFields.fields.find(function (f) { return f.name === 'services'; });
  ((serviceField && serviceField.options) || []).forEach(function (s) { serviceLabels[s.value] = s.label; });
  var ProjectPreview = createClass({
    render: function () {
      var e = this.props.entry; var self = this;
      var get = function (k) { return e.getIn(['data', k]); };
      var photos = (get('photos') || []).toJS ? get('photos').toJS() : (get('photos') || []);
      var services = (get('services') || []).toJS ? get('services').toJS() : (get('services') || []);
      var warn = [];
      // Historic records that were never cleared keep their pending state (set before Oct 2 2026); say so plainly.
      if (get('rights') === 'pending') warn.push('This older project was never cleared to show. Ask us to clear it before requesting Show on site.');
      photos.forEach(function (p, i) { if (!p.alt) warn.push('Photo ' + (i + 1) + ' needs a description.'); });
      if (get('hero') && !get('heroAlt')) warn.push('The main image needs a description.');
      var fig = function (src, alt, focal, key) {
        var a = src ? (thumbs[src] || self.props.getAsset(src).toString()) : null;
        return a ? h('figure', { key: key, className: 'dash-fig' }, h(Thumb, { src: a, path: src, alt: alt || '' }), h('figcaption', {}, alt || 'No description yet')) : null;
      };
      return h('article', { className: 'project dash-project' },
        h('div', { className: 'wrap', style: { paddingTop: '32px' } },
          get('published') ? null : h('p', { className: 'fn-draft' }, h('strong', {}, 'Draft, not published. '), 'The preview site shows it with this note; the live site leaves it out until Show on site is requested, saved and validated.'),
          warn.length ? h('ul', { className: 'dash-warn' }, warn.map(function (w, i) { return h('li', { key: i }, w); })) : null,
          h('p', { className: 'eyebrow' }, (catLabels[get('category')] || '') + (get('location') ? ' · ' + get('location') : '')),
          h('h1', { className: 'display' }, get('title') || 'Untitled project'),
          get('story') ? h('p', { className: 'lede' }, get('story')) : null,
          get('client') ? h('p', {}, h('strong', {}, 'Client: '), get('client')) : null,
          services.length ? h('p', {}, h('strong', {}, 'Services: '), services.map(function (s) { return serviceLabels[s] || s; }).join(' · ')) : null,
          get('serviceDetails') ? h('p', {}, h('strong', {}, 'Special work: '), get('serviceDetails')) : null,
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
  function addFiles(props, files, baseName) {
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
    var base = String(baseName || (data && data.get && (data.get('title') || data.get('shortTitle'))) || (typed && typed.value) || 'photo').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
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
  // What is in the form right now, reported by the fields themselves. In the real Decap 3.16.3 editor a widget's
  // props.entry, as its isValid sees it on Save, still holds the form as it was when that widget's own value last
  // changed (Codex acceptance, Oct 14), so checks that depend on other fields read them here. Each field writes its
  // value when it draws (Decap redraws a field whenever its own value changes) and removes it when it goes away.
  var LIVE = {};
  var liveSet = function (field, value) { var k = field && field.get && field.get('name'); if (k) LIVE[k] = value; };
  var liveDrop = function (field) { var k = field && field.get && field.get('name'); if (k) delete LIVE[k]; };
  var GalleryControl = createClass({
    getInitialState: function () { return { busy: false, msgs: [], sizes: {} }; },
    componentWillUnmount: function () { liveDrop(this.props.field); },
    pick: function () { this.input && this.input.click(); },
    onFiles: function (e) {
      var self = this; var files = e.target.files; self.setState({ busy: true, msgs: [] });
      addFiles(this.props, files).then(function (r) {
        var arr = toArr(self.props.value).concat(r.paths.map(function (p) { return { image: p, alt: '', focal: 'center', orientation: 'auto', photoType: 'photography' }; }));
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
      var self = this; var arr = toArr(this.props.value); var id = this.props.forID; liveSet(this.props.field, arr);
      return h('div', { className: 'pgk-gallery', id: id },
        h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: this.pick, disabled: this.state.busy }, this.state.busy ? 'Adding photos…' : arr.length ? 'Upload more photos' : 'Upload photos'),
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ picking: true }); } }, 'Choose from site photos'),
          h('span', { className: 'pgk-gallery__count' }, arr.length ? arr.length + (arr.length === 1 ? ' photo' : ' photos') + '. The first one leads.' : 'Choose several at once: hold Shift or Command.'),
          h('input', { type: 'file', multiple: true, accept: ACCEPT, hidden: true, ref: function (el) { self.input = el; }, onChange: this.onFiles, 'aria-label': 'Choose photos' })),
        this.state.picking ? h(Picker, { multiple: true, onClose: function () { self.setState({ picking: false }); }, onPick: function (list) { self.props.onChange(toArr(self.props.value).concat(list.map(function (x) { return { image: x.src, alt: x.alt || '', focal: 'center', orientation: 'auto', photoType: (x.service || []).includes('drone') ? 'drone' : 'photography' }; }))); self.setState({ picking: false }); } }) : null,
        this.state.msgs.length ? h('ul', { className: 'pgk-msg', role: 'alert' }, this.state.msgs.map(function (m, i) { return h('li', { key: i }, m); })) : null,
        h('ol', { className: 'pgk-gallery__list' }, arr.map(function (ph, i) {
          var sz = self.state.sizes[ph.image];
          return h('li', { key: ph.image + i, className: 'pgk-row' },
            h(Thumb, { src: thumbFor(ph.image, self.props.getAsset, self.props.field), path: ph.image, alt: ph.alt, onSize: function (w, ht) { if (!sz) { var s = Object.assign({}, self.state.sizes); s[ph.image] = [w, ht]; self.setState({ sizes: s }); } } }),
            h('div', { className: 'pgk-row__fields' },
              h('label', {}, h('span', {}, 'Description (alt text)' + (ph.alt ? '' : ' · needed before publishing')), h('input', { type: 'text', value: ph.alt || '', placeholder: 'e.g. Kitchen with a marble island and brass pendant lights', onChange: function (e) { self.update(i, 'alt', e.target.value); } })),
              h('label', {}, h('span', {}, 'Photo type for gallery filters'), h('select', { value: ph.photoType || 'photography', onChange: function (e) { self.update(i, 'photoType', e.target.value); } },
                h('option', { value: 'photography' }, 'Photography'), h('option', { value: 'drone' }, 'Drone photography'))),
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
    componentWillUnmount: function () { liveDrop(this.props.field); },
    onFiles: function (e) {
      var self = this; self.setState({ busy: true, msgs: [] });
      addFiles(this.props, [e.target.files[0]].filter(Boolean)).then(function (r) { if (r.paths[0]) self.props.onChange(r.paths[0]); self.setState({ busy: false, msgs: r.msgs }); })
        .catch(function (err) { self.setState({ busy: false, msgs: ['Upload failed: ' + err] }); });
      e.target.value = '';
    },
    render: function () {
      var self = this; var v = this.props.value || ''; liveSet(this.props.field, v);
      return h('div', { className: 'pgk-photo', id: this.props.forID },
        h(Thumb, { src: thumbFor(v, this.props.getAsset, this.props.field), path: v }),
        h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.input.click(); }, disabled: this.state.busy }, this.state.busy ? 'Adding…' : v ? 'Replace photo' : 'Choose photo'),
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ picking: true }); } }, 'Choose from site photos'),
          v ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.props.onChange(''); } }, 'Remove') : null,
          h('input', { type: 'file', accept: ACCEPT, hidden: true, ref: function (el) { self.input = el; }, onChange: this.onFiles, 'aria-label': 'Choose a photo' })),
        this.state.picking ? h(Picker, { multiple: false, onClose: function () { self.setState({ picking: false }); }, onPick: function (list) { if (list[0]) self.props.onChange(list[0].src); self.setState({ picking: false }); } }) : null,
        this.state.msgs.length ? h('ul', { className: 'pgk-msg', role: 'alert' }, this.state.msgs.map(function (m, i) { return h('li', { key: i }, m); })) : null);
    },
  });
  CMS.registerWidget('pgk-photo', PhotoControl);

  // ---------- Never save one entry into another's file (found in the Oct 3 2026 walk) ----------
  // Going straight from one open entry to another (browser back/forward, a typed or bookmarked address) without
  // passing through a list left Decap 3.16 holding the first entry: Save then wrote the second form into the first
  // entry's file (reproduced: a Photos record overwritten by a project). Any direct entry-to-entry jump now reloads the
  // dashboard so the new entry opens clean. Decap keeps a local backup of unsaved changes and offers to restore them.
  var entryKey = function (h) { var m = String(h || '').match(/^#\/collections\/([^/?]+)\/(entries\/[^/?]+|new)/); return m ? m[1] + '/' + m[2] : null; };
  var openEntry = entryKey(location.hash);
  window.addEventListener('hashchange', function () {
    var k = entryKey(location.hash);
    // Only between two saved entries; a new entry becoming saved (new → entries/<name>) is Decap's own step.
    if (k && openEntry && k !== openEntry && /\/entries\//.test(k) && /\/entries\//.test(openEntry)) { location.reload(); return; }
    openEntry = k;
  });

  // ---------- Thumbnails on the collection lists (James, Oct 2 2026; layout fixed Oct 13 2026) ----------
  // Decap's list cards are text only. Each card links to its entry, so we add the photo the site itself serves for
  // that entry (built into config.js as PHOTOGRAFIK_THUMBS). The picture goes in front of Decap's card body, never
  // inside it: the body draws a white fade (CardBody::after) over its lower part, which showed as a white band across
  // our pictures (Codex, Oct 13 2026, live). Grid and list cards each get their own layout; other cards are untouched.
  var siteThumbs = window.PHOTOGRAFIK_THUMBS || { photos: {}, films: {}, projects: {}, pick: [], meta: {}, filmFrames: {} };
  siteThumbs.meta = siteThumbs.meta || {}; siteThumbs.filmFrames = siteThumbs.filmFrames || {};
  function cardThumb(col, slug) { var m = siteThumbs[col] || {}; return m[slug] || null; }
  function retryCachedThumb(img) {
    if (img.dataset.pgkRetried) return false;
    img.dataset.pgkRetried = '1';
    img.src += (img.src.indexOf('?') >= 0 ? '&' : '?') + 'pgk-preview=' + Date.now();
    return true;
  }
  var cardBodyOf = function (a) { return a.querySelector('[class*="CardBody"]'); };
  function decorateCards() {
    var links = document.querySelectorAll('a[href*="/collections/"][href*="/entries/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var mm = a.getAttribute('href').match(/collections\/([^/]+)\/entries\/([^/?#]+)/);
      if (!mm || !siteThumbs[mm[1]]) continue;
      var slug = decodeURIComponent(mm[2]);
      var have = a.querySelector(':scope > .pgk-card-thumb');
      if (have && have.getAttribute('data-for') === mm[2]) continue;
      if (have) have.remove();
      var body = cardBodyOf(a); var grid = !!body;
      var want = cardThumb(mm[1], slug); var frame = mm[1] === 'films' ? siteThumbs.filmFrames[slug] : null;
      var el;
      if (want) { el = document.createElement('img'); el.src = want; el.alt = ''; el.loading = 'lazy'; el.onerror = function () {
        // A poster requested while its import was finishing may have a cached 404. Retry once at a fresh URL.
        if (retryCachedThumb(this)) return;
        this.classList.add('pgk-card-thumb--broken'); this.removeAttribute('src');
      }; }
      else if (frame) { el = document.createElement('video'); el.src = frame; el.muted = true; el.preload = 'metadata'; el.setAttribute('playsinline', ''); el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; }
      else { el = document.createElement('div'); el.textContent = mm[1] === 'films' ? 'No still image for this film yet' : 'New: preview after the next site update'; el.className = 'pgk-card-thumb--none'; }
      el.classList.add('pgk-card-thumb', grid ? 'pgk-card-thumb--grid' : 'pgk-card-thumb--list');
      el.setAttribute('data-for', mm[2]);
      a.classList.add('pgk-card', grid ? 'pgk-card--grid' : 'pgk-card--list');
      a.insertBefore(el, a.firstChild);
      // Service label and what the site does with it, in plain words (not the stored code such as architecture-design).
      var meta = (siteThumbs.meta[mm[1]] || {})[slug];
      var line = a.querySelector('.pgk-card-meta');
      if (meta && !line) { line = document.createElement('span'); line.className = 'pgk-card-meta'; line.textContent = [meta.cat, meta.status].filter(Boolean).join(' · '); (body || a).appendChild(line); }
    }
    if (!window.__pgkBadgeRun) { window.__pgkBadgeRun = true; setTimeout(function () { window.__pgkBadgeRun = false; badgeCards(); }, 80); }
    // Decap's separate Media dialog uploads one file at a time. Point batch work to the Project photo picker,
    // which saves several photos with their descriptions and gallery types in a single project update.
    var dialog = mediaDialog();
    if (dialog && !dialog.querySelector('#pgk-media-video')) {
      // Videos are never uploaded here (James, Oct 14: a finished video chosen from his computer failed with “failed to
      // persist media: allocation size overflow”). They come from Google Drive through Films → New Film.
      var vid = document.createElement('div'); vid.id = 'pgk-media-video'; vid.className = 'pgk-media-video';
      var vb = document.createElement('button'); vb.type = 'button'; vb.className = 'pgk-btn'; vb.textContent = 'Add a video from Google Drive';
      vb.onclick = function () { window.pgkVideoHelp(); };
      vid.appendChild(vb); vid.appendChild(document.createTextNode(' This window is for photos and small files. Videos go to Google Drive first, then Films → New Film.'));
      dialog.insertBefore(vid, dialog.children[1] || null);
    }
    if (dialog) Array.prototype.forEach.call(dialog.querySelectorAll('input[type="file"]'), function (i) { if (i.getAttribute('accept') !== MEDIA_ACCEPT) i.setAttribute('accept', MEDIA_ACCEPT); });
    if (dialog) Array.prototype.forEach.call(dialog.querySelectorAll('label span, button'), function (b) { if (/^\s*upload\s*$/i.test(b.textContent) && !b.children.length) b.textContent = 'Upload a photo or file'; });
    if (dialog && !dialog.querySelector('#pgk-media-help')) {
      var note = document.createElement('p'); note.id = 'pgk-media-help'; note.className = 'pgk-media-help';
      note.appendChild(document.createTextNode('Adding several images to a project? '));
      var link = document.createElement('a'); link.href = '#/collections/projects'; link.textContent = 'Open Projects and use Photos → Upload photos';
      link.onclick = function () { var close = dialog.querySelector('button[aria-label="Close"]'); if (close) close.click(); };
      note.appendChild(link);
      note.appendChild(document.createTextNode(' Deleting is not done in this window, so nothing still on the site can lose its picture. To delete a file nothing uses any more: '));
      var up = document.createElement('button'); up.type = 'button'; up.className = 'pgk-linkbtn'; up.textContent = 'Uploaded files'; up.onclick = function () { window.pgkOpenUploads(); };
      note.appendChild(up); note.appendChild(document.createTextNode('. Photos, films, projects and articles are deleted from their own page (“Where it is used, and delete”).'));
      dialog.insertBefore(note, dialog.children[1] || null);
    }
    if (dialog) Array.prototype.forEach.call(dialog.querySelectorAll('button'), function (b) { if (/^\s*delete( selected)?\s*$/i.test(b.textContent)) b.style.display = 'none'; });
  }
  // ---------- Videos never enter the dashboard's own upload ----------
  // Decap reads an uploaded file whole into the browser to send it to GitHub; a finished video is far too large for that
  // (and for the repository). Every file chooser and drop on the dashboard is checked first, before Decap sees it:
  // a video is stopped there and the Google Drive route is shown instead. Photos, captions (.vtt) and PDFs pass.
  var MEDIA_ACCEPT = 'image/*,.pdf,.vtt,text/vtt';
  var VIDEO_EXT = /\.(mp4|m4v|mov|qt|webm|avi|mkv|wmv|flv|mpe?g|mpg4|3gp|3g2|mts|m2ts|ogv|hevc|mxf|r3d|braw|prores)$/i;
  var DRIVE_CLIPS = 'https://drive.google.com/drive/folders/1GvCxSc15_ewOlikI7bD8UnRJumJK-gkN';
  function isVideoFile(f) { return !!f && ((!!f.type && /^video\//i.test(f.type)) || VIDEO_EXT.test(f.name || '')); }
  function videosIn(list) { return Array.prototype.filter.call(list || [], isVideoFile); }
  function stopVideos(e, files, after) {
    var v = videosIn(files); if (!v.length) return false;
    var name = v[0].name; var others = (files.length || 0) - v.length; // read before the choice is cleared
    e.preventDefault(); e.stopImmediatePropagation(); if (after) after();
    window.pgkVideoHelp(name, others);
    return true;
  }
  window.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.tagName !== 'INPUT' || t.type !== 'file') return;
    stopVideos(e, t.files, function () { try { t.value = ''; } catch (x) { /* some browsers refuse; the change never reached Decap */ } });
  }, true);
  window.addEventListener('drop', function (e) { stopVideos(e, e.dataTransfer && e.dataTransfer.files); }, true);
  window.pgkVideoHelp = function (name, others) {
    var old = document.getElementById('pgk-video-help'); if (old) old.remove();
    var opener = document.activeElement;
    var wrap = document.createElement('div'); wrap.className = 'pgk-modal'; wrap.id = 'pgk-video-help'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'pgk-video-h');
    var box = document.createElement('div'); box.className = 'pgk-modal__box pgk-modal__box--narrow'; wrap.appendChild(box);
    var body = document.createElement('div'); body.className = 'pgk-modal__body'; box.appendChild(body);
    var add = function (tag, text, attrs) { var n = document.createElement(tag); if (text) n.textContent = text; Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; };
    body.appendChild(add('h2', 'Add videos from Google Drive', { id: 'pgk-video-h' }));
    if (name) body.appendChild(add('p', '“' + name + '” is a video, so it was not uploaded here' + (others ? ' (nothing from this selection was; choose the photos again without the video)' : '') + '. Videos are too large for this upload. The site makes its own web copies from the original in your Google Drive, so the original stays there.', { class: 'pgk-msg', role: 'status' }));
    else body.appendChild(add('p', 'Videos are too large for this upload. The site makes its own web copies from the original in your Google Drive, so the original stays there.'));
    var ol = add('ol', null, { class: 'pgk-steps' });
    ['Put the finished video in your Podcast Clips folder in Google Drive (drag it from your computer into the folder, or New → File upload).',
      'In Drive, right-click the video → Share → set “Anyone with the link” can view → Copy link.',
      'Here, open Films → New Film, paste the link, add the title and service, then Save. The film appears in a few minutes, as a hidden draft. Wait for Ready, then choose Show on site and Save.'].forEach(function (t) { ol.appendChild(add('li', t)); });
    body.appendChild(ol);
    var bar = add('div', null, { class: 'pgk-gallery__bar' });
    var folder = add('a', 'Open the Podcast Clips folder', { href: DRIVE_CLIPS, target: '_blank', rel: 'noopener', class: 'pgk-btn' });
    var film = add('a', 'Go to Films → New Film', { href: '#/collections/films/new', class: 'pgk-btn' });
    var close = add('button', 'Close', { type: 'button', class: 'pgk-btn pgk-btn--quiet' });
    bar.appendChild(folder); bar.appendChild(film); bar.appendChild(close); body.appendChild(bar);
    function shut() { document.removeEventListener('keydown', onKey, true); wrap.remove(); if (opener && opener.focus && document.contains(opener)) opener.focus(); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); shut(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(wrap.querySelectorAll(FOCUSABLE), function (x) { return x.getClientRects().length; }); if (!f.length) return;
      var first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!wrap.contains(at)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    }
    close.onclick = shut;
    film.onclick = function () { shut(); var md = mediaDialog(); var x = md && md.querySelector('button[aria-label="Close"]'); if (x) x.click(); };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap); setTimeout(function () { folder.focus(); }, 0);
  };
  function mediaDialog() { return Array.prototype.find.call(document.querySelectorAll('[role="dialog"]'), function (d) { return d.querySelector('h1') && /^(Media assets|Images)$/.test(d.querySelector('h1').textContent.trim()); }); }
  // Raw file deletion in Decap's Media dialog is switched off: it cannot tell whether a page still uses the file.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button');
    var d = b && mediaDialog();
    if (d && d.contains(b) && /^\s*delete( selected)?\s*$/i.test(b.textContent)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  function badgeCards() {
    var links = document.querySelectorAll('a[href*="/collections/projects/entries/"]');
    Array.prototype.forEach.call(links, function (a) {
      var mm = a.getAttribute('href').match(/entries\/([^/?#]+)/); if (!mm) return;
      statusId(decodeURIComponent(mm[1])).then(function (id) {
        var kind = heldFor(id) ? 'held' : testFor(id) ? 'test' : '';
        var b = a.querySelector('.pgk-card-badge');
        if ((b ? b.getAttribute('data-kind') : '') === kind) return;
        if (b) b.remove();
        if (!kind) return;
        b = document.createElement('span'); b.className = 'pgk-card-badge pgk-card-badge--' + kind; b.setAttribute('data-kind', kind);
        b.textContent = kind === 'held' ? 'Held: not on the site' : 'Review-only test';
        (cardBodyOf(a) || a).appendChild(b);
      });
    });
  }
  var cardTimer = null;
  new MutationObserver(function () { clearTimeout(cardTimer); cardTimer = setTimeout(decorateCards, 60); }).observe(document.documentElement, { childList: true, subtree: true });
  window.__pgkDecorate = decorateCards; // for the dashboard tests

  // ---------- Dialogs: keyboard focus stays inside, Escape closes, focus returns to the button that opened it ----------
  // Emptying a field writes “no value” (undefined), never null (Codex acceptance of 94d5fb1). Decap marks the entry as
  // changed only while its data differs from every copy of the entry it holds, and the copy it holds from before an
  // earlier save can be the empty one (null): clearing back to null then looked unchanged, Save stayed off and the
  // photo came back on reload. JSON files never contain undefined, so an emptied field always differs from any saved
  // copy; on Save the key is simply left out of the file, which the site and its checks read as empty.
  var CLEARED = void 0;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var Modal = createClass({
    componentDidMount: function () {
      var self = this; var o = document.activeElement;
      this.opener = o && o !== document.body ? { el: o, text: (o.textContent || '').trim(), scope: o.closest && o.closest('[id]') ? o.closest('[id]').id : null } : null;
      this.onKey = function (e) {
        if (!self.el) return;
        if (e.key === 'Escape' && self.props.onClose) { e.preventDefault(); e.stopPropagation(); self.props.onClose(); return; }
        if (e.key !== 'Tab') return;
        var f = Array.prototype.filter.call(self.el.querySelectorAll(FOCUSABLE), function (x) { return !x.hidden && x.getClientRects().length; });
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0]; var last = f[f.length - 1]; var at = document.activeElement;
        if (!self.el.contains(at)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', this.onKey, true);
      setTimeout(function () { if (self.el && !self.el.contains(document.activeElement)) { var a = self.el.querySelector('[autofocus]') || self.el.querySelector(FOCUSABLE); if (a) a.focus(); } }, 0);
    },
    componentWillUnmount: function () {
      document.removeEventListener('keydown', this.onKey, true);
      var o = this.opener; if (!o) return;
      setTimeout(function () {
        var el = o.el && document.contains(o.el) ? o.el : null;
        // If the page redrew the opener, find the same button again in the same place.
        if (!el && o.scope && document.getElementById(o.scope)) el = Array.prototype.find.call(document.getElementById(o.scope).querySelectorAll('button'), function (b) { return (b.textContent || '').trim() === o.text; });
        if (el && el.focus) el.focus();
      }, 0);
    },
    render: function () {
      var self = this;
      return h('div', { className: 'pgk-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': this.props.label, 'aria-labelledby': this.props.labelledBy, ref: function (el) { self.el = el; } },
        h('div', { className: 'pgk-modal__box' + (this.props.narrow ? ' pgk-modal__box--narrow' : '') }, this.props.children));
    },
  });

  // ---------- Picker: choose photos that are already on the site ----------
  // For adding existing site photos to a project or article without uploading them again. Multi-select in galleries.
  var Picker = createClass({
    getInitialState: function () { return { q: '', chosen: {} }; },
    componentDidMount: function () { if (this.search) this.search.focus(); },
    toggle: function (src) { var c = Object.assign({}, this.state.chosen); if (c[src]) delete c[src]; else { if (!this.props.multiple) c = {}; c[src] = true; } this.setState({ chosen: c }); },
    render: function () {
      var self = this; var q = this.state.q.toLowerCase();
      var items = siteThumbs.pick.filter(function (x) { return !q || (x.label + ' ' + x.alt + ' ' + x.cat).toLowerCase().indexOf(q) >= 0; });
      var n = Object.keys(this.state.chosen).length;
      return h(Modal, { label: 'Choose photos already on the site', onClose: this.props.onClose },
        h('div', { className: 'pgk-modal__inner' },
          h('div', { className: 'pgk-modal__head' },
            h('input', { type: 'search', placeholder: 'Search the site’s photos', value: this.state.q, ref: function (el) { self.search = el; }, onChange: function (e) { self.setState({ q: e.target.value }); }, 'aria-label': 'Search photos' }),
            h('button', { type: 'button', className: 'pgk-btn', disabled: !n, onClick: function () { self.props.onPick(siteThumbs.pick.filter(function (x) { return self.state.chosen[x.src]; })); } }, n ? 'Add ' + n + (n === 1 ? ' photo' : ' photos') : 'Choose photos'),
            h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: this.props.onClose }, 'Cancel')),
          h('ul', { className: 'pgk-modal__grid' }, items.map(function (x) {
            var on = !!self.state.chosen[x.src];
            return h('li', { key: x.src },
              h('button', { type: 'button', className: 'pgk-pick' + (on ? ' is-on' : ''), 'aria-pressed': on, onClick: function () { self.toggle(x.src); }, title: x.label },
                h('img', { src: x.thumb, alt: x.alt || x.label, loading: 'lazy' }), h('span', {}, x.label)));
          }))));
    },
  });

  // ---------- Published switch that says what the site actually did (Oct 3 2026) ----------
  // The build writes /admin/status.json: which dashboard projects it held back as drafts (and why) and which are
  // review-only tests. The switch shows that next to itself, a bar at the bottom of every dashboard page lists held
  // items, and Save is refused while Published is on and something the site needs is missing, so a failed publish can
  // never look like a successful one.
  var siteStatus = { data: null, at: 0, subs: [] };
  var CAMERA = /(?:^|[^a-z0-9])(?:ps|dji|img|dsc[fn]?|_?mg|mvi|gopr|pxl|gh0?\d)[_-]?\d{4,}/i;
  var cameraName = function (path) { return !!path && CAMERA.test('/' + String(path).split('/').pop().replace(/\.[a-z0-9]+$/i, '')); };
  var shortSha = function (s) { return s ? String(s).slice(0, 7) : 'local'; };
  var when = function (iso) { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } };
  function loadStatus() {
    return fetch('/admin/status.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { siteStatus.data = d; siteStatus.at = Date.now(); siteStatus.subs.forEach(function (f) { f(); }); renderBar(); } })
      .catch(function () { /* the status line simply stays unknown */ });
  }
  var bar = document.createElement('div'); bar.className = 'pgk-statusbar'; bar.setAttribute('role', 'status'); bar.hidden = true;
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bar); });
  if (document.body) document.body.appendChild(bar);
  // The status file names nothing (it is public): entries are matched by the same opaque id the build writes.
  var idCache = {};
  function statusId(slug) {
    if (!slug) return Promise.resolve(null);
    if (idCache[slug]) return Promise.resolve(idCache[slug]);
    if (!(window.crypto && crypto.subtle)) return Promise.resolve(null);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('pgk:' + slug)).then(function (d) {
      var hex = Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16);
      idCache[slug] = hex; return hex;
    });
  }
  var heldFor = function (id) { var d = siteStatus.data; return d && id ? (d.held || []).filter(function (x) { return x.id === id; })[0] || null : null; };
  var testFor = function (id) { var d = siteStatus.data; return !!(d && id && (d.reviewOnly || []).some(function (x) { return x.id === id; })); };
  // Bottom note (Codex live review, Oct 13 2026): a held project stays a clear alert; the harmless review-only-test
  // note is one short line that can be opened or hidden; build details sit behind “Details”. It sits to the right of
  // the save/deploy pill instead of over it.
  var testNoteHidden = function (t) { try { return sessionStorage.getItem('pgk-hide-test-note') === String(t); } catch (e) { return false; } };
  bar.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.pgk-statusbar__x')) return;
    try { sessionStorage.setItem('pgk-hide-test-note', String(((siteStatus.data || {}).reviewOnly || []).length)); } catch (err) { /* hidden for this view only */ }
    bar.setAttribute('data-test-hidden', '1'); renderBar();
  });
  function renderBar() {
    var d = siteStatus.data; if (!d) return;
    var parts = [];
    var n = (d.held || []).length; var t = (d.reviewOnly || []).length;
    if (n) parts.push('<p class="pgk-statusbar__held"><strong>' + n + (n === 1 ? ' project is' : ' projects are') + ' not on the site.</strong> Show on site was requested, but the last build held ' + (n === 1 ? 'it' : 'them') + ' back as a draft. In Projects ' + (n === 1 ? 'it is' : 'they are') + ' marked “Held”; the form says what to fix.</p>');
    var showTest = t && !testNoteHidden(t) && bar.getAttribute('data-test-hidden') !== '1';
    if (showTest) parts.push('<div class="pgk-statusbar__test"><details><summary>' + t + (t === 1 ? ' review-only test project' : ' review-only test projects') + '</summary><p>Marked “Review-only test” in Projects: shown on the review site with a note, never built for the live site.</p></details><button type="button" class="pgk-statusbar__x" aria-label="Hide this note">×</button></div>');
    bar.innerHTML = parts.join('') + (parts.length ? '<details class="pgk-statusbar__meta"><summary>Details</summary><p>From the ' + esc(d.mode === 'production' ? 'live' : 'review') + ' build ' + esc(shortSha(d.commit)) + ', ' + esc(when(d.builtAt)) + '. A save usually takes a few minutes to appear.</p></details>' : '');
    bar.hidden = !parts.length;
    bar.className = 'pgk-statusbar' + (n ? ' pgk-statusbar--held' : ' pgk-statusbar--quiet');
    decorateCards();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  loadStatus(); setInterval(loadStatus, 60000);
  window.__pgkReloadStatus = loadStatus; // lets the dashboard tests ask again without waiting a minute

  // What a project needs before Published can be saved as on (the same rules the build applies to dashboard projects).
  function publishProblems(data) {
    var g = function (k) { var v = data && data.get ? data.get(k) : null; return v && v.toJS ? v.toJS() : v; };
    var out = [];
    // The original projects (fixed path) keep their photos in the Photos section and some deliberately wait for client
    // wording, exactly as the build allows; only projects made in the dashboard need every text and a picture here.
    var original = !!g('path');
    if (!g('title')) out.push('add a project name');
    if (!g('category')) out.push('choose the service');
    if (!original && !g('summary')) out.push('add a short description');
    if (!original && !g('story')) out.push('add the story / goal paragraph');
    var photos = (g('photos') || []).filter(function (x) { return x && x.image; });
    var hero = g('hero');
    if (!original && !hero && !photos.length) out.push('add a main image or at least one photo');
    if (hero && !g('heroAlt')) out.push('describe the main image (alt text)');
    if (cameraName(hero)) out.push('choose the main image again so it is renamed');
    photos.forEach(function (x, i) {
      if (!x.alt) out.push('describe photo ' + (i + 1));
      if (cameraName(x.image)) out.push('add photo ' + (i + 1) + ' again so it is renamed');
    });
    return out;
  }
  var PublishControl = createClass({
    getInitialState: function () { return { slug: null, sid: null }; },
    componentDidMount: function () { var self = this; this.sub = function () { self.forceUpdate(); }; siteStatus.subs.push(this.sub); },
    componentWillUnmount: function () { var self = this; siteStatus.subs = siteStatus.subs.filter(function (f) { return f !== self.sub; }); },
    isValid: function () {
      if (this.props.value !== true || !this.props.entry || (this.props.collection && this.props.collection.get('name')) !== 'projects') return true;
      // Current form values where the field reports them (a description corrected after switching Published on counts
      // without switching it again); the entry as Decap passed it otherwise.
      var saved = this.props.entry.get('data');
      var probs = publishProblems({ get: function (k) { return Object.prototype.hasOwnProperty.call(LIVE, k) ? LIVE[k] : saved && saved.get(k); } });
      return probs.length ? { error: { type: 'custom', message: 'Show on site is requested, but the site would hold this project back. Before saving: ' + probs.join('; ') + '. Or switch Show on site off to keep a hidden draft.' } } : true;
    },
    render: function () {
      var self = this; var on = this.props.value === true; var d = siteStatus.data;
      var slug = this.props.entry && this.props.entry.get('slug');
      if (slug && this.state.slug !== slug) statusId(slug).then(function (id) { self.setState({ slug: slug, sid: id }); });
      var sid = this.state.slug === slug ? this.state.sid : null;
      var held = heldFor(sid);
      var test = testFor(sid);
      var line = null;
      if (held) line = h('p', { className: 'pgk-pub__state pgk-pub__state--held', role: 'alert' }, h('strong', {}, 'Not on the site yet. '), 'The last build (' + shortSha(d.commit) + ', ' + when(d.builtAt) + ') held this project back as a draft because: ' + held.reasons.join('; ') + '. Fix this and Save; the switch alone does not make it public.');
      else if (test) line = h('p', { className: 'pgk-pub__state pgk-pub__state--test' }, h('strong', {}, 'Review-only test project. '), 'Shown on the review site with a note; never built for the live site.');
      else if (on && slug && d) line = h('p', { className: 'pgk-pub__state' }, 'Show on site is requested. Save and validation must finish first. ' + siteState.text());
      else if (on && !slug) line = h('p', { className: 'pgk-pub__state' }, 'Save this request first. Validation and a successful website update are required; this switch alone does not publish it.');
      return h('div', { className: 'pgk-pub', id: this.props.forID },
        h('label', { className: 'pgk-switch' },
          h('input', { type: 'checkbox', role: 'switch', checked: on, 'aria-checked': on, onChange: function (e) { self.props.onChange(e.target.checked); } }),
          h('span', {}, on ? 'Show on site requested' : 'Hidden draft')),
        line);
    },
  });
  CMS.registerWidget('pgk-publish', PublishControl);

  // Form section headings are display-only widgets. Fields remain at their original paths: no content migration.
  CMS.registerWidget('pgk-section', createClass({ render: function () {
    var f = this.props.field; var colName = this.props.collection && this.props.collection.get('name');
    var col = config.collections.find(function (c) { return c.name === colName; });
    var sections = col && col.fields ? col.fields.filter(function (x) { return x.widget === 'pgk-section'; }) : [];
    var first = sections.length && sections[0].name === f.get('name');
    return h('section', { className: 'pgk-section', id: this.props.forID },
      h('h2', { tabIndex: -1 }, f.get('label')),
      first ? h('nav', { className: 'pgk-gallery__bar', 'aria-label': 'Jump to editor section' }, sections.map(function (x) { return h('button', { key: x.name, type: 'button', className: 'pgk-btn pgk-btn--quiet pgk-btn--small', onClick: function () { var el = document.querySelector('[id^="' + x.name + '-field-"] h2'); if (el) { el.scrollIntoView({ block: 'start' }); el.focus(); } } }, x.label); })) : null,
      h('p', {}, f.get('text') || ''),
      this.props.field.get('name') === '_section_film' ? h('a', { href: '/admin/login.html', target: '_blank', rel: 'noopener' }, 'Sign-in help') : null);
  } }));

  // Friendly controls retain the exact saved integer until the editor chooses an action.
  var PlacementControl = createClass({
    getInitialState: function () { return { original: this.props.value, edited: false }; },
    set: function (v) { this.setState({ edited: true }); this.props.onChange(v); },
    isValid: function () { return this.props.value == null || Number.isInteger(this.props.value) ? true : { error: { type: 'custom', message: 'Placement must be a whole number.' } }; },
    render: function () {
      var self = this; var v = Number(this.props.value) || 0; var asc = this.props.field.get('direction') === 'ascending';
      var step = asc ? -10 : 10;
      return h('div', { className: 'pgk-note', id: this.props.forID },
        h('p', {}, asc ? 'Project list order: earlier numbers come first; gallery priority still takes precedence.' : v === 0 ? 'Normal placement' : 'Raised or lowered in automatic Home and service galleries. Custom Page Media selections keep their own order.'),
        h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.set(v + step); } }, asc ? 'Earlier in project lists' : 'Move higher in galleries'),
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.set(v - step); } }, asc ? 'Later in project lists' : 'Move lower in galleries'),
          !asc ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.set(0); } }, 'Normal placement') : null,
          this.state.edited ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.props.onChange(self.state.original); self.setState({ edited: false }); } }, 'Undo placement change') : null),
        h('details', {}, h('summary', {}, 'Advanced: exact order value'), h('input', { type: 'number', step: 1, 'aria-label': 'Exact order value', value: this.props.value == null ? '' : this.props.value, onChange: function (e) { self.set(e.target.value === '' ? CLEARED : Number(e.target.value)); } })));
    },
  });
  CMS.registerWidget('pgk-placement', PlacementControl);

  CMS.registerWidget('pgk-featured', createClass({ render: function () {
    var self = this; var article = this.props.collection && this.props.collection.get('name') === 'field-notes';
    return h('div', { className: 'pgk-note', id: this.props.forID },
      h('label', { className: 'pgk-switch' }, h('input', { type: 'checkbox', role: 'switch', checked: this.props.value === true, onChange: function (e) { self.props.onChange(e.target.checked); } }), ' Keep featured designation'),
      h('p', {}, article ? 'This editorial flag is saved for reference. Field Notes currently sorts by publish date; it does not move this article.' : 'This existing flag is saved for reference. It does not choose or reorder homepage tiles.'),
      !article ? h('a', { href: '#/collections/page-media/entries/home' }, 'Manage Home → Selected work: thumbnails, selection and order') : null);
  } }));

  CMS.registerWidget('pgk-review-display', createClass({
    getInitialState: function () { return { previous: Number.isInteger(this.props.value) ? this.props.value : 1 }; },
    render: function () {
      var self = this; var on = Number.isInteger(this.props.value);
      var set = function (v) { self.setState({ previous: v }); self.props.onChange(v); };
      return h('div', { className: 'pgk-note', id: this.props.forID },
        h('label', { className: 'pgk-switch' }, h('input', { type: 'checkbox', role: 'switch', checked: on, onChange: function (e) { if (e.target.checked) set(self.state.previous); else { self.setState({ previous: self.props.value }); self.props.onChange(CLEARED); } } }), on ? ' Show on About (after approval and website update)' : ' In reserve — hidden on About'),
        on ? h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { set(self.props.value - 1); } }, 'Move earlier'),
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { set(self.props.value + 1); } }, 'Move later'), h('span', {}, 'Order ' + this.props.value + ' (earlier first; ties keep list order)')) : null);
    },
  }));

  // A previously shown project's category participates in its URL. A move must be reviewed with redirects.
  var CategoryControl = createClass({
    getInitialState: function () { var e = this.props.entry; return { savedCategory: e && !e.get('newRecord') && e.getIn(['data', 'published']) === true ? this.props.value : null }; },
    locked: function () { var slug = this.props.entry && this.props.entry.get('slug'); return this.state.savedCategory ? { cat: this.state.savedCategory } : (window.PHOTOGRAFIK_PROJECTS || []).find(function (p) { return p.slug === slug && !p.hidden; }); },
    isValid: function () { var p = this.locked(); return p && this.props.value !== p.cat ? { error: { type: 'custom', message: 'This project has a published address. Keep its saved service category; a move needs a reviewed redirect.' } } : true; },
    componentWillUnmount: function () { liveDrop(this.props.field); },
    render: function () {
      var self = this; liveSet(this.props.field, this.props.value); var p = this.locked();
      var opts = this.props.field.get('options'); opts = opts && opts.toJS ? opts.toJS() : opts || [];
      return h('div', { id: this.props.forID },
        h('select', { value: this.props.value || '', disabled: !!p, 'aria-label': 'Service page', onChange: function (e) { self.props.onChange(e.target.value); } }, h('option', { value: '' }, 'Choose a service'), opts.map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })),
        p ? h('p', { className: 'pgk-slot__note' }, 'Locked to protect the published web address. Ask for a reviewed move with a redirect if this project belongs on a different service page.') : null);
    },
  });
  CMS.registerWidget('pgk-category', CategoryControl);

  var VisibilityControl = createClass({
    componentDidMount: function () { var self = this; this.sub = function () { self.forceUpdate(); }; siteState.subs.push(this.sub); },
    componentWillUnmount: function () { var self = this; siteState.subs = siteState.subs.filter(function (f) { return f !== self.sub; }); },
    isValid: function () {
      var e = this.props.entry; var film = this.props.collection && this.props.collection.get('name') === 'films';
      var imp = e && e.getIn(['data', 'import']); imp = imp && imp.toJS ? imp.toJS() : imp;
      if (film && this.props.value === true && ((e && e.get('newRecord')) || (imp && imp.state !== 'ready'))) return { error: { type: 'custom', message: 'Save this film as a hidden draft first. Wait for Ready, reload when asked, then choose Show on site and Save.' } };
      return true;
    },
    render: function () {
      var self = this; var on = this.props.value === true;
      return h('div', { id: this.props.forID, className: 'pgk-note' },
        h('label', { className: 'pgk-switch' }, h('input', { type: 'checkbox', role: 'switch', checked: on, onChange: function (e) { self.props.onChange(e.target.checked); } }), on ? ' Show on site requested' : ' Hidden draft'),
        h('p', {}, on ? 'Save, validation and a successful website update are still required. This switch does not confirm publication.' : 'Kept in the library. Production galleries leave hidden items out.'),
        h('p', { className: 'pgk-slot__note', role: 'status' }, siteState.text()));
    },
  });
  CMS.registerWidget('pgk-visibility', VisibilityControl);

  function SlotContext(p) {
    var f = p.field; var name = f.get('pageLabel'); if (!name) return null;
    return h('div', { className: 'pgk-context' }, h('strong', {}, name + ' → ' + f.get('sectionLabel')),
      h('p', {}, (f.get('mustHave') ? 'Required — replace instead of removing.' : 'Optional — see the empty/automatic behavior below.') + ' ' + f.get('device')),
      h('a', { href: window.location.origin + f.get('route'), target: '_blank', rel: 'noopener' }, 'Preview this page ↗'));
  }
  var UsagePeek = createClass({
    getInitialState: function () { return { result: null, busy: false }; },
    render: function () {
      var self = this; var m = this.props.media; if (!m || m.kind === 'loop') return null;
      var r = this.state.result;
      return h('div', { className: 'pgk-usage' }, h('button', { type: 'button', className: 'pgk-linkbtn', disabled: this.state.busy, onClick: function () {
        self.setState({ busy: true }); manage({ action: 'check', collection: m.kind === 'film' ? 'films' : 'photos', key: m.id }).then(function (j) { self.setState({ busy: false, result: j }); });
      } }, this.state.busy ? 'Checking usage…' : 'Where is this used?'),
      r ? h('div', { role: 'status' }, r.ok ? [h('p', { key: 'p' }, 'Latest saved usage (save your page edits before rechecking):'), h('ul', { key: 'u' }, (r.blocking || []).map(function (u, i) { return h('li', { key: i }, u.text); })), h('p', { key: 'a' }, (r.auto || []).join(' · ') || (!(r.blocking || []).length ? 'No saved placements.' : ''))] : r.message || 'Usage could not be checked.') : null);
    },
  });

  // ===================== Page Media, where-used and delete, films from Google Drive (Oct 13 2026) =====================
  var MEDIA = window.PHOTOGRAFIK_MEDIA || [];
  var mediaById = {}; MEDIA.forEach(function (m) { mediaById[m.id] = m; });
  var KIND_WORD = { photo: 'Photo', film: 'Film', loop: 'Playing excerpt' };
  var fits = function (accepts, m) {
    switch (accepts) {
      case 'heroLoop': return m.loop && m.hero;
      case 'loop': return m.loop;
      case 'film': return m.kind === 'film';
      case 'photo': return m.kind === 'photo';
      case 'still': return m.kind === 'photo' || (m.kind === 'film' && m.still);
      case 'loopOrPhoto': return m.kind === 'photo' || m.loop;
      case 'photoOrFilm': return m.kind === 'photo' || m.kind === 'film';
      case 'gallery': return m.kind === 'photo' || (m.kind === 'film' && m.still);
      case 'filmGallery': return m.kind === 'film';
      default: return false;
    }
  };
  var takesFiles = function (accepts) { return ['photo', 'still', 'loopOrPhoto', 'photoOrFilm'].indexOf(accepts) >= 0; };
  var asItems = function (v) { var x = v && v.toJS ? v.toJS() : v; return Array.isArray(x) ? x.filter(Boolean) : x ? [x] : []; };
  // A small preview for any library item: its still, or the first frame of a film that has none.
  function MediaThumb(p) {
    var m = p.item && p.item.media ? mediaById[p.item.media] : null;
    if (p.item && p.item.src) return h(Thumb, { src: thumbFor(p.item.src), path: p.item.src, alt: '' });
    if (m && m.thumb) return h('img', { className: 'pgk-thumb', src: m.thumb, alt: '', onError: function (e) { retryCachedThumb(e.currentTarget); } });
    if (m && m.frame) return h('video', { className: 'pgk-thumb', src: m.frame, muted: true, preload: 'metadata', playsInline: true, 'aria-hidden': true, tabIndex: -1 });
    return h('div', { className: 'pgk-thumb pgk-thumb--missing' }, m ? 'No preview' : 'Not in the library');
  }

  // Library picker for Page Media: search, type and service filters, previews for photos, films and playing excerpts.
  var LibraryPicker = createClass({
    getInitialState: function () { return { q: '', kind: '', cat: '', chosen: [] }; },
    componentDidMount: function () { if (this.search) this.search.focus(); },
    toggle: function (id) { var c = this.state.chosen.slice(); var i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else { if (!this.props.multiple) c = []; c.push(id); } this.setState({ chosen: c }); },
    render: function () {
      var self = this; var st = this.state; var q = st.q.toLowerCase();
      var pool = MEDIA.filter(function (m) { return fits(self.props.accepts, m); });
      var kinds = ['photo', 'film', 'loop'].filter(function (k) { return pool.some(function (m) { return m.kind === k; }); });
      var cats = []; pool.forEach(function (m) { if (m.catLabel && cats.indexOf(m.catLabel) < 0) cats.push(m.catLabel); }); cats.sort();
      var items = pool.filter(function (m) { return (!st.kind || m.kind === st.kind) && (!st.cat || m.catLabel === st.cat) && (!q || (m.title + ' ' + m.alt + ' ' + m.catLabel + ' ' + (m.project || '') + ' ' + m.id).toLowerCase().indexOf(q) >= 0); });
      var n = st.chosen.length;
      return h(Modal, { label: 'Choose from the library', onClose: this.props.onClose },
        h('div', { className: 'pgk-modal__inner' },
          h('div', { className: 'pgk-modal__head' },
            h('input', { type: 'search', placeholder: 'Search by name, description or service', value: st.q, ref: function (el) { self.search = el; }, onChange: function (e) { self.setState({ q: e.target.value }); }, 'aria-label': 'Search the library' }),
            kinds.length > 1 ? h('select', { value: st.kind, onChange: function (e) { self.setState({ kind: e.target.value }); }, 'aria-label': 'Type' }, h('option', { value: '' }, 'Photos and films'), kinds.map(function (k) { return h('option', { key: k, value: k }, KIND_WORD[k] + 's'); })) : null,
            cats.length > 1 ? h('select', { value: st.cat, onChange: function (e) { self.setState({ cat: e.target.value }); }, 'aria-label': 'Service' }, h('option', { value: '' }, 'Every service'), cats.map(function (c) { return h('option', { key: c, value: c }, c); })) : null,
            h('button', { type: 'button', className: 'pgk-btn', disabled: !n, onClick: function () { self.props.onPick(st.chosen); } }, n ? (self.props.multiple ? 'Add ' + n : 'Use this') : 'Choose'),
            h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: this.props.onClose }, 'Cancel')),
          h('p', { className: 'pgk-modal__count', role: 'status' }, items.length + ' of ' + pool.length + ' that fit this section'),
          items.length ? h('ul', { className: 'pgk-modal__grid' }, items.map(function (m) {
            var on = st.chosen.indexOf(m.id) >= 0;
            return h('li', { key: m.id },
              h('button', { type: 'button', className: 'pgk-pick' + (on ? ' is-on' : ''), 'aria-pressed': on, onClick: function () { self.toggle(m.id); }, title: m.title },
                h(MediaThumb, { item: { media: m.id } }),
                h('span', {}, m.title), h('span', { className: 'pgk-pick__meta' }, [KIND_WORD[m.kind], m.catLabel !== KIND_WORD[m.kind] ? m.catLabel : '', m.project ? 'from ' + m.project : '', m.hidden ? 'Hidden' : ''].filter(Boolean).join(' · '))));
          })) : h('p', { className: 'pgk-modal__empty' }, 'Nothing matches. Clear the search or the filters.')));
    },
  });

  // One section of a page (a single item or a list): replace, add, reorder, take off the page. Never deletes anything.
  var SlotControl = createClass({
    getInitialState: function () { return { picking: null, busy: false, msgs: [] }; },
    f: function (k) { return this.props.field.get(k); },
    items: function () { return asItems(this.props.value).map(function (x) { return Object.assign({}, x); }); },
    set: function (arr) { this.props.onChange(arr.length ? (this.f('multiple') ? arr : arr[0]) : CLEARED); },
    isValid: function () {
      var self = this; var arr = this.items(); var errs = [];
      if (this.f('mustHave') && !arr.length) errs.push('This section cannot be empty: choose a replacement instead of taking it off.');
      if (this.f('multiple') && arr.length && arr.length < this.f('min')) errs.push('Choose at least ' + this.f('min') + '.');
      if (arr.length > this.f('max')) errs.push('Choose no more than ' + this.f('max') + '.');
      arr.forEach(function (it, i) {
        var n = self.f('multiple') ? ' (item ' + (i + 1) + ')' : '';
        if (it.src && self.f('altMode') !== 'decorative' && !it.alt) errs.push('Describe the photo' + n + '.');
        var m = it.media ? mediaById[it.media] : null;
        if (it.media && !m) errs.push('“' + it.media + '” is not in the library any more' + n + '. Choose another.');
        if (m && !fits(self.f('accepts'), m)) errs.push('“' + m.title + '” does not fit this section' + n + '.');
        if (self.f('labelled') && it.media && !(m && m.kind === 'photo') && !it.label) errs.push('Add the words a screen reader hears' + n + '.');
      });
      return errs.length ? { error: { type: 'custom', message: errs.join(' ') } } : true;
    },
    pickDone: function (ids) {
      var arr = this.items(); var mode = this.state.picking;
      var add = ids.map(function (id) { return { media: id }; });
      if (mode === 'add') arr = arr.concat(add); else if (typeof mode === 'number') arr[mode] = add[0]; else arr = add.slice(0, 1);
      this.set(arr.slice(0, this.f('max'))); this.setState({ picking: null });
    },
    upload: function (e, index) {
      var self = this; var files = e.target.files; this.setState({ busy: true, msgs: [] });
      addFiles(this.props, files, this.props.field.get('label').split(':')[0]).then(function (r) {
        var arr = self.items(); var add = r.paths.map(function (p) { return { src: p, alt: '' }; });
        if (typeof index === 'number') arr[index] = add[0]; else arr = self.f('multiple') ? arr.concat(add) : add.slice(0, 1);
        self.set(arr.slice(0, self.f('max'))); self.setState({ busy: false, msgs: r.msgs });
      }).catch(function (err) { self.setState({ busy: false, msgs: ['Upload failed: ' + err] }); });
      e.target.value = '';
    },
    update: function (i, k, v) { var arr = this.items(); arr[i][k] = v; this.set(arr); },
    move: function (i, d) { var arr = this.items(); var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; this.set(arr); },
    remove: function (i) { var arr = this.items(); arr.splice(i, 1); this.set(arr); },
    render: function () {
      var self = this; var arr = this.items(); var multi = this.f('multiple'); var accepts = this.f('accepts');
      var full = arr.length >= this.f('max'); var locked = this.f('mustHave') && arr.length <= Math.max(1, this.f('min') || 1);
      var fileInput = function (index) { return h('input', { type: 'file', accept: ACCEPT, multiple: multi && index == null, hidden: true, ref: function (el) { self['in' + (index == null ? 'Add' : index)] = el; }, onChange: function (e) { self.upload(e, index); }, 'aria-label': 'Upload a photo' }); };
      return h('div', { className: 'pgk-slot', id: this.props.forID },
        h(SlotContext, { field: this.props.field }),
        h('p', { className: 'pgk-slot__kind' }, 'Takes: ' + (this.f('kind') || '') + (multi ? ' · up to ' + this.f('max') : '') + (this.f('empty') ? ' · ' + this.f('empty') : '')),
        arr.length ? h('ol', { className: 'pgk-gallery__list' }, arr.map(function (it, i) {
          var m = it.media ? mediaById[it.media] : null;
          var name = m ? m.title : it.src ? String(it.src).split('/').pop() : '';
          return h('li', { key: (it.media || it.src || '') + i, className: 'pgk-row' },
            h(MediaThumb, { item: it }),
            h('div', { className: 'pgk-row__fields' },
              h(UsagePeek, { media: m }),
              h('p', { className: 'pgk-row__title' }, h('strong', {}, name), ' ', h('span', {}, m ? [KIND_WORD[m.kind], m.catLabel !== KIND_WORD[m.kind] ? m.catLabel : '', m.hidden ? 'hidden in the library: shown on the review site only, left out of the live site' : ''].filter(Boolean).join(' · ') : 'Photo file used only here')),
              it.src && self.f('altMode') !== 'decorative' ? h('label', {}, h('span', {}, 'Description (alt text)' + (it.alt ? '' : ' · needed')), h('input', { type: 'text', value: it.alt || '', onChange: function (e) { self.update(i, 'alt', e.target.value); } })) : null,
              self.f('labelled') && it.media && !(m && m.kind === 'photo') ? h('label', {}, h('span', {}, 'What a screen reader hears' + (it.label ? '' : ' · needed')), h('input', { type: 'text', value: it.label || '', placeholder: 'e.g. Beachfront estate film, muted excerpt', onChange: function (e) { self.update(i, 'label', e.target.value); } })) : null,
              h('div', { className: 'pgk-gallery__bar' },
                h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ picking: i }); } }, 'Replace from library'),
                takesFiles(accepts) ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', disabled: self.state.busy, onClick: function () { self['in' + i].click(); } }, 'Replace with an upload') : null,
                takesFiles(accepts) ? fileInput(i) : null)),
            h('div', { className: 'pgk-row__tools' },
              multi ? h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, -1); }, disabled: i === 0, 'aria-label': 'Move item ' + (i + 1) + ' up' }, '↑') : null,
              multi ? h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, 1); }, disabled: i === arr.length - 1, 'aria-label': 'Move item ' + (i + 1) + ' down' }, '↓') : null,
              h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet pgk-btn--small', disabled: locked, title: locked ? 'This section needs a picture. Replace it instead.' : '', onClick: function () { self.remove(i); } }, 'Take off this page')));
        })) : h('p', { className: 'pgk-slot__empty' }, this.f('empty') ? 'Empty. ' + this.f('empty') : 'Nothing chosen yet.'),
        !full || !arr.length ? h('div', { className: 'pgk-gallery__bar' },
          h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.setState({ picking: 'add' }); } }, arr.length ? 'Add from library' : 'Choose from library'),
          takesFiles(accepts) ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', disabled: this.state.busy, onClick: function () { self.inAdd.click(); } }, this.state.busy ? 'Uploading…' : 'Upload a photo') : null,
          takesFiles(accepts) ? fileInput(null) : null) : null,
        h('p', { className: 'pgk-slot__note' }, 'Taking something off this page never deletes it. Photos and films from the library stay in Photos and Films. A photo uploaded straight to this page is a file of its own: when it is off every page and saved, delete it under ', h('button', { type: 'button', className: 'pgk-linkbtn', onClick: function () { window.pgkOpenUploads(); } }, 'Uploaded files'), '.'),
        this.state.msgs.length ? h('ul', { className: 'pgk-msg', role: 'alert' }, this.state.msgs.map(function (m, i) { return h('li', { key: i }, m); })) : null,
        this.state.picking !== null ? h(LibraryPicker, { accepts: accepts, multiple: multi && this.state.picking === 'add', onClose: function () { self.setState({ picking: null }); }, onPick: function (ids) { self.pickDone(ids); } }) : null);
    },
  });
  CMS.registerWidget('pgk-slot', SlotControl);

  // ---------- Page Media galleries (Codex review of 11c9abe: per-page selection, order and removal) ----------
  // Automatic keeps today's behaviour; “Leave out on this page” hides one item here only; “My own selection” is exactly
  // these items in this order. The library and every other page stay as they are.
  var GALLERIES = window.PHOTOGRAFIK_GALLERIES || {};
  var PROJECTS = window.PHOTOGRAFIK_PROJECTS || [];
  var projectById = {}; PROJECTS.forEach(function (p) { projectById[p.slug] = p; });
  var ProjectThumb = function (p) { var x = projectById[p.slug]; return x && x.thumb ? h('img', { className: 'pgk-thumb', src: x.thumb, alt: '' }) : h('div', { className: 'pgk-thumb pgk-thumb--missing' }, x ? 'No preview' : 'Not found'); };
  var ProjectPicker = createClass({
    getInitialState: function () { return { q: '', chosen: [] }; },
    componentDidMount: function () { if (this.search) this.search.focus(); },
    toggle: function (s) { var c = this.state.chosen.slice(); var i = c.indexOf(s); if (i >= 0) c.splice(i, 1); else { if (!this.props.multiple) c = []; c.push(s); } this.setState({ chosen: c }); },
    render: function () {
      var self = this; var q = this.state.q.toLowerCase(); var n = this.state.chosen.length;
      var list = PROJECTS.filter(function (p) { return p.cat === 'commercial' && (!q || (p.title + ' ' + p.slug).toLowerCase().indexOf(q) >= 0); });
      return h(Modal, { label: 'Choose projects', onClose: this.props.onClose },
        h('div', { className: 'pgk-modal__inner' },
          h('div', { className: 'pgk-modal__head' },
            h('input', { type: 'search', placeholder: 'Search Commercial projects', value: this.state.q, ref: function (el) { self.search = el; }, onChange: function (e) { self.setState({ q: e.target.value }); }, 'aria-label': 'Search projects' }),
            h('button', { type: 'button', className: 'pgk-btn', disabled: !n, onClick: function () { self.props.onPick(self.state.chosen); } }, n ? (self.props.multiple ? 'Add ' + n : 'Use this') : 'Choose'),
            h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: this.props.onClose }, 'Cancel')),
          h('ul', { className: 'pgk-modal__grid' }, list.map(function (p) {
            var on = self.state.chosen.indexOf(p.slug) >= 0;
            return h('li', { key: p.slug }, h('button', { type: 'button', className: 'pgk-pick' + (on ? ' is-on' : ''), 'aria-pressed': on, onClick: function () { self.toggle(p.slug); } },
              h(ProjectThumb, { slug: p.slug }), h('span', {}, p.title), h('span', { className: 'pgk-pick__meta' }, p.hidden ? 'Draft' : 'Published')));
          }))));
    },
  });
  var GallerySlot = createClass({
    getInitialState: function () { return { picking: false, showAll: false }; },
    f: function (k) { return this.props.field.get(k); },
    val: function () { var v = this.props.value; return v && v.toJS ? v.toJS() : v || null; },
    byProject: function () { return this.f('accepts') === 'projectGallery' || this.f('accepts') === 'project'; },
    idOf: function (it) { return this.byProject() ? it.project : it.media; },
    item: function (id) { var o = {}; o[this.byProject() ? 'project' : 'media'] = id; return o; },
    auto: function () { return GALLERIES[this.f('galleryKey')] || []; },
    // Same limit as the build (GALLERY_MAX in page-media-core.js). An empty own selection is allowed: nothing shows here.
    isValid: function () { var v = this.val(); return v && v.mode === 'custom' && (v.items || []).length > 400 ? { error: { type: 'custom', message: 'Choose no more than 400.' } } : true; },
    setCustom: function (items) { this.props.onChange({ mode: 'custom', items: items }); },
    move: function (i, d) { var items = this.val().items.slice(); var j = i + d; if (j < 0 || j >= items.length) return; var x = items[i]; items[i] = items[j]; items[j] = x; this.setCustom(items); },
    thumb: function (id) { return this.byProject() ? h(ProjectThumb, { slug: id }) : h(MediaThumb, { item: { media: id } }); },
    title: function (id) { var x = this.byProject() ? projectById[id] : mediaById[id]; return x ? x.title : id; },
    sub: function (id) { if (this.byProject()) { var p = projectById[id]; return p ? (p.hidden ? 'Draft project' : 'Project') : 'Not found'; } var m = mediaById[id]; return m ? [KIND_WORD[m.kind], m.catLabel, m.hidden ? 'hidden: review site only' : ''].filter(Boolean).join(' · ') : 'Not in the library any more'; },
    render: function () {
      var self = this; var v = this.val(); var accepts = this.f('accepts');
      // A single project (Commercial case study).
      if (accepts === 'project') {
        return h('div', { className: 'pgk-slot', id: this.props.forID },
          h('p', { className: 'pgk-slot__kind' }, 'Automatic: ' + this.f('auto')),
          h('label', { className: 'pgk-confirm' }, h('span', {}, 'Project shown as the case study'),
            h('select', { value: v && v.hide ? '-' : v && v.project ? v.project : '', onChange: function (e) { var x = e.target.value; self.props.onChange(x === '-' ? { hide: true } : x ? { project: x } : CLEARED); } },
              h('option', { value: '' }, 'Automatic'), h('option', { value: '-' }, 'No case study on this page'), PROJECTS.filter(function (p) { return p.cat === 'commercial'; }).map(function (p) { return h('option', { key: p.slug, value: p.slug }, p.title + (p.hidden ? ' (draft)' : '')); }))));
      }
      var custom = v && v.mode === 'custom';
      var exclude = (v && v.exclude) || [];
      var radio = function (mode, label) { return h('label', { className: 'pgk-radio' }, h('input', { type: 'radio', name: self.props.forID + '-mode', checked: (mode === 'custom') === !!custom, onChange: function () {
        if (mode === 'automatic') self.props.onChange(exclude.length ? { mode: 'automatic', exclude: exclude } : CLEARED);
        else self.setCustom(self.auto().filter(function (id) { return exclude.indexOf(id) < 0; }).map(function (id) { return self.item(id); }));
      } }), ' ' + label); };
      var list = custom ? (v.items || []).map(function (it) { return self.idOf(it); }) : this.auto();
      var shown = this.state.showAll || custom ? list : list.slice(0, 24);
      return h('div', { className: 'pgk-slot', id: this.props.forID },
        h(SlotContext, { field: this.props.field }),
        h('fieldset', { className: 'pgk-files' }, h('legend', {}, 'What this gallery shows'),
          radio('automatic', 'Automatic: ' + this.f('auto')),
          radio('custom', 'My own selection and order (starts from what it shows now)')),
        !custom && exclude.length ? h('p', { className: 'pgk-slot__kind' }, exclude.length + ' left out on this page only.') : null,
        h('ol', { className: 'pgk-gallery__list' }, shown.map(function (id, i) {
          var out = !custom && exclude.indexOf(id) >= 0;
          return h('li', { key: id + i, className: 'pgk-row' + (out ? ' pgk-row--out' : '') },
            self.thumb(id),
            h('div', { className: 'pgk-row__fields' }, h('p', { className: 'pgk-row__title' }, h('strong', {}, self.title(id)), ' ', h('span', {}, out ? 'Left out on this page' : self.sub(id)))),
            h('div', { className: 'pgk-row__tools' },
              custom ? h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, -1); }, disabled: i === 0, 'aria-label': 'Move item ' + (i + 1) + ' up' }, '↑') : null,
              custom ? h('button', { type: 'button', className: 'pgk-icon', onClick: function () { self.move(i, 1); }, disabled: i === list.length - 1, 'aria-label': 'Move item ' + (i + 1) + ' down' }, '↓') : null,
              custom ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet pgk-btn--small', onClick: function () { var items = v.items.slice(); items.splice(i, 1); self.setCustom(items); } }, 'Take off this page')
                : h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet pgk-btn--small', onClick: function () {
                  var ex = out ? exclude.filter(function (x) { return x !== id; }) : exclude.concat([id]);
                  self.props.onChange(ex.length ? { mode: 'automatic', exclude: ex } : CLEARED);
                } }, out ? 'Put back' : 'Leave out on this page')));
        })),
        !custom && list.length > shown.length ? h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ showAll: true }); } }, 'Show all ' + list.length) : null,
        custom ? h('div', { className: 'pgk-gallery__bar' }, h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.setState({ picking: true }); } }, this.byProject() ? 'Add projects' : 'Add from library')) : null,
        custom && !list.length ? h('p', { className: 'pgk-slot__empty' }, 'Nothing chosen: this gallery shows nothing on this page.') : null,
        h('p', { className: 'pgk-slot__note' }, 'Changes here affect this page only. The library and every other page stay as they are.'),
        this.state.picking ? (this.byProject()
          ? h(ProjectPicker, { multiple: true, onClose: function () { self.setState({ picking: false }); }, onPick: function (ids) { self.setCustom(v.items.concat(ids.filter(function (id) { return list.indexOf(id) < 0; }).map(function (id) { return self.item(id); }))); self.setState({ picking: false }); } })
          : h(LibraryPicker, { accepts: accepts, multiple: true, onClose: function () { self.setState({ picking: false }); }, onPick: function (ids) { self.setCustom(v.items.concat(ids.filter(function (id) { return list.indexOf(id) < 0; }).map(function (id) { return self.item(id); }))); self.setState({ picking: false }); } })) : null);
    },
  });
  CMS.registerWidget('pgk-gallery-slot', GallerySlot);

  // Top of each Page Media page: where to see it, what fills itself, and whether the site has caught up with saves.
  var PageNote = createClass({
    componentDidMount: function () { var self = this; this.sub = function () { self.forceUpdate(); }; siteState.subs.push(this.sub); },
    componentWillUnmount: function () { var self = this; siteState.subs = siteState.subs.filter(function (f) { return f !== self.sub; }); },
    render: function () {
      var f = this.props.field; var route = f.get('route'); var auto = (f.get('automatic') && f.get('automatic').toJS) ? f.get('automatic').toJS() : [];
      return h('div', { className: 'pgk-note', id: this.props.forID },
        h('h2', {}, this.props.field.get('pageLabel') || 'Page Media'),
        h('p', {}, h('a', { href: window.location.origin + route, target: '_blank', rel: 'noopener' }, 'Open this page on the review site ↗'), ' ', h('span', { className: 'pgk-note__state' }, siteState.text())),
        h('p', {}, 'Photos uploaded to this page that nothing uses any more can be deleted under ', h('button', { type: 'button', className: 'pgk-linkbtn', onClick: function () { window.pgkOpenUploads(); } }, 'Uploaded files'), '.'),
        auto.length ? h('div', {}, h('p', { className: 'pgk-note__h' }, 'Fills itself (changed elsewhere):'), h('ul', {}, auto.map(function (a, i) { return h('li', { key: i }, h('strong', {}, a[0] + ': '), a[1] + ' ', h('a', { href: a[2] }, 'Open')); }))) : null);
    },
  });
  CMS.registerWidget('pgk-page-note', PageNote);

  // ---------- Talking to /api/cms-manage with the signed-in editor's GitHub session ----------
  function ghToken() {
    var keys = ['decap-cms-user', 'netlify-cms-user'];
    for (var i = 0; i < keys.length; i++) { try { var u = JSON.parse(localStorage.getItem(keys[i]) || 'null'); if (u && u.token) return u.token; } catch (e) { /* try the next */ } }
    return null;
  }
  function manage(body) {
    var t = ghToken();
    if (!t) return Promise.resolve({ ok: false, status: 401, message: 'Sign out and sign in again, so the dashboard can check the latest saved version.' });
    return fetch('/api/cms-manage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'The site did not answer. Try again in a minute.' }; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { ok: false, message: 'No connection. Nothing was changed.' }; });
  }

  // ---------- Uploaded files: find one nothing uses any more, delete it after checking, Undo (Codex review of 9e06705) ----------
  // A photo uploaded straight to a page section is a file of its own (no Photos record). Once it is off every page and
  // saved, it is listed here as not used; deleting it checks the branch's latest files again and can be undone.
  window.pgkOpenUploads = function () {
    var o = document.activeElement; var opener = o && o !== document.body ? { el: o, text: (o.textContent || '').trim(), scope: o.closest && o.closest('[id]') ? o.closest('[id]').id : null } : null;
    var wrap = document.createElement('div'); wrap.className = 'pgk-modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'pgk-up-h');
    var box = document.createElement('div'); box.className = 'pgk-modal__box'; wrap.appendChild(box);
    var state = { files: null, head: null, open: null, typed: '', busy: false, msg: '', done: {} };
    function close() {
      document.removeEventListener('keydown', onKey, true); wrap.remove();
      if (!opener) return;
      // If the page redrew the button that opened this, find the same button again in the same place.
      var back = document.contains(opener.el) ? opener.el : opener.scope && document.getElementById(opener.scope) ? Array.prototype.find.call(document.getElementById(opener.scope).querySelectorAll('button'), function (b) { return (b.textContent || '').trim() === opener.text; }) : null;
      if (back && back.focus) back.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (state.open && !state.busy) { state.open = null; draw(); } else if (!state.busy) close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(wrap.querySelectorAll(FOCUSABLE), function (x) { return x.getClientRects().length; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!wrap.contains(at)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    var el = function (tag, attrs, kids) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { if (c) n.appendChild(c); }); return n; };
    function load() {
      state.files = null; state.msg = ''; draw();
      manage({ action: 'files' }).then(function (r) { if (r.ok) { state.files = r.files; state.head = r.head; } else state.msg = r.message || 'The list could not be loaded.'; draw(); });
    }
    function del(f) {
      state.busy = true; draw();
      manage({ action: 'deleteFile', path: f.path, head: state.head, confirm: state.typed }).then(function (r) {
        state.busy = false;
        if (r.ok) { state.done[f.path] = r.commit; state.head = r.commit; state.open = null; state.focus = 'Undo deleting ' + f.path.split('/').pop(); state.msg = r.message + ' The review site updates in a few minutes.'; }
        else { state.msg = r.message || 'Nothing was deleted.'; if (r.changed) { load(); return; } }
        draw();
      });
    }
    function undo(f) {
      state.busy = true; draw();
      manage({ action: 'restore', commit: state.done[f.path] }).then(function (r) { state.busy = false; if (r.ok) { delete state.done[f.path]; state.head = r.commit; state.focus = 'Delete ' + f.path.split('/').pop(); state.msg = 'Restored ' + f.path.split('/').pop() + '.'; } else state.msg = r.message || 'Nothing was restored.'; draw(); });
    }
    function draw() {
      var focusName = state.focus || (document.activeElement && wrap.contains(document.activeElement) ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent) : null); state.focus = null;
      box.innerHTML = '';
      var body = el('div', { class: 'pgk-modal__body' });
      body.appendChild(el('h2', { id: 'pgk-up-h', text: 'Uploaded files' }));
      body.appendChild(el('p', { text: 'Photos uploaded straight to a page section, a project or an article. A file that nothing uses any more can be deleted here; anything still used, or protected, is kept. Save page changes first: this list reads the latest saved version.' }));
      if (state.msg) body.appendChild(el('p', { class: 'pgk-msg', role: 'status', text: state.msg }));
      if (!state.files) body.appendChild(el('p', { role: 'status', text: 'Checking every page, project, article and library record…' }));
      else {
        var unused = state.files.filter(function (f) { return f.removable || state.done[f.path]; });
        body.appendChild(el('p', { class: 'pgk-gallery__count', text: unused.length + ' not used · ' + (state.files.length - unused.length) + ' in use or protected' }));
        var list = el('ol', { class: 'pgk-gallery__list' });
        state.files.forEach(function (f) {
          var nameOf = f.path.split('/').pop(); var gone = !!state.done[f.path];
          var img = el('img', { class: 'pgk-thumb', src: f.path, alt: '', loading: 'lazy' }); img.onerror = function () { if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = repoRaw + f.path; } };
          var info = el('div', { class: 'pgk-row__fields' }, [
            el('p', { class: 'pgk-row__title' }, [el('strong', { text: nameOf }), document.createTextNode(' '), el('span', { text: gone ? 'Deleted' : f.removable ? 'Not used anywhere' : f.pinned ? 'Protected site file' : 'Used in: ' + f.shared.join('; ') })]),
          ]);
          if (state.open === f.path) {
            var input = el('input', { type: 'text', 'aria-label': 'Type the file name to confirm' }); input.value = state.typed;
            input.addEventListener('input', function () { state.typed = input.value; btn.disabled = state.busy || state.typed.trim() !== nameOf; });
            var btn = el('button', { type: 'button', class: 'pgk-btn pgk-btn--danger', text: state.busy ? 'Deleting…' : 'Delete for good', onclick: function () { del(f); } }); btn.disabled = state.busy || state.typed.trim() !== nameOf;
            info.appendChild(el('label', { class: 'pgk-confirm' }, [el('span', { text: 'Type the file name to confirm: ' + nameOf }), input]));
            info.appendChild(el('div', { class: 'pgk-gallery__bar' }, [btn, el('button', { type: 'button', class: 'pgk-btn pgk-btn--quiet', text: 'Cancel', onclick: function () { state.open = null; draw(); } })]));
            setTimeout(function () { input.focus(); }, 0);
          }
          var tools = el('div', { class: 'pgk-row__tools' }, [
            gone ? el('button', { type: 'button', class: 'pgk-btn pgk-btn--quiet pgk-btn--small', 'aria-label': 'Undo deleting ' + nameOf, text: 'Undo', onclick: function () { undo(f); } })
              : f.removable && state.open !== f.path ? el('button', { type: 'button', class: 'pgk-btn pgk-btn--quiet pgk-btn--small', 'aria-label': 'Delete ' + nameOf, text: 'Delete…', onclick: function () { state.open = f.path; state.typed = ''; state.msg = ''; draw(); } }) : null,
          ]);
          list.appendChild(el('li', { class: 'pgk-row' + (gone ? ' pgk-row--out' : '') }, [img, info, tools]));
        });
        body.appendChild(list);
      }
      body.appendChild(el('div', { class: 'pgk-gallery__bar' }, [el('button', { type: 'button', class: 'pgk-btn pgk-btn--quiet', text: 'Check again', onclick: load }), el('button', { type: 'button', class: 'pgk-btn', text: 'Close', onclick: close })]));
      box.appendChild(body);
      if (focusName) { var again = Array.prototype.find.call(box.querySelectorAll('button, input'), function (b) { return (b.getAttribute('aria-label') || b.textContent) === focusName; }); if (again) again.focus(); }
    }
    document.body.appendChild(wrap); load();
    setTimeout(function () { var b = wrap.querySelector('button'); if (b && !wrap.contains(document.activeElement)) b.focus(); }, 0);
  };

  // ---------- Saved vs on the site (Codex CMS audit #9) ----------
  // Compares the branch's latest commit (what Save wrote) with the commit the review site was built from.
  // States, from what is actually known (Codex CMS review): the branch's latest commit (what Save wrote), the build
  // Vercel reported on that commit (pending, success, failure or nothing yet), and the commit the review site serves.
  var siteState = { head: null, build: null, subs: [], kind: function () {
    var d = siteStatus.data; var b = siteState.build || { state: 'unknown' };
    if (!d || !siteState.head) return 'checking';
    if (d.commit === siteState.head) return 'live';
    if (b.state === 'failure') return 'failed';
    if (b.state === 'pending') return 'building';
    if (b.state === 'success') return 'built';
    return 'saved';
  }, text: function () {
    var d = siteStatus.data; var since = d ? when(d.builtAt) : '';
    switch (siteState.kind()) {
      case 'live': return 'The review site shows your latest save (built ' + since + ').';
      case 'failed': return 'The review site could not be updated with your latest save, so it still shows the version from ' + since + '. Your save is kept. Open the build report to see why, then fix or undo the last change and save again.';
      case 'building': return 'Your latest save is being built. The review site still shows the version from ' + since + '.';
      case 'built': return 'A deployment completed, but this dashboard’s website has not confirmed that version yet. Waiting for its status file.';
      case 'saved': return 'Saved. No build has been reported for it yet; the review site still shows the version from ' + since + '.';
      default: return siteState.savedMessage || 'Checking whether the site has your latest save…';
    }
  } };
  var PILL = { checking: ['Checking website update…', ' pgk-sitepill--busy'], live: ['Website updated', ''], building: ['Site updating…', ' pgk-sitepill--busy'], built: ['Site updating…', ' pgk-sitepill--busy'], saved: ['Saved, waiting for the site', ' pgk-sitepill--busy'], failed: ['Site update failed', ' pgk-sitepill--failed'] };
  var pill = document.createElement('p'); pill.className = 'pgk-sitepill'; pill.setAttribute('role', 'status'); pill.hidden = true;
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(pill); }); if (document.body) document.body.appendChild(pill);
  function drawPill() {
    var k = siteState.kind(); var p = PILL[k]; if (!p) return;
    pill.hidden = false; pill.className = 'pgk-sitepill' + p[1]; pill.textContent = p[0]; pill.title = siteState.text();
    if (k === 'failed' && siteState.build && siteState.build.url) { var a = document.createElement('a'); a.href = siteState.build.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' Build report'; pill.appendChild(a); }
  }
  function checkHead() {
    if (!ghToken()) return;
    manage({ action: 'head' }).then(function (r) {
      if (!r.ok) return; siteState.head = r.head; siteState.build = r.build || { state: 'unknown' };
      // A finished build means a newer status file: read it now rather than at the next minute.
      if (siteState.build.state === 'success' && siteStatus.data && siteStatus.data.commit !== r.head) loadStatus();
      drawPill(); siteState.subs.forEach(function (f) { f(); });
    });
  }
  siteStatus.subs.push(function () { drawPill(); siteState.subs.forEach(function (f) { f(); }); });
  setTimeout(checkHead, 1500); setInterval(checkHead, 45000);
  window.__pgkCheckSite = checkHead; // lets the dashboard tests ask again without waiting 45 s

  // ---------- Where it is used, and delete (photos, films, projects, Field Notes) ----------
  var COLLECTION_WORD = { photos: 'photo', films: 'film', projects: 'project', 'field-notes': 'article' };
  var ManageControl = createClass({
    getInitialState: function () { return { loading: false, info: null, open: false, typed: '', files: {}, busy: false, done: null, err: '' }; },
    key: function () { return this.props.entry && this.props.entry.get('slug'); },
    col: function () { return this.props.collection && this.props.collection.get('name'); },
    isNew: function () { return !this.key() || (this.props.entry && this.props.entry.get('newRecord')); },
    check: function () {
      var self = this; if (this.isNew()) return; this.setState({ loading: true, err: '' });
      manage({ action: 'check', collection: this.col(), key: this.key() }).then(function (r) {
        var files = {}; (r.files || []).forEach(function (f) { if (f.removable) files[f.path] = true; });
        self.setState({ loading: false, info: r.ok ? r : null, err: r.ok ? '' : r.message, files: files });
      });
    },
    componentDidMount: function () { this.check(); },
    del: function () {
      var self = this; var st = this.state; this.setState({ busy: true, err: '' });
      manage({ action: 'delete', collection: this.col(), key: this.key(), head: st.info.head, confirm: st.typed, files: Object.keys(st.files).filter(function (p) { return st.files[p]; }) }).then(function (r) {
        if (r.ok) self.setState({ busy: false, done: r });
        else { self.setState({ busy: false, err: r.message || 'Nothing was deleted.' }); if (r.changed) self.check(); }
      });
    },
    undo: function () {
      var self = this; this.setState({ busy: true });
      manage({ action: 'restore', commit: this.state.done.commit }).then(function (r) { self.setState({ busy: false, done: r.ok ? Object.assign({}, self.state.done, { undone: r }) : self.state.done, err: r.ok ? '' : r.message }); });
    },
    render: function () {
      var self = this; var st = this.state; var word = COLLECTION_WORD[this.col()] || 'item';
      if (this.isNew()) return h('div', { className: 'pgk-note', id: this.props.forID }, 'Where this ' + word + ' is used appears here after it is saved.');
      var info = st.info;
      var used = info ? info.blocking : [];
      return h('div', { className: 'pgk-manage', id: this.props.forID },
        st.loading ? h('p', { role: 'status' }, 'Checking where this ' + word + ' is used in the latest saved version…') : null,
        st.err && !st.open ? h('p', { className: 'pgk-msg', role: 'alert' }, st.err) : null,
        info ? h('div', {},
          used.length ? h('div', {}, h('p', {}, h('strong', {}, 'Used in ' + used.length + (used.length === 1 ? ' place:' : ' places:'))), h('ul', {}, used.map(function (u, i) { return h('li', { key: i }, u.href ? h('a', { href: u.href }, u.text) : u.text); })))
            : h('p', {}, h('strong', {}, 'Not chosen for any page section, project or article.')),
          (info.auto || []).length ? h('p', {}, 'Shown automatically in: ' + info.auto.join('; ') + '. Deleting it simply takes it out of ' + (info.auto.length === 1 ? 'that' : 'those') + '; nothing else changes.') : !used.length ? h('p', { className: 'pgk-manage__note' }, 'It does not appear anywhere on the site right now.') : null,
          (info.notes || []).map(function (n, i) { return h('p', { key: i, className: 'pgk-manage__note' }, n); }),
          this.col() === 'photos' || this.col() === 'films' ? h('p', { className: 'pgk-manage__note' }, 'To take it off the site but keep it, switch Show on site off instead of deleting.') : null,
          h('div', { className: 'pgk-gallery__bar' },
            h('button', { type: 'button', className: 'pgk-btn pgk-btn--danger', onClick: function () { self.setState({ open: true, typed: '', err: '', done: null }); } }, 'Delete this ' + word + '…'),
            h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: this.check }, 'Check again'))) : null,
        st.open && info ? h(Modal, { labelledBy: 'pgk-del-h', narrow: true, onClose: st.busy ? null : function () { if (st.done && !st.done.undone) { location.hash = '#/collections/' + self.col(); location.reload(); } else self.setState({ open: false }); } },
          h('div', { className: 'pgk-modal__inner' },
            h('div', { className: 'pgk-modal__body' },
              h('h2', { id: 'pgk-del-h' }, st.done ? (st.done.undone ? 'Restored' : 'Deleted') : 'Delete “' + info.name + '”?'),
              st.done ? h('div', {},
                h('p', {}, st.done.undone ? 'Everything that was deleted is back. The review site updates in a few minutes.' : st.done.message + ' Removed in one saved change: ' + st.done.removed.length + (st.done.removed.length === 1 ? ' file' : ' files') + '. The review site updates in a few minutes.'),
                st.done.undone ? null : h('p', {}, 'Changed your mind? Undo puts back exactly what was removed.'),
                h('div', { className: 'pgk-gallery__bar' },
                  st.done.undone ? null : h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', disabled: st.busy, onClick: this.undo }, st.busy ? 'Undoing…' : 'Undo'),
                  h('button', { type: 'button', className: 'pgk-btn', onClick: function () { location.hash = '#/collections/' + self.col(); location.reload(); } }, 'Back to the list')))
              : used.length ? h('div', {},
                h('p', {}, 'It cannot be deleted while it is used. Change these first (each link opens the place), then check again:'),
                h('ul', {}, used.map(function (u, i) { return h('li', { key: i }, u.href ? h('a', { href: u.href, onClick: function () { self.setState({ open: false }); } }, u.text) : u.text); })),
                h('div', { className: 'pgk-gallery__bar' }, h('button', { type: 'button', className: 'pgk-btn', onClick: function () { self.setState({ open: false }); } }, 'Close')))
              : h('div', {},
                h('p', {}, 'This removes the ' + word + ' from the dashboard and the site in one saved change. It can be undone straight after, and it stays recoverable in the site’s history.'),
                (info.files || []).length ? h('fieldset', { className: 'pgk-files' }, h('legend', {}, 'Picture files'),
                  info.files.map(function (f) {
                    var nm = String(f.path).split('/').pop();
                    return f.removable ? h('label', { key: f.path }, h('input', { type: 'checkbox', checked: !!st.files[f.path], onChange: function (e) { var x = Object.assign({}, st.files); x[f.path] = e.target.checked; self.setState({ files: x }); } }), ' Also delete the file ' + nm + ' (nothing else uses it)')
                      : h('p', { key: f.path }, 'Keeps ' + nm + ': ' + (f.shared.length ? 'also used by ' + f.shared.join('; ') : 'a protected site file') + '.');
                  })) : null,
                h('label', { className: 'pgk-confirm' }, h('span', {}, 'Type the name to confirm: ', h('strong', {}, info.name)), h('input', { type: 'text', value: st.typed, autoFocus: true, onChange: function (e) { self.setState({ typed: e.target.value }); } })),
                st.err ? h('p', { className: 'pgk-msg', role: 'alert' }, st.err) : null,
                h('div', { className: 'pgk-gallery__bar' },
                  h('button', { type: 'button', className: 'pgk-btn pgk-btn--danger', disabled: st.busy || st.typed.trim().toLowerCase() !== String(info.name).trim().toLowerCase(), onClick: this.del }, st.busy ? 'Deleting…' : 'Delete for good'),
                  h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ open: false }); } }, 'Cancel')))))) : null);
    },
  });
  CMS.registerWidget('pgk-manage', ManageControl);

  // ---------- Films from Google Drive: status, retry and a playable preview ----------
  // The film forms on screen, so a Save can start following its import in the same open form (Codex acceptance of
  // bce18af: Ready → Replace → Save stayed on "Waiting" after the import had finished, until the page was reloaded).
  var FILM_FORMS = [];
  if (CMS.registerEventListener) CMS.registerEventListener({ name: 'preSave', handler: function () {
    pill.hidden = false; pill.className = 'pgk-sitepill pgk-sitepill--busy'; pill.textContent = 'Validating and saving…'; pill.title = 'Nothing is confirmed saved until the save finishes. Website delivery is checked separately.';
  } });
  var pendingState = function (v) { return !!(v && (v.state === 'waiting' || v.state === 'retry')); };
  if (CMS.registerEventListener) CMS.registerEventListener({ name: 'postSave', handler: function (o) {
    var e = o && o.entry; var data = e && e.get && e.get('data');
    var imp = data && data.get && data.get('import'); imp = imp && imp.toJS ? imp.toJS() : imp;
    siteState.savedMessage = data && data.get('published') === true ? 'Content saved in Git; awaiting validation and website update.' : 'Draft saved in Git; awaiting validation and website update.';
    siteState.head = null; siteState.build = null; drawPill(); checkHead();
    if (!pendingState(imp)) return;
    var drive = data.get('drive');
    FILM_FORMS.forEach(function (f) { if (pendingState(f.val())) f.follow(e.get('slug'), { savedAt: Date.now(), drive: drive == null ? '' : String(drive) }); });
  } });
  var POLL_MS = function () { return window.__pgkFilmPollMs || 15000; };
  var FilmStatus = createClass({
    getInitialState: function () { return { run: null }; },
    componentDidMount: function () {
      FILM_FORMS.push(this);
      if (this.isNew() && !this.props.value) this.props.onChange({ state: 'waiting' });
      // Opened while an import is pending: follow it from the newest pending revision of this film.
      if (pendingState(this.val()) && !this.isNew()) this.follow(this.props.entry.get('slug'), {});
    },
    componentWillUnmount: function () { this.stop(); var self = this; FILM_FORMS = FILM_FORMS.filter(function (f) { return f !== self; }); },
    stop: function () { clearTimeout(this.timer); this.gen = (this.gen || 0) + 1; this.track = null; },
    // Replace (or Retry) pressed: nothing is followed until it is saved. The revisions that exist now are noted, so the
    // film's earlier Ready record can never be taken for the result of this new request.
    ask: function () {
      var self = this; this.stop(); this.known = null; this.setState({ run: null, finished: null, result: null, checked: false, savedAt: null });
      this.props.onChange({ state: 'retry' });
      var slug = this.props.entry && this.props.entry.get('slug'); if (!slug) return;
      this.gh('/commits?sha=' + encodeURIComponent(config.backend.branch) + '&path=' + encodeURIComponent('content/media/' + slug + '.json') + '&per_page=20').then(function (cs) { if (cs) self.known = cs.map(function (c) { return c.sha; }); });
    },
    gh: function (path, raw) {
      var t = ghToken(); var hd = Object.assign(raw ? { Accept: 'application/vnd.github.raw+json' } : {}, t ? { Authorization: 'Bearer ' + t } : {});
      return fetch('https://api.github.com/repos/' + config.backend.repo + path, { headers: hd, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    },
    follow: function (slug, opts) {
      if (!slug) return;
      this.stop(); var gen = this.gen;
      this.track = { slug: slug, savedAt: opts.savedAt || null, drive: opts.drive, known: opts.savedAt ? this.known : null, request: null, recs: {} };
      this.setState({ run: null, finished: null, result: null, checked: false, savedAt: null });
      this.poll(gen);
    },
    pollNow: function () { if (this.track) this.poll(this.gen); }, // for the dashboard tests
    // One look at GitHub. The request is the newest revision of this film's file that asks for an import (waiting or
    // retry), saved by this Save when one was made here: newer than the revisions noted at Replace, no older than the
    // Save, with the same Drive link. The import counts as finished only when a later revision records Ready or Failed.
    // Every record is read at its own commit, so a slow GitHub cache only delays the answer, never fakes it.
    poll: function (gen) {
      var self = this; var tr = this.track; if (!tr || gen !== this.gen) return;
      var path = 'content/media/' + tr.slug + '.json';
      var rec = function (sha) { return tr.recs[sha] ? Promise.resolve(tr.recs[sha]) : self.gh('/contents/' + path + '?ref=' + sha, true).then(function (r) { tr.recs[sha] = r || {}; return tr.recs[sha]; }); };
      var dateOf = function (c) { return c && c.commit && c.commit.committer && c.commit.committer.date; };
      this.gh('/commits?sha=' + encodeURIComponent(config.backend.branch) + '&path=' + encodeURIComponent(path) + '&per_page=10').then(function (cs) {
        if (gen !== self.gen) return null; cs = cs || [];
        var find = function (i) {
          if (tr.request || i >= cs.length) return Promise.resolve();
          var c = cs[i];
          if (tr.known && tr.known.indexOf(c.sha) >= 0) return Promise.resolve();
          if (tr.savedAt && new Date(dateOf(c)).getTime() < tr.savedAt - 120000) return Promise.resolve();
          return rec(c.sha).then(function (r) {
            if (pendingState(r && r.import) && (tr.drive === undefined || String(r.drive || '') === tr.drive)) tr.request = { sha: c.sha, date: dateOf(c) };
            else return find(i + 1);
          });
        };
        return find(0).then(function () {
          if (gen !== self.gen) return null;
          if (!tr.request) { self.setState({ checked: true }); return null; }
          var newest = cs[0];
          var later = newest && newest.sha !== tr.request.sha && new Date(dateOf(newest)) >= new Date(tr.request.date);
          return (later ? rec(newest.sha) : Promise.resolve(null)).then(function (r) {
            if (gen !== self.gen) return null;
            var st = r && r.import && r.import.state;
            if (st === 'ready' || st === 'failed') return self.done(r);
            return self.gh('/actions/workflows/film-import.yml/runs?head_sha=' + tr.request.sha + '&per_page=5').then(function (j) {
              if (gen !== self.gen) return;
              self.setState({ run: (j && j.workflow_runs && j.workflow_runs[0]) || null, savedAt: tr.request.date, checked: true });
            });
          });
        });
      }).then(function () { if (gen === self.gen && self.track) self.timer = setTimeout(function () { self.poll(gen); }, POLL_MS()); });
    },
    // The import recorded its result. Failed: shown here with Retry (the form now holds that result). Ready: the film's
    // files changed, so this form must be reloaded before it is saved again (it still holds the old file names).
    done: function (r) {
      this.stop();
      if (r.import.state === 'failed') { this.setState({ finished: null, result: null }); this.props.onChange(r.import); return; }
      this.setState({ finished: 'ready', result: r });
    },
    isNew: function () { return !!(this.props.entry && this.props.entry.get('newRecord')); },
    // A new film, or a film asked to be (re)imported, cannot be saved without the Drive link of the film file.
    isValid: function () {
      if (this.state.finished === 'ready') return { error: { type: 'custom', message: 'The new copy of this film is ready and its files changed. Reload this page before saving again, so nothing puts the old file names back. Copy any text you changed here first.' } };
      var v = this.val(); var asked = this.isNew() || (v && (v.state === 'waiting' || v.state === 'retry'));
      if (asked && !/^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)[\w-]{20,}/.test(String(this.drive() || ''))) return { error: { type: 'custom', message: 'Paste the Google Drive link of the film file (drive.google.com/file/d/…) before saving.' } };
      return true;
    },
    val: function () { var v = this.props.value; return v && v.toJS ? v.toJS() : v; },
    data: function (k) { var v = this.props.entry && this.props.entry.getIn(['data', k]); return v && v.toJS ? v.toJS() : v; },
    // The Drive link as it is in the form now. In the real Decap 3.16.3 editor, props.entry inside isValid still held the
    // form as it was when this field last changed (Codex acceptance of 94d5fb1: James's valid link was refused), so the
    // Drive field reports its own current value here (pgk-drive below).
    drive: function () { return Object.prototype.hasOwnProperty.call(LIVE, 'drive') ? LIVE.drive : this.data('drive'); },
    render: function () {
      var self = this; var v = this.val(); var src = this.data('src'); var slug = this.props.entry && this.props.entry.get('slug');
      var box = function (cls, kids) { return h('div', { className: 'pgk-film pgk-film--' + cls, id: self.props.forID, role: 'status' }, kids); };
      if (this.isNew()) return box('new', [h('p', { key: 1 }, h('strong', {}, 'Add a film from Google Drive. '), 'Fill in the title, Drive link and service above, then Save. The site then makes the web copies it plays (a 720p film, a poster and a small card poster): usually a few minutes for a short film. The original stays in your Drive.'), h('p', { key: 2 }, 'The film stays a hidden draft until Ready; then choose Show on site and Save. Finished exports under 200 MB, shared “Anyone with the link can view”.')]);
      var replace = function (label) { return h('div', { key: 'r', className: 'pgk-gallery__bar' }, h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: self.ask }, label)); };
      var asked = v && (v.state === 'waiting' || v.state === 'retry');
      if (!v || (!asked && v.state !== 'failed' && !this.data('drive') && src)) {
        // A film already on the site: say what the site actually does with it.
        var rights = this.data('rights'); var rep = this.data('replacement'); var pub = this.data('published');
        var caps = this.data('captions'); var capOk = caps === 'burned-in' || this.data('captionsStatus') === 'approved' || this.data('dialogue') === false;
        var line = rights !== 'approved' ? 'Held: its rights are not cleared, so it is not on the site whatever Published says.'
          : rep && rep.status === 'pending' ? 'On the review site, waiting for its replacement before launch (James, Oct 13).'
            : pub === false ? 'Hidden draft: production leaves it out. The review site may show it with a draft note.' : capOk ? 'Show on site requested. Check Website updated for deployment confirmation.' : 'On the review site. Its captions are not approved yet, which the live site needs before launch.';
        return box('ready', [h('p', { key: 1 }, line), src ? h(FilmPreview, { key: 2, src: src, poster: this.data('poster') }) : null, replace('Replace with a file from Google Drive')]);
      }
      if (v.state === 'ready') return box('ready', [h('p', { key: 1 }, h('strong', {}, 'Ready. '), v.message || 'Imported from Google Drive. Website delivery is confirmed separately below.'), h(FilmPreview, { key: 2, src: src || '/v/' + slug + '.mp4', poster: this.data('poster') }),
        h('p', { key: 3, className: 'pgk-gallery__count' }, 'Editing the title, description or captions never re-imports the film. To use a new export, or new poster or excerpt settings:'), replace('Replace or re-import from Google Drive')]);
      if (v.state === 'failed') return box('failed', [h('p', { key: 1 }, h('strong', {}, 'The import did not work. '), v.message || ''), h('div', { key: 2, className: 'pgk-gallery__bar' }, h('button', { type: 'button', className: 'pgk-btn', onClick: self.ask }, 'Retry import'), h('span', { className: 'pgk-gallery__count' }, 'Then press Save. Fix the link or the sharing in Drive first if the message says so.'))]);
      var st = this.state; var run = st.run;
      if (st.finished === 'ready') { var res = st.result || {};
        return box('ready', [h('p', { key: 1 }, h('strong', {}, 'Ready: the new files are saved. '), (res.import && res.import.message) || ''), res.src ? h(FilmPreview, { key: 2, src: res.src, poster: res.poster }) : null,
          h('p', { key: 3, className: 'pgk-gallery__count' }, 'Reload this page before saving anything else on this film (copy any text you changed here first).'), h('button', { key: 4, type: 'button', className: 'pgk-btn', onClick: function () { location.reload(); } }, 'Reload')]); }
      var retry = h('button', { key: 3, type: 'button', className: 'pgk-btn', onClick: self.ask }, 'Retry import');
      var line; var showRetry = false;
      var ranAgo = run && run.updated_at ? Date.now() - new Date(run.updated_at).getTime() : 0;
      if (!this.track && !this.isNew()) line = [h('strong', { key: 'a' }, 'Not saved yet. '), 'Press Save to start the import.'];
      else if (run && (run.status === 'queued' || run.status === 'in_progress' || run.status === 'waiting')) line = [h('strong', { key: 'a' }, 'Importing from Google Drive now. '), 'Started ' + when(run.run_started_at || run.created_at) + '. A short film usually takes a few minutes.'];
      else if (run && run.status === 'completed' && run.conclusion === 'success' && ranAgo < 3 * 60000) line = [h('strong', { key: 'a' }, 'The import finished. '), 'Checking that it recorded this film…'];
      else if (run && run.status === 'completed' && run.conclusion === 'success') { line = [h('strong', { key: 'a' }, 'The import ran but did not record this film. '), 'It may have been changed while it was importing. Press Retry import, then Save.']; showRetry = true; }
      else if (run && run.status === 'completed') { line = [h('strong', { key: 'a' }, 'The import stopped with an error before it could report here. '), 'Press Retry import, then Save. If it happens again, the import step needs a look. ', run.html_url ? h('a', { key: 'b', href: run.html_url, target: '_blank', rel: 'noopener' }, 'Details') : null]; showRetry = true; }
      else if (st.checked && st.savedAt && Date.now() - new Date(st.savedAt).getTime() > 10 * 60000) line = [h('strong', { key: 'a' }, 'The import has not started. '), 'It was saved ' + when(st.savedAt) + ' and no import has run for it. The video importer may need attention; your saved draft is kept. Ask for the import service to be checked.'];
      else line = [h('strong', { key: 'a' }, 'Waiting to import from Google Drive. '), 'It starts within a minute or two of saving.'];
      var replacing = src && asked ? h('p', { key: 0 }, h('strong', {}, 'Replacing this film. '), 'Paste the new Drive link above if it is a new file (or keep it to re-import with new poster or excerpt settings), then Save. The site keeps playing the current copy until the new one is ready.') : null;
      return box('waiting', [replacing, h('p', { key: 1 }, line), showRetry ? retry : null]);
    },
  });
  // Plays the site's copy; until the review site has it, the copy in the repository (same file).
  var FilmPreview = createClass({
    getInitialState: function () { return { step: 0 }; },
    render: function () {
      var self = this; var p = this.props;
      var url = this.state.step === 0 ? p.src : /^\/v\//.test(p.src) ? repoRaw + p.src : null;
      if (!url) return h('p', { className: 'pgk-gallery__count' }, 'Preview not available yet. It appears once the site has updated.');
      return h('video', { className: 'pgk-film__player', src: url, poster: p.poster && this.state.step === 0 ? p.poster : undefined, controls: true, preload: 'metadata', playsInline: true, onError: function () { self.setState({ step: self.state.step + 1 }); } });
    },
  });
  CMS.registerWidget('pgk-film-status', FilmStatus);

  // The film's Google Drive link: Decap's own text field, which also tells the film status check what is typed now.
  var StringWidget = CMS.getWidget && CMS.getWidget('string');
  var DriveControl = createClass({
    componentWillUnmount: function () { delete LIVE.drive; },
    render: function () {
      var v = this.props.value; LIVE.drive = v == null ? '' : String(v);
      if (StringWidget && StringWidget.control) return h(StringWidget.control, this.props);
      var self = this;
      return h('input', { type: 'text', id: this.props.forID, className: this.props.classNameWrapper, value: LIVE.drive, onChange: function (e) { self.props.onChange(e.target.value); }, onFocus: this.props.setActiveStyle, onBlur: this.props.setInactiveStyle });
    },
  });
  CMS.registerWidget('pgk-drive', DriveControl, StringWidget && StringWidget.preview);

  // Decap's own string, text or select field (named by the field's `inner` setting) that also reports its current value,
  // for the project fields the Published check needs (name, service, description, story, main image description).
  var LiveControl = createClass({
    componentWillUnmount: function () { liveDrop(this.props.field); },
    render: function () {
      var self = this; var inner = this.props.field.get('inner') || 'string'; liveSet(this.props.field, this.props.value);
      var w = CMS.getWidget && CMS.getWidget(inner);
      if (w && w.control) return h(w.control, this.props);
      var v = this.props.value == null ? '' : this.props.value; var change = function (e) { self.props.onChange(e.target.value); };
      if (inner === 'select') return h('select', { id: this.props.forID, value: v, onChange: change }, h('option', { value: '' }, ''), (this.props.field.get('options') || []).map(function (o) { o = o && o.toJS ? o.toJS() : o; var val = typeof o === 'object' ? o.value : o; return h('option', { key: val, value: val }, typeof o === 'object' ? o.label : o); }));
      return h(inner === 'text' ? 'textarea' : 'input', { type: inner === 'text' ? undefined : 'text', id: this.props.forID, value: v, onChange: change });
    },
  });
  var LivePreview = function (props) { var w = CMS.getWidget && CMS.getWidget((props.field && props.field.get('inner')) || 'string'); return w && w.preview ? h(w.preview, props) : h('div', {}, props.value == null ? '' : String(props.value)); };
  CMS.registerWidget('pgk-live', LiveControl, LivePreview);

  // Captions: none yet, burned into the video, or a .vtt file uploaded here.
  var CaptionsControl = createClass({
    getInitialState: function () { return { msg: '', busy: false }; },
    upload: function (e) {
      var self = this; var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      this.setState({ busy: true, msg: '' });
      f.text().then(function (txt) {
        if (!/^﻿?WEBVTT/.test(txt)) throw new Error('This is not a WebVTT captions file (.vtt). Export captions as WebVTT and try again.');
        var slug = (self.props.entry && self.props.entry.get('slug')) || String(self.props.entry.getIn(['data', 'title']) || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var file = new File([f], slug + '.vtt', { type: 'text/vtt' });
        return Promise.resolve(self.props.onPersistMedia(file, { field: self.props.field })).then(function () { self.props.onChange('/captions/' + slug + '.vtt'); self.setState({ busy: false }); });
      }).catch(function (err) { self.setState({ busy: false, msg: String(err.message || err) }); });
    },
    render: function () {
      var self = this; var v = this.props.value || null; var mode = !v ? 'none' : v === 'burned-in' ? 'burned' : 'file';
      var radio = function (val, label) { return h('label', { className: 'pgk-radio' }, h('input', { type: 'radio', name: self.props.forID, checked: mode === val, onChange: function () { if (val === 'none') self.props.onChange(CLEARED); else if (val === 'burned') self.props.onChange('burned-in'); else self.input.click(); } }), ' ' + label); };
      return h('div', { id: this.props.forID, className: 'pgk-captions' },
        radio('none', 'No captions yet'), radio('burned', 'Captions are burned into the video'), radio('file', 'Caption file (.vtt)'),
        mode === 'file' ? h('p', { className: 'pgk-gallery__count' }, String(v).split('/').pop(), ' ', h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet pgk-btn--small', onClick: function () { self.input.click(); } }, 'Replace file')) : null,
        h('input', { type: 'file', accept: '.vtt,text/vtt', hidden: true, ref: function (el) { self.input = el; }, onChange: this.upload, 'aria-label': 'Choose a captions file' }),
        this.state.busy ? h('p', { role: 'status' }, 'Adding the captions file…') : null,
        this.state.msg ? h('p', { className: 'pgk-msg', role: 'alert' }, this.state.msg) : null);
    },
  });
  CMS.registerWidget('pgk-captions', CaptionsControl);

  // Widget styles (thumbnails, rows, buttons, status).
  var widgetCss = document.createElement('style');
  widgetCss.textContent = [
    '.pgk-section { border-top: 2px solid #c9d7d7; padding: 4px 0; color: #405656; } .pgk-section h2 { margin: 6px 0; font-size: 21px; font-weight: 650; } .pgk-section p:empty { display: none; } .pgk-section p { margin: 0; font-size: 14px; line-height: 1.5; }',
    '.pgk-context { border-left: 3px solid #527575; background: #f4f8f7; padding: 10px 12px; margin-bottom: 12px; font-size: 14px; } .pgk-context p { margin: 5px 0; } .pgk-usage { margin: 5px 0 10px; font-size: 13px; } .pgk-note details { margin-top: 12px; } .pgk-note summary { cursor: pointer; } .pgk-note input[type=number] { max-width: 160px; padding: 8px; }',
    '.pgk-thumb { display: block; width: 160px; height: 110px; object-fit: cover; border-radius: 6px; background: #eef0f3; }',
    '.pgk-thumb--empty, .pgk-thumb--missing { display: flex; align-items: center; justify-content: center; padding: 8px; font-size: 12px; line-height: 1.3; color: #5b6472; text-align: center; box-sizing: border-box; }',
    '.pgk-gallery__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 0; }',
    '.pgk-gallery__count { font-size: 13px; color: #5b6472; }',
    '.pgk-media-help { margin: 10px 24px; padding: 12px 14px; background: #eef4f4; border-radius: 6px; font-size: 14px; color: #273c3d; } .pgk-media-help a { color: #176277; font-weight: 600; text-decoration: underline; }',
    '.pgk-btn { font: inherit; font-size: 14px; padding: 8px 14px; min-height: 40px; border-radius: 6px; border: 1px solid #1f2937; background: #1f2937; color: #fff; cursor: pointer; }',
    '.pgk-btn--quiet { background: #fff; color: #1f2937; }', '.pgk-btn[disabled] { opacity: .6; cursor: wait; }',
    '.pgk-gallery__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }',
    '.pgk-row { display: grid; grid-template-columns: 160px 1fr auto; gap: 14px; align-items: start; padding: 10px; border: 1px solid #dfe3e8; border-radius: 8px; background: #fff; }',
    '.pgk-row__fields label { display: block; margin-bottom: 8px; } .pgk-row__fields label span { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }',
    '.pgk-row__fields input, .pgk-row__fields select { width: 100%; box-sizing: border-box; font: inherit; font-size: 14px; padding: 7px 9px; border: 1px solid #c9ced6; border-radius: 6px; }',
    '.pgk-row__file { margin: 0; font-size: 12px; color: #5b6472; word-break: break-all; }',
    '.pgk-row__tools { display: flex; flex-direction: column; gap: 6px; }',
    '.pgk-icon { width: 40px; height: 40px; border-radius: 6px; border: 1px solid #c9ced6; background: #fff; font-size: 16px; cursor: pointer; }',
    '.pgk-icon[disabled] { opacity: .35; cursor: default; } .pgk-icon--danger { color: #b42318; }',
    '.pgk-msg { margin: 8px 0; padding: 8px 12px 8px 28px; border-radius: 6px; background: #fef3f2; color: #912018; font-size: 13px; }',
    '.pgk-pub { display: grid; gap: 8px; } .pgk-switch { display: inline-flex; align-items: center; gap: 10px; font-size: 15px; cursor: pointer; }',
    '.pgk-switch input { width: 20px; height: 20px; accent-color: #1f2937; }',
    '.pgk-pub__state { margin: 0; padding: 10px 12px; border-radius: 6px; background: #f1f5f9; font-size: 13px; line-height: 1.45; color: #1f2937; }',
    '.pgk-pub__state--held { background: #fef3f2; color: #912018; border: 1px solid #fecdca; }',
    '.pgk-pub__state--test { background: #fffaeb; color: #7a4a00; border: 1px solid #fedf89; }',
    '.pgk-statusbar { position: fixed; right: 12px; bottom: 12px; z-index: 400; max-width: min(560px, calc(100% - 260px)); padding: 8px 12px; border-radius: 8px; background: #fff; border: 1px solid #dfe3e8; box-shadow: 0 6px 24px rgba(0,0,0,.12); font-size: 13px; line-height: 1.45; color: #1f2937; }',
    '.pgk-statusbar[hidden], .pgk-sitepill[hidden] { display: none !important; }',
    '.pgk-statusbar--held { border-color: #fecdca; } .pgk-statusbar--quiet { padding: 4px 8px; display: flex; align-items: flex-start; gap: 12px; } .pgk-statusbar--quiet .pgk-statusbar__test { flex: 1; align-items: center; }',
    '.pgk-statusbar__test { display: flex; align-items: flex-start; gap: 8px; } .pgk-statusbar__test details { flex: 1; } .pgk-statusbar summary { cursor: pointer; }',
    '.pgk-statusbar__x { border: 0; background: none; font-size: 18px; line-height: 1; padding: 2px 6px; cursor: pointer; color: #5b6472; min-width: 32px; min-height: 32px; }',
    '.pgk-statusbar__meta summary { color: #5b6472; } .pgk-statusbar details p { margin: 6px 0 0; }',
    '@media (max-width: 640px) { .pgk-statusbar { left: 12px; right: 12px; max-width: none; bottom: 52px; } }',
    '.pgk-statusbar p { margin: 0 0 6px; } .pgk-statusbar__held { color: #912018; }',
    'a.pgk-card--grid { display: flex !important; flex-direction: column; overflow: hidden; }',
    'a.pgk-card--grid > .pgk-card-thumb { flex: 0 0 150px; display: block; width: 100%; height: 150px; margin: 0; object-fit: cover; border-radius: 5px 5px 0 0; background: #eef0f3; }',
    'a.pgk-card--grid > [class*="CardBody"] { flex: 1 1 auto; min-height: 0; }',
    'a.pgk-card--list { display: flex !important; align-items: center; gap: 14px; }',
    'a.pgk-card--list > .pgk-card-thumb { flex: 0 0 72px; width: 72px; height: 54px; margin: 0; object-fit: cover; border-radius: 4px; background: #eef0f3; }',
    '.pgk-card-thumb--none, .pgk-card-thumb--broken { display: flex !important; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box; color: #5b6472; font-size: 12px; line-height: 1.3; text-align: center; }',
    'a.pgk-card--list > .pgk-card-thumb--none { font-size: 10px; }',
    '.pgk-card-thumb--broken::after { content: "Preview not available yet"; }',
    '.pgk-card-meta { display: block; margin-top: 4px; font-size: 12px; line-height: 1.35; color: #5b6472; font-weight: 400; }',
    '.pgk-card-badge { display: inline-block; margin-top: 8px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }',
    '.pgk-card-badge--held { background: #fef3f2; color: #912018; border: 1px solid #fecdca; } .pgk-card-badge--test { background: #fffaeb; color: #7a4a00; border: 1px solid #fedf89; }',
    '.pgk-modal { position: fixed; inset: 0; z-index: 100001; background: rgba(15,23,42,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }',
    '.pgk-modal__box { background: #fff; border-radius: 10px; width: min(1100px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }',
    '.pgk-modal__head { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px; border-bottom: 1px solid #dfe3e8; } .pgk-modal__head input { flex: 1 1 240px; font: inherit; padding: 8px 10px; border: 1px solid #c9ced6; border-radius: 6px; }',
    '.pgk-modal__grid { list-style: none; margin: 0; padding: 14px; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }',
    '.pgk-pick { display: block; width: 100%; padding: 0; border: 2px solid transparent; border-radius: 6px; background: #fff; cursor: pointer; text-align: left; font: inherit; }',
    '.pgk-pick img { display: block; width: 100%; height: 100px; object-fit: cover; border-radius: 4px; } .pgk-pick span { display: block; font-size: 11px; line-height: 1.3; padding: 4px 2px; color: #374151; }',
    '.pgk-pick.is-on { border-color: #1f2937; box-shadow: 0 0 0 2px #1f2937; }',
    '.pgk-btn--small { min-height: 34px; padding: 5px 10px; font-size: 13px; } .pgk-btn--danger { background: #b42318; border-color: #b42318; color: #fff; } .pgk-btn--danger[disabled] { cursor: not-allowed; }',
    '.pgk-slot__kind, .pgk-slot__note, .pgk-slot__empty { margin: 4px 0 8px; font-size: 13px; color: #5b6472; } .pgk-slot__empty { padding: 12px; border: 1px dashed #c9ced6; border-radius: 6px; }',
    '.pgk-row__title { margin: 0 0 8px; font-size: 14px; } .pgk-row__title span { color: #5b6472; font-size: 12px; }',
    '.pgk-note, .pgk-manage, .pgk-film { padding: 12px 14px; border-radius: 8px; background: #f1f5f9; font-size: 14px; line-height: 1.5; color: #1f2937; } .pgk-note p, .pgk-manage p, .pgk-film p { margin: 0 0 8px; }',
    '.pgk-note a, .pgk-manage a { color: #176277; font-weight: 600; text-decoration: underline; } .pgk-note ul, .pgk-manage ul { margin: 0 0 8px; padding-left: 20px; } .pgk-note__h { font-weight: 600; } .pgk-note__state, .pgk-manage__note { color: #5b6472; }',
    '.pgk-film--failed { background: #fef3f2; color: #912018; } .pgk-film--waiting { background: #fffaeb; } .pgk-film__player { display: block; width: 100%; max-width: 480px; max-height: 360px; border-radius: 6px; background: #000; }',
    '.pgk-modal__inner { display: flex; flex-direction: column; min-height: 0; max-height: 90vh; } .pgk-modal__box--narrow { width: min(560px, 100%); } .pgk-modal__body { padding: 20px; overflow: auto; } .pgk-modal__body h2 { margin: 0 0 12px; font-size: 20px; }',
    '.pgk-modal__count, .pgk-modal__empty { margin: 0; padding: 8px 14px 0; font-size: 13px; color: #5b6472; } .pgk-modal__head select { font: inherit; padding: 8px; border: 1px solid #c9ced6; border-radius: 6px; }',
    '.pgk-pick .pgk-thumb { width: 100%; height: 100px; } .pgk-pick__meta { color: #5b6472 !important; }',
    '.pgk-files { margin: 0 0 12px; padding: 10px 12px; border: 1px solid #dfe3e8; border-radius: 6px; } .pgk-files label { display: block; margin: 4px 0; }',
    '.pgk-confirm { display: block; margin: 0 0 12px; } .pgk-confirm span { display: block; margin-bottom: 6px; } .pgk-confirm input { width: 100%; box-sizing: border-box; font: inherit; padding: 8px 10px; border: 1px solid #c9ced6; border-radius: 6px; }',
    '.pgk-captions .pgk-radio { display: block; margin: 4px 0; }',
    // Decap's Media overlay is 99999; guidance opened from it must be above that overlay.
    '#pgk-video-help { z-index: 100001; }',
    '.pgk-media-video { margin: 10px 24px 0; padding: 12px 14px; background: #fff6e8; border-radius: 6px; font-size: 14px; color: #3d2f14; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; } .pgk-steps { margin: 8px 0 14px 20px; padding: 0; line-height: 1.5; } .pgk-steps li { margin: 4px 0; } a.pgk-btn { display: inline-flex; align-items: center; text-decoration: none; }',
    '.pgk-linkbtn { border: 0; background: none; padding: 0; font: inherit; color: #176277; font-weight: 600; text-decoration: underline; cursor: pointer; }',
    '.pgk-files .pgk-radio { display: block; margin: 4px 0; } .pgk-row--out { opacity: .55; }',
    '.pgk-sitepill--failed { background: #fef3f2 !important; border-color: #fecdca !important; color: #912018 !important; } .pgk-sitepill a { color: inherit; font-weight: 600; }',
    '.pgk-sitepill { position: fixed; left: 12px; bottom: 12px; z-index: 390; margin: 0; padding: 6px 12px; border-radius: 999px; background: #ecfdf3; border: 1px solid #abefc6; color: #05603a; font-size: 12px; } .pgk-sitepill--busy { background: #fffaeb; border-color: #fedf89; color: #7a4a00; }',
    '@media (max-width: 640px) { .pgk-row { grid-template-columns: 96px 1fr; } .pgk-thumb { width: 96px; height: 72px; } .pgk-row__tools { grid-column: 1 / -1; flex-direction: row; } }',
  ].join('\n');
  document.head.appendChild(widgetCss);

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

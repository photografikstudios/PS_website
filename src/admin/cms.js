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
          h('button', { type: 'button', className: 'pgk-btn', onClick: this.pick, disabled: this.state.busy }, this.state.busy ? 'Adding photos…' : arr.length ? 'Upload more photos' : 'Upload photos'),
          h('button', { type: 'button', className: 'pgk-btn pgk-btn--quiet', onClick: function () { self.setState({ picking: true }); } }, 'Choose from site photos'),
          h('span', { className: 'pgk-gallery__count' }, arr.length ? arr.length + (arr.length === 1 ? ' photo' : ' photos') + '. The first one leads.' : 'Choose several at once: hold Shift or Command.'),
          h('input', { type: 'file', multiple: true, accept: ACCEPT, hidden: true, ref: function (el) { self.input = el; }, onChange: this.onFiles, 'aria-label': 'Choose photos' })),
        this.state.picking ? h(Picker, { multiple: true, onClose: function () { self.setState({ picking: false }); }, onPick: function (list) { self.props.onChange(toArr(self.props.value).concat(list.map(function (x) { return { image: x.src, alt: x.alt || '', focal: 'center', orientation: 'auto' }; }))); self.setState({ picking: false }); } }) : null,
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

  // ---------- Thumbnails on the collection lists (James, Oct 2 2026) ----------
  // Decap's list cards are text only. Each card links to its entry, so we add the photo the site itself serves for
  // that entry (built into config.js as PHOTOGRAFIK_THUMBS), or the local preview of a photo picked in this session.
  var siteThumbs = window.PHOTOGRAFIK_THUMBS || { photos: {}, films: {}, projects: {}, pick: [] };
  function cardThumb(col, slug) {
    var m = siteThumbs[col] || {};
    return m[slug] || null;
  }
  function decorateCards() {
    var links = document.querySelectorAll('a[href*="/collections/"][href*="/entries/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var mm = a.getAttribute('href').match(/collections\/([^/]+)\/entries\/([^/?#]+)/);
      if (!mm || !siteThumbs[mm[1]]) continue;
      var want = cardThumb(mm[1], decodeURIComponent(mm[2]));
      var have = a.querySelector('img.pgk-card-thumb, .pgk-card-thumb--none');
      if (have && have.getAttribute('data-for') === mm[2]) continue;
      if (have) have.remove();
      var el;
      if (want) { el = document.createElement('img'); el.src = want; el.alt = ''; el.loading = 'lazy'; el.className = 'pgk-card-thumb'; el.onerror = function () { this.className = 'pgk-card-thumb pgk-card-thumb--broken'; this.removeAttribute('src'); }; }
      else { el = document.createElement('div'); el.className = 'pgk-card-thumb--none'; el.textContent = mm[1] === 'films' ? 'No still image for this film yet' : 'New: preview after the next site update'; }
      el.setAttribute('data-for', mm[2]);
      var host = a.firstElementChild || a; host.insertBefore(el, host.firstChild);
    }
    // Projects: mark held and review-only cards (matched by opaque id, see the status file note below).
    if (!window.__pgkBadgeRun) { window.__pgkBadgeRun = true; setTimeout(function () { window.__pgkBadgeRun = false; badgeCards(); }, 80); }
  }
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
        (a.firstElementChild || a).appendChild(b);
      });
    });
  }
  var cardTimer = null;
  new MutationObserver(function () { clearTimeout(cardTimer); cardTimer = setTimeout(decorateCards, 60); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- Picker: choose photos that are already on the site ----------
  // For adding existing site photos to a project or article without uploading them again. Multi-select in galleries.
  var Picker = createClass({
    getInitialState: function () { return { q: '', chosen: {} }; },
    componentDidMount: function () { var self = this; this.onKey = function (e) { if (e.key === 'Escape') self.props.onClose(); }; document.addEventListener('keydown', this.onKey); if (this.search) this.search.focus(); },
    componentWillUnmount: function () { document.removeEventListener('keydown', this.onKey); },
    toggle: function (src) { var c = Object.assign({}, this.state.chosen); if (c[src]) delete c[src]; else { if (!this.props.multiple) c = {}; c[src] = true; } this.setState({ chosen: c }); },
    render: function () {
      var self = this; var q = this.state.q.toLowerCase();
      var items = siteThumbs.pick.filter(function (x) { return !q || (x.label + ' ' + x.alt + ' ' + x.cat).toLowerCase().indexOf(q) >= 0; });
      var n = Object.keys(this.state.chosen).length;
      return h('div', { className: 'pgk-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose photos already on the site' },
        h('div', { className: 'pgk-modal__box' },
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
  function renderBar() {
    var d = siteStatus.data; if (!d) return;
    var parts = [];
    var n = (d.held || []).length; var t = (d.reviewOnly || []).length;
    if (n) parts.push('<p class="pgk-statusbar__held"><strong>' + n + (n === 1 ? ' project is' : ' projects are') + ' not on the site.</strong> Published is on, but the last build held ' + (n === 1 ? 'it' : 'them') + ' back as a draft. In Projects ' + (n === 1 ? 'it is' : 'they are') + ' marked “Held”; the form says what to fix.</p>');
    if (t) parts.push('<p>' + t + (t === 1 ? ' project is a review-only test' : ' projects are review-only tests') + ', marked “Review-only test” in Projects: shown on the review site with a note, never built for the live site.</p>');
    bar.innerHTML = parts.join('') + (parts.length ? '<p class="pgk-statusbar__meta">From the ' + esc(d.mode === 'production' ? 'live' : 'review') + ' build ' + esc(shortSha(d.commit)) + ', ' + esc(when(d.builtAt)) + '. A save takes about two minutes to appear.</p>' : '');
    bar.hidden = !parts.length;
    decorateCards();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  loadStatus(); setInterval(loadStatus, 60000);

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
      var probs = publishProblems(this.props.entry.get('data'));
      return probs.length ? { error: { type: 'custom', message: 'Published is on, but the site would hold this project back. Before saving: ' + probs.join('; ') + '. Or switch Published off to save it as a draft.' } } : true;
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
      else if (on && slug && d) line = h('p', { className: 'pgk-pub__state' }, 'Shown on the review site as of build ' + shortSha(d.commit) + ', ' + when(d.builtAt) + '. Changes you save appear in about two minutes.');
      else if (on && !slug) line = h('p', { className: 'pgk-pub__state' }, 'It goes on the review site about two minutes after you save. This line confirms it once the site has updated.');
      return h('div', { className: 'pgk-pub', id: this.props.forID },
        h('label', { className: 'pgk-switch' },
          h('input', { type: 'checkbox', role: 'switch', checked: on, 'aria-checked': on, onChange: function (e) { self.props.onChange(e.target.checked); } }),
          h('span', {}, on ? 'Published' : 'Draft (not public)')),
        line);
    },
  });
  CMS.registerWidget('pgk-publish', PublishControl);

  // Widget styles (thumbnails, rows, buttons, status).
  var widgetCss = document.createElement('style');
  widgetCss.textContent = [
    '.pgk-thumb { display: block; width: 160px; height: 110px; object-fit: cover; border-radius: 6px; background: #eef0f3; }',
    '.pgk-thumb--empty, .pgk-thumb--missing { display: flex; align-items: center; justify-content: center; padding: 8px; font-size: 12px; line-height: 1.3; color: #5b6472; text-align: center; box-sizing: border-box; }',
    '.pgk-gallery__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 0; }',
    '.pgk-gallery__count { font-size: 13px; color: #5b6472; }',
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
    '.pgk-statusbar { position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 400; max-width: 760px; margin: 0 auto; padding: 10px 14px; border-radius: 8px; background: #fff; border: 1px solid #fecdca; box-shadow: 0 6px 24px rgba(0,0,0,.12); font-size: 13px; line-height: 1.45; color: #1f2937; }',
    '.pgk-statusbar p { margin: 0 0 6px; } .pgk-statusbar__held { color: #912018; } .pgk-statusbar__meta { color: #5b6472; margin: 0 !important; }',
    '.pgk-card-thumb { display: block; width: 100%; height: 150px; object-fit: cover; border-radius: 4px 4px 0 0; margin: -16px 0 12px; background: #eef0f3; }',
    '.pgk-card-thumb--broken, .pgk-card-thumb--none { display: flex; align-items: center; justify-content: center; height: 150px; margin: -16px 0 12px; background: #eef0f3; color: #5b6472; font-size: 12px; }',
    '.pgk-card-thumb--broken::after { content: "Preview not available yet"; }',
    '.pgk-card-badge { display: inline-block; margin-top: 8px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }',
    '.pgk-card-badge--held { background: #fef3f2; color: #912018; border: 1px solid #fecdca; } .pgk-card-badge--test { background: #fffaeb; color: #7a4a00; border: 1px solid #fedf89; }',
    '.pgk-modal { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }',
    '.pgk-modal__box { background: #fff; border-radius: 10px; width: min(1100px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }',
    '.pgk-modal__head { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px; border-bottom: 1px solid #dfe3e8; } .pgk-modal__head input { flex: 1 1 240px; font: inherit; padding: 8px 10px; border: 1px solid #c9ced6; border-radius: 6px; }',
    '.pgk-modal__grid { list-style: none; margin: 0; padding: 14px; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }',
    '.pgk-pick { display: block; width: 100%; padding: 0; border: 2px solid transparent; border-radius: 6px; background: #fff; cursor: pointer; text-align: left; font: inherit; }',
    '.pgk-pick img { display: block; width: 100%; height: 100px; object-fit: cover; border-radius: 4px; } .pgk-pick span { display: block; font-size: 11px; line-height: 1.3; padding: 4px 2px; color: #374151; }',
    '.pgk-pick.is-on { border-color: #1f2937; box-shadow: 0 0 0 2px #1f2937; }',
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

# Editing the website by page

Open `/admin#/collections/pages`. Choose Home, About or another page. The former Page Text and Page Media screens are now one **Pages** workspace; old Page Media bookmarks open the matching page.

1. Choose a section in **On this page**. Sections follow the website's order.
2. Edit its labels, headings, paragraphs and button text beside its media. Bold and Italic format the selected text. Existing links and tracking are retained; editable buttons have a destination field.
3. Choose or upload a photo, select a film, set size/fit/focus, or arrange that page's gallery in the same section. Reusable files still belong to the Photo/Film library; taking a placement off the page does not delete its source.
4. Use Desktop or Phone in **Section preview**. This is an unsaved section preview. Gallery order is shown in its thumbnails; review the finished page after saving. New source photo files are not cropped or stretched.
5. **Save once** for the page's text and media together. Wait for **Website updated**, then use **Open saved page**. Saving and a completed preview deployment are separate states. The preview remains separate from public launch approval.

About includes its client reviews and Real Estate includes its general FAQs. Reviews are shared with Home, so keep quotes verbatim and write a faithful optional Home excerpt. Cancellation/licensing answers stay with the approved policies. Project stories and article bodies already have their own combined text/media editors; use the shared-content links when editing those records.

**Search & social appearance** edits this page's SEO title, description and optional sharing image without changing its visible heading. No URL moves, pricing changes, global layout changes or production publication are part of this editor update.

The original page content is preserved until a change is saved. Text defaults remain in templates/`content/pages.json`; this page's changes, media, SEO, review/FAQ overrides are committed together in `content/page-media/<page>.json`. Stored copy keys are checked against current named template targets. If a target moves, the build stops with a reload/fix message instead of silently putting text in another location. `_page` is the temporary form value and is flattened by preSave; it is never stored in site content.

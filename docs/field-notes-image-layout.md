# Moving images inside a Field Note

Open **Field Notes**, choose an article, and scroll to **Article**.

1. Choose **Arrange images**. The article's paragraphs and headings appear in reading order with photo/film thumbnails between them.
2. Drag a photo itself or its **↕ Drag image** handle to a **Place image here** position. Drop targets stay stationary as you drag. The preview updates immediately.
3. You can also click/press Enter on the handle and choose a position, or use **Move up / Move down**. Escape cancels a picked-up image and returns focus to its handle. This gives phone and keyboard users a way to arrange images without dragging.
4. Captions, alt text and library references travel with the photo. **Remove image** takes it out of the article without deleting its file. **Undo image change** restores the last move/removal exactly. Up to 20 image changes are retained while this article stays open; after editing the underlying text, Undo is disabled rather than replacing newer writing.
5. Return to **Write** to edit prose or add photos with the existing + controls. The hero image is set in its field above; the optional after-article gallery remains a separate gallery.
6. Choose **Save → Save now**, wait for **Website updated**, then check the saved article. Moving an image does not change the article's Show on site setting.

## Implementation and checks

`pgk-article` wraps the existing pinned Decap Markdown writing/preview controls. The Arrange images view operates on the same plain Markdown body. No article migration or content rewrite occurs on open or view switching. `src/lib/article-layout-core.js` conserves the exact source text of every prose/media block; image captions remain in their Markdown token. Blank-line separators are added only where a move requires a new block boundary. Fenced examples and loose lists stay together. Every current article round-trips byte-identically; moving all media to either end retains every prose and media block.

Drag data contains only a position, and moves use this component's own picked-up item/value snapshot. An external drag cannot rearrange an article, and a changed body cancels a stale move instead of using an old index. Thumbnails keep their native proportions. Drop targets and the status region reserve their space so the article does not jump during a gesture.

Checks: `npm test`, `npm run test:dashboard`, and the real pinned-editor test below. The latter uses an isolated in-memory backend and blocks all external requests; it exercises native mouse grab/scroll/drop, Undo, regular writing, phone keyboard placement, Save/reopen and the retained draft state. It does not write a website article to GitHub.

```sh
curl -fsSL 'https://unpkg.com/decap-cms@3.16.3/dist/decap-cms.js' -o /tmp/decap-cms-3.16.3.js
DECAP_TEST_BUNDLE=/tmp/decap-cms-3.16.3.js npm run test:article-editor
```

The bundle's SHA-384 must match `src/admin/decap.json` before the test executes it. The browser test uses installed Chrome and the project's existing Playwright setup. This is review-editor verification, separate from physical Safari/iPhone/VoiceOver and final launch approval.

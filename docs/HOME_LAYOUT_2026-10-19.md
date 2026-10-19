# Home layout and thumbnail refinement — October 19, 2026

## Requested and implemented

- Order after the unchanged hero: Listing Media / Brand & Business Media cards, Selected Work, then the existing testimonial. The exact quotation, copy, prices and CTA destinations are retained.
- Shorter service cards and section spacing. At 1440px, the tiles measure about 403px high (previous minimum 660px); at 1024px they measure 340px. Cards grow naturally when copy/buttons require it on narrow screens.
- Selected Work uses the same standard page width as the two service cards. At 1440px both measure 1360px with 40px side margins.
- Initial HTML and JavaScript both select Photos / Real Estate. The initial View more destination is `/real-estate?type=photo#portfolio`.
- Two rows: five columns / ten items at 1280px and above, four columns / eight items at 701–1279px, two columns / four items on phones. Existing filtering, curation/order and service-page access remain. Changing screen size recalculates the visible count.
- Thumbnail ratio is 4:3, retaining more of the original still than the former 16:9 desktop crop. Eight affected Creator records use the existing focal metadata. Home's top-focused portrait podcast stills receive extra headroom, and podcast cards do not zoom into faces on hover. Source images/videos and full-frame lightbox playback are unchanged.

## Verified

- Review build: 37 pages. Existing gallery unit tests: 8/8 passed. JavaScript syntax and `git diff --check` passed.
- Actual browser checks at 1440, 1024, 768, 390 and 320px: two rows, expected column/count changes, equal service/gallery width, real-estate photo defaults and no horizontal page overflow.
- Ten podcast thumbnails loaded and were visually inspected at desktop width. Phone layout and portrait film playback checked.
- Photo lightbox → Next changes image/caption → Escape closes and restores card focus.
- Podcast playback reached readyState 4 and advanced from 0.125 to 9.251 seconds; phone playback also reached readyState 4, unpaused, in its original portrait frame.
- View more actually navigated to the Real Estate photo-filter URL.
- Existing Home browser-test expectations were updated for the new owner-selected order, photo default, two rows and responsive item counts. The entire automated end-to-end suite was not rerun for this scoped change; no fresh site-wide score or launch approval is claimed.

## Scope and release

Only `redesign/2027-preview` may be pushed. No production/domain, protection, rights, caption approval, visibility, legal or pricing changes. The Home hero and Page Media selections are preserved. Existing caption/launch gates remain. The shared `WHAT_WAS_CHANGED.md` records the exact READY deployment and subsequent deployed browser acceptance.

Evidence: shared `_evidence/home-layout-2026-10-19/`, including browser geometry/playback JSON and screenshots.

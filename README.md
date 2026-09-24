# Photografik Studios website

Static site with no dependencies, built on Vercel from JSON content. Pages are rendered by `src/build.mjs` into `dist/`.

## Editing content (no design code)

Everything a non-developer should change lives in `content/`:

| File | What it controls |
| --- | --- |
| `content/pricing.json` | Residential size bands, packages, à la carte services, fixed add-ons. **One table drives every price on the site.** |
| `content/offers.json` | Agent monthly plans, business monthly plans, commercial property starting points, Creator Studios sessions. |
| `content/work.json` | Portfolio projects, gallery media (stills and videos), and the two gallery filter lists (service type, industry). |
| `content/faqs.json` | FAQ questions and answers. |
| `content/seo.json` | Page titles and meta descriptions. |
| `content/site.json` | Contact details, booking link, inquiry destination, navigation, media host. |

Every price, offer and FAQ has an `approval` field. `"pending"` items show in review previews with a yellow **Needs approval** tag. In a production build they are hidden, and the build **fails** if any residential package is still pending, so unapproved prices can't go live by accident.

### Add a portfolio piece
1. Add or reuse a project in `projects` (slug, title, category, location, services, summary, story, hero image).
2. Add media records to `media`: `type` (`image`/`video`), `service` (one or more ids from `taxonomy.service`), `category` (one id from `taxonomy.category`), `orientation` (`vertical` 9:16 or `horizontal`), `src`, `poster` for videos (or `posterTime` to use a frame), `alt` for images.
3. Filter options appear automatically when at least one item uses them.

### One media collection, three views
`content/work.json` → `media` is the only list of portfolio pieces. Home Selected Work (Video/Photo × category, lightbox, View more → Work), the Real Estate gallery (package × media type, Load More) and Work (service × industry) are all filtered views of it. Never copy a record into a second list.

Extra fields per record:
- `packageIds`: verified HD Photo Hub package ids (`luxury-media`, `signature`, `social-media`, `listing-starter`). Add one **only** after checking what was delivered or James's approval. Leave `[]` when unknown; the piece then appears under All packages only.
- `capturedYear`: the actual shoot year, or `null`. Never inferred from Drive folders. Shown on Real Estate cards only when known.
- `published`: `false` keeps the piece out of production; review previews show it with a Needs approval tag.
- `sortPriority`: higher numbers show first in every view; ties keep file order. A newer year is not automatically better, so ordering is editorial.

Real Estate player mode is set in `content/site.json` → `galleries.realEstate.player` (`inline` or `lightbox`) while James decides. Review builds also accept `/real-estate?player=lightbox` or `?player=inline` to compare.

### Media ingest (new Drive footage)
Drive does not need to be organised by folder; files are mapped by their Drive file id.
1. **Discover:** paste Drive links into a text file, then `node scripts/ingest.mjs candidates links.txt` lists the ones not yet ingested.
2. **Add (unpublished):** `node scripts/ingest.mjs add <link> --id re-sagaponack-2026 --type video --title "Sagaponack listing film" --location Sagaponack --service video,drone`. This writes one record to `work.json` (`published: false`, `rights: pending`) and one source to `media-sources.json`.
3. **Tag:** `node scripts/ingest.mjs tag re-sagaponack-2026 --year 2026 --packages signature --priority 10` (use `--year unknown` or `--packages none` to clear).
4. **Preview:** deploy a preview. The build downloads and encodes the Drive original (`scripts/media.mjs`), and the piece appears with a Needs approval tag. Check title, orientation, playback and the package claim.
5. **Publish:** `node scripts/ingest.mjs publish re-sagaponack-2026 --rights-approved` refuses until rights, title, alt text (photos) and captions (videos with dialogue) are in place. `node scripts/ingest.mjs status` shows what every record still needs.

### Compare what's included
`/real-estate#compare` renders from the same `pricing.json` records as the package cards and calculator: `features` (inclusions, from the shared `features` vocabulary), `suits`, `tiers` and `max`. Views, rows and add-ons are listed under `compare`. Rows every option includes collapse into one summary line. Only terms HD Photo Hub confirms are shown; turnaround, usage and revision terms stay off until approved.

### Change a price
Prices mirror HD Photo Hub. Each item in `content/pricing.json` has its own `tiers` (`[minimum sq ft, price]`) and `max`; above `max` shows a custom quote. `npm test` checks every tier boundary. Production builds stay blocked until `releaseApproved` is `true`.

## Commands
```
npm run build             # review build (default)
npm run build:production  # production build; fails until pricing releaseApproved is true
npm run serve             # local server on :4173 with Vercel-like routing
npm test                  # pricing unit tests
npm run test:e2e          # 24 browser checks (Playwright + Chromium, see below)
```

Browser tests, one-time setup on a Mac with network access:

```
npm install --no-save playwright@1   # adds node_modules/playwright only
npx playwright install chromium
SKIP_MEDIA=1 node src/build.mjs && npm run test:e2e
```

The e2e suite serves `dist/` locally and stubs remote and `/v/` media with a small fixture, so it needs no Drive or Replit access.

Video media: `node scripts/media.mjs` (run by Vercel after the page build) downloads the Drive originals listed in
`content/media-sources.json`, encodes web MP4 + poster + short loops into `dist/v/`, and caches them in
`node_modules/.cache/pgk-media`. Set `SKIP_MEDIA=1` to skip it locally.

## Deploy
Vercel project **ps-website** (team Creator Studios) is linked to `photografikstudios/PS_website`. Every branch push creates a preview. `VERCEL_ENV=production` switches the build to production mode.

Environment variables (Vercel → Settings → Environment Variables):
- `RESEND_API_KEY`: turns on email delivery of the Start a Project form to info@photografikstudios.com. Without it the form opens a pre-filled email instead.
- `INQUIRY_FROM` (optional): sender address on a domain verified in Resend, e.g. `Photografik Website <website@photografikstudios.com>`.
- `INQUIRY_TO` (optional): defaults to `info@photografikstudios.com`.

## Analytics events
Pushed to `window.dataLayer` (ready for GA4 / GTM once a tag is approved): `book_click` (never counted as a booking), `pricing_size_band`, `pricing_tab`, `gallery_filter`, `video_play`, `video_complete`, `inquiry_submit`, `form_error`, `project_click`, `call_click`, `partnership_click`, `retainer_click`, `creator_click`, `custom_quote_click`, `compare_tab`, `compare_select`, `compare_nav`, `lightbox_open`, `gallery_load_more`, `gallery_view_more`. No personal data is included.

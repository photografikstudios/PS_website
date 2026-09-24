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

### Change a price
Edit the number in `content/pricing.json`. Band edges are inclusive (`min`–`max`). `npm test` checks the table shape and the published boundaries.

## Commands
```
npm run build             # review build (default)
npm run build:production  # production build; fails while packages are unapproved
npm run serve             # local server on :4173 with Vercel-like routing
npm test                  # pricing unit tests
npm run test:e2e          # browser tests (needs Playwright + Chromium installed)
```

## Deploy
Vercel project **ps-website** (team Creator Studios) is linked to `photografikstudios/PS_website`. Every branch push creates a preview. `VERCEL_ENV=production` switches the build to production mode.

Environment variables (Vercel → Settings → Environment Variables):
- `RESEND_API_KEY`: turns on email delivery of the Start a Project form to info@photografikstudios.com. Without it the form opens a pre-filled email instead.
- `INQUIRY_FROM` (optional): sender address on a domain verified in Resend, e.g. `Photografik Website <website@photografikstudios.com>`.
- `INQUIRY_TO` (optional): defaults to `info@photografikstudios.com`.

## Analytics events
Pushed to `window.dataLayer` (ready for GA4 / GTM once a tag is approved): `book_click` (never counted as a booking), `pricing_size_band`, `pricing_tab`, `gallery_filter`, `video_play`, `video_complete`, `inquiry_submit`, `form_error`, `project_click`, `call_click`, `partnership_click`, `retainer_click`, `creator_click`, `custom_quote_click`. No personal data is included.

# Photografik Studios — day-one readiness corrections

Date: October 25, 2026. Owner request: fix SEO/AEO, links and client-facing readiness; About deferred. Implementation is on `redesign/2027-preview`, based on `864c4d1`. Production/main remains `d043fa206ca504bdbeb5f4af16a5db2edd9f7bbd`. This report is not launch authorization.

## Readiness decision

**Not ready for public launch yet, even excluding About.** The main unresolved conversion issue is real inquiry delivery. The application is configured for Resend, but the deployed project has no Resend key/sender configuration. The other concrete content gate is five speech-video records whose caption/replacement checks remain unfinished. Supplied-media permission is approved by James and is not an open question.

The implementation and automated checks below can be reviewed now. They do not prove a received email, a completed paid booking, or a physical iPhone/VoiceOver acceptance test.

## Corrections made

1. **Search and answer-engine foundations.** Added a consistent ProfessionalService/WebSite/WebPage graph, service descriptions and breadcrumbs across applicable pages; preserved BlogPosting and article breadcrumbs. FAQ schema uses the same visible approved answers, without invented ratings, results, prices or opening hours. Corrected Creator page metadata and the 404 title/noindex behavior. Existing answer-first Field Notes, canonical URLs, image descriptions, sitemap and preview noindex stay intact. No ranking or AI-citation guarantee is made. Google says the normal search fundamentals apply to AI features: https://developers.google.com/search/docs/appearance/ai-features.
2. **Old links and backlinks.** Checked the current live sitemap's 40 URLs against routes/redirects. Added eight missing mappings and completed content-based article consolidation. Permanent redirects now point to appropriate live content. The misleading old `/policies` route contains shoot-preparation advice and therefore goes to the preparation article; `/terms-conditions` goes to Terms. Original article claims about sales/CTR were not copied into approved new content. Redirect decisions are recorded as Codex implementation under James's correction instruction, not fabricated separate owner approvals.
3. **Related businesses.** Added a direct public Creator Studios website link to Photografik's Creator page, keeping Square booking separate. Added the reciprocal Photografik footer link to `jckeen/creator-studios`, preview branch `redesign/media-first-creator-site`, commit `77da4e0`. Its READY preview is https://creator-studios-ou22ovyag-creator-studios1.vercel.app/ (`dpl_FpWtnvNsCxxpBQ1HrBBNs1LutV2F`, target null). The live Creator Squarespace site has not been modified; its backlink will appear when that separately approved site revision is launched.
4. **Inquiry honesty and recovery.** A 200 HTML/login page or `{ok:false}` no longer counts as successful delivery. Added a 12-second provider timeout and an 18-second browser timeout. Errors keep the full brief, offer an explicitly unsent email draft, permit retry, and do not emit `inquiry_submit`. Real sender configuration and receipt remain required.
5. **Production media visibility.** Reconciled the owner-selected Home film and two selected Creator records with production visibility; unrelated hidden library records stay hidden. The identical Home film, posters and loop now use `waterfront-residence-cinematic-film`, with all catalog/Page Media/source/pin references migrated together. The original Drive source remains. Binary fingerprints are unchanged. The Home soundtrack's automated full-length check detected no speech; this is recorded as automated evidence. Three films with visually verified embedded captions are identified as burned-in, so the build does not falsely require a separate duplicate track. No other caption approval flags were changed.
6. **Client-facing polish and accessibility.** Reserved dimensions for Home quick-tile photos, improved the contrast of size qualifications on dark pricing cards using existing colors, made video/project accessible names include their visible labels, and retained existing neutral summaries on public Commercial project pages when longer review copy is held. Removed raw address-like titles from six hidden import records without publishing them.
7. **Playback.** Fixed cancellation being mistaken for an audio-policy refusal, which could restart a film after scrolling away. Added a once-per-frame check for active videos to cover fast scrolls that enter and leave between IntersectionObserver samples. Actual MP4 reproduction and the test fixture were checked separately.
8. **Regression maintenance.** Updated older tests to the owner's current saved media/curation and the neutral Home-film name. Kept draft defaults, deletion protection, rights checks, hidden records, undo, caption validation, production address checks and launch gates. No prices, approved legal text, page architecture or global design were changed.

## Evidence

- **91/91 unit tests**, **78/78 browser regressions**, **32/32 CMS widget checks**, with no widget page errors. Widget checks use the existing lightweight Decap stand-in; this is not a newly completed authenticated editor publication.
- Build: 37 review pages and 36 pages under local production visibility. The special local inspection build cannot run on Vercel/CI and does not remove launch gates.
- Media: 400/400 web-ready files, 50/50 card posters and 23/23 referenced legacy assets matched pinned hashes. No new video encode was substituted.
- All 36 production-view HTML pages: unique titles, one H1, descriptions, canonical URLs, image alt attributes/dimensions, local destinations and anchors checked. Live-sitemap URL coverage: 40/40 mapped or retained. No production-visible street-address leak found.
- Real-media browser audit: 12 key routes at desktop Chromium 1440px and mobile WebKit 390px; HTTP 200, no page errors, no horizontal overflow or failed visible-image decoding. The initial pricing contrast failure was corrected and rechecked separately with zero detected axe violations. Logs distinguish original findings from the final pricing recheck.
- Creator: full `pnpm validate` passed, including formatting, lint, typecheck, publish checks, unit tests, build, internal-link check and **109 browser tests** (one intentionally skipped). This verifies the backlink change without adding property media to Creator's portfolio.
- Slow-mobile local lab: 390px, 4x CPU slowdown, 1.6 Mbps/150ms latency. LCP: Home 2.388s; Real Estate 2.232s; Architecture 1.992s; Commercial 2.396s; Creator 1.680s. CLS 0–0.003. These are individual lab samples; no field Core Web Vitals or INP claim is made.
- HD Photo Hub order entry loaded with property fields, provider choice and contact sections. Square loaded the studio service catalog and Hamptons podcast service detail/options. No order, appointment, payment or real inquiry was submitted.
- Screenshots and machine-readable checks: [evidence folder](readiness-2026-10-25/).

## Five customer walks

| Customer task | Verified result | Remaining limit |
| --- | --- | --- |
| Listing agent, 2,800 sq ft | Size calculator, package comparison and boundary logic; Book a Shoot reaches HDPH | No paid booking submitted; no promise that package/size transfers |
| Ongoing agent content | Agent/Listing Engine comparison and preselected project-brief route | Real inquiry delivery not configured |
| Architect/builder | Client board, project media, filters, video/photo paths and discovery-call CTA to inquiry | Receipt and four new caption tracks still need final checks |
| Brand/agency | Commercial scope, varied project grid, film-before-photo project galleries and inquiry paths | Receipt not verified |
| Phone gallery visitor | Filter combinations, reset/empty states, vertical/horizontal players, lightbox Escape/focus, offscreen pause and reduced motion | Physical iPhone/Safari and screen-reader acceptance not repeated in this pass |

## Remaining work in order

### 1. Connect and prove inquiry delivery — launch blocker

James must choose the destination already requested in chat: Resend email to `info@photografikstudios.com`, or the existing HubSpot account. For Resend, configure the verified sender and secret in Vercel (never Git). For HubSpot, implement a server-side adapter and map the full project brief to an approved form. Then send one clearly labelled test only after James authorizes it, verify the complete message/record in the destination, and test an error again. Present client success only after the receiving service accepts it. Marking the provider configured is not inbox receipt.

### 2. Finish five caption/replacement records — technical content gate

| Record | Required correction |
| --- | --- |
| `evolution-unlimited-landscape-project-overview` | Proof/timing check its VTT, especially the opening project/location and plant names |
| `evolution-unlimited-landscape-walkthrough` | Proof/timing check its VTT, including plant names |
| `nitelite-landscapes-lighting-reel` | Proof its short spoken introduction and location |
| `nitelite-landscapes-landscape-lighting-film` | Proof the introduction, business/person names and location |
| `cs-noah-knows-short` | Resolve the older replacement flag and verify caption coverage for the cut that will ship; existing embedded captions were sampled, not certified for every spoken word |

The four new caption files exist and the films play. An independent automated transcript check was completed, but it disagrees on proper nouns; it is not a human proofread. Existing caption/replacement gates remain active. This does not request media rights or client permission again.

### 3. Final client-use acceptance and controlled release

- Check the finished preview on a real iPhone/Safari and a keyboard/screen-reader pass, particularly mute/unmute, captions, modal controls and inquiry errors. Desktop Chromium/mobile WebKit checks are complete; actual assistive-technology acceptance is not claimed.
- Obtain James's separate public-launch authorization. Then enable the existing release flag in a reviewed change, deploy the intended production revision and verify the live domain, HTTPS, robots/indexability, canonical URLs, all redirects, the received test inquiry and GA4 events. Preserve the former deployment for rollback.
- Submit the final canonical sitemap to Search Console and inspect key URLs after cutover. Search Console indexing/backlink coverage and real-user performance are post-launch evidence; known old URLs are protected now. No DNS, production alias, production environment or `main` was changed in this task.

## Ten-criterion review

| Criterion | Status | Evidence/limit |
| --- | --- | --- |
| Immediate clarity | Pass | Existing service/location opening and visible actions preserved at desktop/mobile |
| Premium execution | Pass | Loaded real-media captures; existing visual system retained |
| Obvious paths | Pass | Navigation, service routes and booking destinations verified |
| Useful answers | Pass | Existing approved service/Field Notes copy; consistent answer/schema pairing |
| Trustworthy pricing | Pass | Approved figures unchanged; size/boundary/invalid-input tests pass |
| Frictionless action | Blocked | Real inquiry delivery and receipt not configured/verified |
| Findable work | Pass | Gallery interactions and current owner selection preserved |
| Effortless media | Needs work | Playback repaired; five caption/replacement checks remain |
| Inclusive mobile use | Needs work | Automated checks pass; captions and actual assistive-tech acceptance outstanding |
| Fast, reliable, findable | Needs work | Routes/SEO/lab performance pass; final Safari/cutover verification remains |

**6 Pass / 3 Needs work / 1 Blocked. This is not 10/10 or a production approval.** About is excluded from requested completion; its content was not rewritten.

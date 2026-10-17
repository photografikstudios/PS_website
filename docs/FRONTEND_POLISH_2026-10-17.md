# Targeted front-end polish — October 17, 2026

Base: `1d4cf73f0ffdd2351349c492b80c998bcfa8660d`, `redesign/2027-preview`. Preserve the owner's latest Home selection and all approved text/prices. Preview only; no production change.

## Changes

- Moved the complete existing homepage client proof block immediately after the hero, before quick booking tiles. Quote, attribution and link are unchanged.
- Kept the owner-selected School Lane hero film. Added a house-focused still at **69 seconds** of the existing web-ready film, plus a 640×720 center crop. Hero-only overrides leave gallery posters, the film and its visibility unchanged. Phone layout gives the property an opening area above the existing copy; pause/reduced-motion stills remain.
- Agent Content uses a silent 9-second derivative from **20–29 seconds** of the existing rights-approved `jb-andreassi.mp4` on-camera expertise film. It places the portrait at the right over blurred fill from the same footage. The original and burned-in captions remain intact. Desktop copy and the phone crop leave the face visible. This is a new excerpt from approved media, not new client work.
- Removed the repeated four-card package explanation block on Real Estate. Kept the inclusion comparison, calculator, booking links and dedicated Pricing page.
- Starting prices on Home, comparison and Pricing now show the item's actual first size band, such as “up to 2,500 sq ft.” Entering a size removes the starting qualification; clearing it restores it. No price data changed.
- Added intrinsic image dimensions from actual files. Architecture/Home/Real Estate thumbnails remain lazy and retry their full approved still if a thumbnail fails; unrecoverable stills keep an accessible open action.
- Added a readable video failure state and Retry video action for inline players and lightboxes. Existing controls, caption settings, filter behavior and one-at-a-time playback remain.
- Production banner handling and all approval gates are preserved.

## Verified

- `npm test`: **82/82**.
- `npm run test:dashboard`: **27/27**, no page errors.
- `npm run test:e2e`: **73/75**. Passing includes every size boundary, 2,800 sq ft, invalid/reset states, all internal links, core accessibility checks, 360px overflow, menus, Home filters/lightbox, RE portrait/landscape inline video, Architecture filters/poster fallback/video retry, Field Notes reading/TOC/schema, Terms/Licensing structure and crosslinks, and review status. Most media is replaced by deterministic fixtures in this suite; it is not evidence that the actual films played.
- Actual IAB playback separately verified: Architecture Yankee Barn film advances at 1280×720, unmuted with controls and playsinline; phone photo lightbox Next/Previous/Escape returns focus; all three lightbox targets measure 44×44px.
- Actual 390px phone and 1440px desktop hero composition inspected using real posters. A paused/reduced-motion still is distinct from playback.
- Deployed contact form tested with clearly marked TEST-only details: required errors work, submit reaches the honest unsent email fallback, details retained for editing. **Server delivery and receipt are not working/verified.** No fallback email was sent.
- HDPH order path opens the property/service/photographer/account/order form. No order was placed and checkout was not completed.
- Square studio path reaches service choice, October calendar and actual October 19 time options. No appointment was reserved; temporary service selection removed.
- Local `PRODUCTION_VISIBILITY_CHECK=1 node src/build.mjs`: 30 public pages; no Review version/review-bar/needs-approval markup.
- Real `npm run build:production`: correctly refused by unchanged `releaseApproved:false`. The visibility check is a local test output, never a deployable release.
- `npm run check:media`: **370/370 pinned files, 40/40 card posters**.

## Remaining failures and decisions

1. Two e2e failures identify the same existing content issue: owner-added titles containing **464 Montauk Hwy** and **26 Sunset Ave** appear in page markup, against the earlier no-address direction. The polish does not rewrite these titles. Confirm public client/display titles before launch.
2. School Lane is selected as Home hero but still **Hidden** in Films. Preview shows it; production visibility omits it. Confirm visibility/caption readiness before launch; do not silently publish the film.
3. Inquiry sender configuration, a successful delivered test and inbox receipt/reply-to still need completion.
4. Physical iPhone Safari toolbar behavior and VoiceOver are not established by responsive Chromium testing. No claim of WCAG certification or field Core Web Vitals.
5. Production approval, remaining replacement podcast/caption decisions and production indexing/domain checks remain separate. No 10/10 or launch-ready claim.

Tests adjusted only where the owner changed legitimate expectations: new Home hero ID/poster, proof position, removal of duplicate package cards, existing extra Agent clip, unpublished films excluded from required public portfolios. The caption fixture now reads the active cue without an immediate seek that raced its cue update. The old no-address checks remain failing and visible.

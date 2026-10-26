# Visitor guidance and campaign links

Implemented on `redesign/2027-preview`, October 26, 2026. Production release remains a separate owner decision.

## Visitor experience

- **Find the right service** is an optional chooser. It routes to existing listing, architecture, commercial, agent content, studio, agency and inquiry pages. No email gate, automatic redirect or new paid service.
- One automatic, dismissible card per tab visit. It can appear after 12 seconds when the hero has scrolled away, or on a desktop mouse exit toward the top after 30 seconds and some scrolling. It never blocks closing the tab. Mobile uses the same compact card after scrolling; no mobile exit detection.
- No prompt during a user-started film, an unmuted ambient film, an open menu/dialog, inquiry entry, at the footer, or after a booking handoff/submission. Manual chooser remains available on marketing pages. Contact, legal, review, 404 and CMS pages have no automatic prompt.
- Dismissal is retained in session storage, expiring after 30 minutes without a recorded visit/action. If storage is unavailable, automatic cards are disabled and the manual chooser still works.
- The chooser uses native dialog semantics, trapped keyboard focus, Escape/Close, focus restoration and no animated entrance. Both 390px and 320px layouts are covered.

## Luxury Media banner

The existing approved pricing data identifies Luxury Media as **Most Popular**. No pricing records were edited.

For homes up to **2,500 sq ft**:

| Matching purchase | Approved price |
| --- | ---: |
| Photography + floor plan | $450 |
| Drone photography add-on | $275 |
| Cinematic video + reel | $1,325 |
| Separate total | $2,050 |
| Luxury Media | $1,970 |
| Bundle saving | **$80** |

The banner says **“Save $80 by bundling.”** It names Luxury Media, displays $1,970 and the size qualification, and offers the full comparison in a disclosure. “See Luxury Media” leads to the existing package. The amount is recalculated from the shared price table when square footage is entered; e.g. 2,501–3,500 sq ft saves $85. It never assumes a universal $80 saving.

Savings appear only when all four records are approved, deliverables match, the size is within every comparison record, and the saving is positive. Photography + floor plan ends at 12,500 sq ft, so larger homes receive a value message with no numerical savings claim. Over 30,000 sq ft goes to the custom listing inquiry. No coupon, urgency, invented sales result or changed checkout price.

Other banners describe actual media uses: architecture portfolios/proposals, commercial websites/social/sales, agent expertise, studio conversations and agency production support.

## Campaign links

Use the **preview origin** with these paths to test now. Use the approved production origin only after the site is launched. Existing social profiles, ads and Creator Studios pages were not edited as part of this change.

| Campaign | Path |
| --- | --- |
| Instagram listing media | `/real-estate?intent=listing&utm_source=instagram&utm_campaign=listing-media` |
| Builder/architecture work | `/architecture-design?intent=architecture&utm_source=instagram&utm_campaign=finished-projects` |
| Commercial referral | `/commercial?intent=commercial&utm_source=referral&utm_campaign=brand-production` |
| Agent content | `/agent-content?intent=agent&utm_source=instagram&utm_campaign=agent-content` |
| Creator Studios referral | `/creator-studios?intent=studio&utm_source=creator-studios&utm_campaign=studio-referral` |
| General homepage campaign | `/?intent=listing&utm_source=google&utm_campaign=listing-media` |

A social source alone does not imply a visitor's profession or service need. Explicit intent and the service page guide recommendations. A visitor's chooser selection takes precedence on general pages; deliberate navigation to another service takes precedence there. Creator Studios referrers can suggest studio sessions, but never force a redirect. Existing HD Photo Hub and Square links remain intact; no unverified package or date handoff is claimed.

## Inquiry context and measurement

- Retains the service interest, coarse source, safe campaign slug, entry path and last service/project path with the inquiry and its unsent email fallback.
- Does not replace “How did you find us?” or other visitor answers. An explicit inquiry type and any change the visitor makes to it take precedence.
- No full referrer URL, search term, click ID, email address or phone number is added to attribution. Server validates the new fields independently.
- Existing analytics receives `guidance_view`, `guidance_dismiss`, `guidance_action`, `service_chooser_open`, `service_intent_selected`, `service_route_click`, `guidance_booking_handoff` and `guidance_conversion`.
- Booking handoff is a **click**, not a confirmed appointment. Inquiry conversion is emitted only after `/api/inquiry` returns a successful acceptance. Failed requests and unsent drafts do not count as conversions.
- Preview analytics retains the existing debug-only behavior. No new analytics provider or subscription.

## Verification and limits

Local results: **95/95 unit tests**, **8/8 guidance browser scenarios** (including a WCAG A/AA scan of the open chooser), and **78/78 existing site browser checks** with the test-only mute setting described below. No test skips. Desktop and 390px/320px layouts verified.

Commands:

```sh
npm run build
# ffmpeg must be on PATH for the four import tests and the caption fixture.
npm test
npm run test:guidance
# This host stalls unmuted media even with guidance disabled. Optional test-only mute:
E2E_MUTE_AUDIO=1 npm run test:e2e
```

The inline-player regression checks for an **open** dialog, allowing the new closed service chooser to exist without treating it as a video lightbox. The optional `E2E_MUTE_AUDIO` flag changes only the test player's mute state; production playback code is unchanged.

Live inquiry receipt remains an existing launch gate: delivery credentials are not configured. The accepted and failed inquiry paths are verified with a mocked endpoint; no real customer email, booking or production publication is performed by these tests.

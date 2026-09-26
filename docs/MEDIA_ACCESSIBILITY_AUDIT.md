# Media accessibility audit, September 26, 2026

## Captions and transcripts (WCAG 1.2.1, 1.2.2)

There are 23 approved, published video records. Their `dialogue` flag comes from the catalog; the audio notes come from checks in the browser pane on the review deployment.

| Clip | Where | Length | Speech | Captions now | Needed |
|---|---|---|---|---|---|
| `revivaluxe-film` | Commercial, RevivaLuxe case study | 33 s | Yes | None | Captions (VTT) and a transcript |
| `cs-jm2-architecture` | Creator Studios | 87 s | Yes | None | Captions and a transcript |
| `cs-noah-knows-short` | Creator Studios | 86 s | Yes | None | Captions and a transcript |
| `cs-tick` | Creator Studios | 47 s | Yes | None | Captions and a transcript |
| `agent-on-camera` | Agent Content | 15 s | Yes | None | Captions |
| `agent-market-insight`, `agent-expertise` | Agent Content | 15 s, 32 s | Yes | Burned in | Check the burned-in text is complete; a transcript is optional |
| `cs-demo-reel` | Creator Studios hero (muted loop) and clips | 36 s | **No: music only** (James, Sep 26) | n/a | None. `dialogue:false`; the muted hero loop keeps its poster, pause control and reduced-motion still |
| 16 Real Estate, Architecture and Commercial films | various | | No (music only, `dialogue:false`) | n/a | None (1.2.2 does not apply to music-only video; the titles describe the content) |

**Why the captions were not written in this pass.** Accurate captions need the audio transcribed. The files sit in Drive and on the Vercel deployment, and neither this workspace nor the Mac shell can reach them (egress policy). Speech-to-text models cannot be downloaded here either. I did not invent text. What I did:
- **Plumbing is ready.** `captions` takes a `.vtt` path and renders a `<track kind="captions" default>`. `"burned-in"` records burned-in text. `transcript` takes a page or file path and renders a "Read the transcript" link under the card.
- **Review builds** tag each uncaptioned clip that has speech, or unconfirmed speech, with Needs approval.
- **Production is gated.** The build now refuses to run if any published video with `dialogue` true or unconfirmed lacks captions. This is enforced in `src/build.mjs` and sits alongside the pricing gate.

**Next step:**
1. James, or an editor with the source projects, exports SRT/VTT for the five clips with speech. The demo reel is music only, per James on Sep 26, so it needs none.
2. Save each file as `static/captions/<id>.vtt` and set `captions` on the record.

## Ambient hero video (WCAG 2.2.2, 2.3.3)

These pages open with a hero loop: Home, Real Estate, Architecture, Commercial and Creator Studios. The behaviour lives in `src/assets/site.js`.

- **Muted and inline.** Each loop is `muted`, `playsinline`, `loop` and `aria-hidden`, and has a poster image. There is no sound and no caption need.
- **Plays only on screen.** An IntersectionObserver with a 120 px margin starts a loop only while it is on screen, pauses it when scrolled away or when the tab is hidden, and sets `preload` to `auto` only then.
- **Pause control.** A visible Pause video / Play video button (40×40, labelled, `aria-pressed`) pauses every ambient loop on the page. The choice is remembered.
- **Reduced motion.** When `prefers-reduced-motion: reduce` is set, loops never start and the poster shows. At 320 px with reduced motion, no ambient video played on any of the 11 primary pages (`tests/_reflow.mjs`).
- **Blocked autoplay.** If the browser refuses autoplay (NotAllowedError), the poster stays and the button offers Play. An AbortError from pausing during load is ignored. There is a regression test for this.

## Keyboard, reflow and automated WCAG 2.2 AA checks

`tests/_a11y.mjs` runs automated checks. axe-core cannot be installed here because the npm registry is blocked, so these are custom checks. It covers 15 pages at 1280 and 375 px with reduced motion:
- text contrast on solid backgrounds (1.4.3)
- target size of at least 24 px (2.5.8)
- names for controls and links (4.1.2, 2.4.4)
- image alt text (1.1.1)
- one h1 and no skipped heading levels (1.3.1)
- `lang` (3.1.1)
- a main landmark
- a visible focus indicator on focusable elements, including a ring drawn on the wrapper (2.4.7)

**Result on this revision: no issues.** Two audit rules were corrected so they no longer produce false positives:
- **Transparent header:** on photo or video hero pages the header's real backdrop is the hero, so it no longer fails contrast.
- **Hidden elements:** elements that are `aria-hidden` and `tabindex=-1`, such as duplicate card image links and the form honeypot, are now skipped.

**Reflow (1.4.10):** no horizontal scrolling at 320 px on 11 primary pages.

**Keyboard:** the e2e suite covers the menu (Escape), compare tabs (arrow keys), the gallery media filter and reset returning focus, Load More continuing from the first new item, the lightbox (Escape and focus return) and inline players.

## Not done (needs real devices)

- **Safari/WebKit and iOS VoiceOver.** Only Chromium is available here: WebKit cannot be downloaded, and there is no physical device. Evidence so far is Chromium at 375×812 with a mobile user agent.
- **A screen-reader pass** with VoiceOver or NVDA.
- **A manual check of text over hero media** (the scrim contrast).

A 30-minute pass on an iPhone is the remaining evidence needed. Check:
- hero autoplay and Pause;
- inline gallery playback, both orientations;
- the compare table;
- the Square link;
- VoiceOver reading of Real Estate and Creator Studios.

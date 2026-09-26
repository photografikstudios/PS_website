# Media accessibility audit, September 26, 2026

## Captions and transcripts (WCAG 1.2.1, 1.2.2), updated September 26 (third pass)

**How the text was produced.** The clips were transcribed by a speech model (faster-whisper `medium.en`) running in a Vercel Sandbox on the project's own team, reading the copies the review deployment serves. Only text came back. I then corrected punctuation, cue breaks and obvious mishearings against a second pass. Every caption file is therefore a **machine-transcribed draft**: the review build tags each one with Needs approval, and the production build refuses to run until James (or the editor) proofreads it and sets `"captionsStatus": "approved"`.

| Clip | Where | Speech | What is on the site now | Needs from James |
|---|---|---|---|---|
| `agent-on-camera` (Agent on camera: waterfront tour) | Agent Content | Yes, two lines | `captions/agent-on-camera.vtt` shown by default; transcript link | Proofread (15 words) |
| `cs-jm2-architecture` | Creator Studios, sessions page | Yes | Burned-in word-by-word captions in the video **and** a VTT track, off by default (CC control) so the text is not doubled; transcript link | Confirm the burned-in words cover all speech; proofread names: "Amneal Pharmaceuticals", "John", "the late Jack Hulka" |
| `cs-noah-knows-short` | Creator Studios sessions page | Yes | As above (burned-in + CC track + transcript) | Proofread "Fabuwood", "six- and seven-inch floors", and 0:12 to 0:16 "the minute you say carpet, that needs to be..." (unclear on the audio) |
| `cs-tick` | Creator Studios, sessions page | Yes | As above | Proofread |
| `revivaluxe-film` | RevivaLuxe project page | **Song, not dialogue.** A third pass (large-v3, no voice-activity filter) found a hip-hop track with vocals across the whole 33 s, with explicit language | `captions/revivaluxe-film.vtt` "[Hip-hop music with vocals]" shown by default, plus a text alternative. Lyrics are not reproduced | Confirm (1) a music description is enough, (2) the track is licensed for commercial web use, (3) explicit lyrics are acceptable on a client showcase. If not, swap the soundtrack |
| `agent-market-insight`, `agent-expertise` | Agent Content | Yes | Burned-in captions (already recorded); transcripts added | Optional: confirm the burned-in text matches the transcripts |
| `cs-demo-reel` | Creator hero | No, music only (James, Sep 26) | Nothing needed | None |
| 16 music-only films | Real Estate, Architecture, Commercial | No | Nothing needed | None |

**Third pass (September 26, evening).** Every clip was run again with the larger `large-v3` model, and I compared the result with the earlier text word by word.
- **Tick:** three phrases were corrected: "so for people listening", "just a few things" and "and that you can give it".
- **Noah Knows:** two phrases were corrected: "the minute you said carpet" and "put all the options out there".
- **Agent on camera:** the cue timing moved to 6.9 to 11.8 s, which is when the words are actually spoken.
- **JM2:** both models agree.
- **Unresolved, for James** (the two models agree on the sound, but the wording or spelling can't be settled without the source):
  - "Amneal" (large-v3 hears "Amniel"; Amneal Pharmaceuticals is the likely company);
  - "Jack Hulka";
  - "Fabuwood";
  - Noah Knows' "six and seven inch ... floors" and "that needs to be...".

These are still drafts. A model pass is not a human proofread, so the Needs approval tags stay on.

**Player behaviour.** Tracks are added in three places: server-rendered inline players, the Real Estate inline gallery player and the lightbox. Clips flagged `openCaptions` keep the track available but not `default`.

**Evidence on the review alias (revision 840fdc4):**
- All four VTT files return `200 text/vtt; charset=utf-8`; the transcripts return `text/plain; charset=utf-8`.
- In headless Chromium, every track parsed: agent-on-camera 2 cues, JM2 18, Noah Knows 26, Tick 11.
- In the Mac browser pane, JM2 played with the caption drawn on the frame at 0:03.7. Agent on camera showed its caption at about 0:12.
- `tests/e2e.mjs` (48 checks) asserts each track loads and parses, the default flag, the transcript link and the draft tag.

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

## Not done (needs real devices or James)

- **Caption proofreading and the RevivaLuxe vocal question** (table above).

- **Safari/WebKit and iOS VoiceOver.** Only Chromium is available here: WebKit cannot be downloaded, and there is no physical device. Evidence so far is Chromium at 375×812 with a mobile user agent.
- **A screen-reader pass** with VoiceOver or NVDA.
- **A manual check of text over hero media** (the scrim contrast).

A 30-minute pass on an iPhone is the remaining evidence needed. Check:
- hero autoplay and Pause;
- inline gallery playback, both orientations;
- the compare table;
- the Square link;
- VoiceOver reading of Real Estate and Creator Studios.

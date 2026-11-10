# Page Media display sizes

In `/admin` → **Page Media**, each single media placement and each item in a media list has **Display size**: Default, Small, Medium or Large. A size is stored on that placement as `size`, not on the shared media record. Library replacement and direct photo replacement keep the placement's size. Invalid values fail validation.

- Default retains the existing layout. Natural portrait media is capped at 360px wide to avoid a reel becoming taller than its section needs.
- Natural photos/films use a bounded frame. Portrait Small/Medium/Large caps are 224/320/420px, always limited to the available column.
- Cards retain their allocated space and heading alignment; sizing fits the media inside that frame.
- Backgrounds change the section's minimum height. Text remains in normal flow, so it cannot be clipped by a short selection. Backgrounds may crop but do not stretch.
- Direct photo uploads use their measured dimensions. Native aspect ratios, alt text, captions, links and playback controls remain intact.
- Automatic portfolio grids and project/article editors keep their existing responsive media behavior. These are separate from named Page Media placements.

James's About reel is set to Medium. Its media record is enabled for this placement and excluded from automatic galleries. Its supplied embedded captions are retained without a duplicate track.

Validation: `PLAYWRIGHT_CHANNEL=chrome node tests/media-sizing.mjs` checks all populated Page Media placements at 1440, 390 and 320px across all four sizes; `npm run test:dashboard` checks the editor and replacement persistence. `EVIDENCE_DIR` optionally saves About screenshots and the sizing report.

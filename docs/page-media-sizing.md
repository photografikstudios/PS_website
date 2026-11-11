# Page Media display sizes

In `/admin` → **Page Media**, each single media placement and each item in a media list has **Display size**: Default, Small, Medium or Large. A size is stored on that placement as `size`, not on the shared media record. Library replacement and direct photo replacement keep the placement's size. Invalid values fail validation.

- Default retains the existing layout. Natural portrait media is capped at 360px wide to avoid a reel becoming taller than its section needs.
- Natural photos/films use a bounded frame. Portrait Small/Medium/Large caps are 224/320/420px, always limited to the available column.
- Cards retain their allocated space and heading alignment; sizing fits the media inside that frame.
- Backgrounds change the section's minimum height. Text remains in normal flow, so it cannot be clipped by a short selection. Backgrounds may crop but do not stretch.
- Direct photo uploads use their measured dimensions. Native aspect ratios, alt text, captions, links and playback controls remain intact.
- Automatic portfolio grids and project/article editors keep their existing responsive media behavior. These are separate from named Page Media placements.

James's About reel is set to Medium. Its media record is enabled for this placement and excluded from automatic galleries. Its supplied embedded captions are retained without a duplicate track.

## Photo proportions and crop focus

Page Media now also offers **Image fit**:

- **Default:** normal portrait photos retain their native proportions; background and inset tiles keep their designed frames.
- **Whole image (no crop):** shows the entire photo. In a fixed background frame this can leave space around it.
- **Fill frame (crop):** fills the frame proportionally, without stretching.

Choose **Adjust crop focus**, then click or drag the marker onto the face or feature to keep visible. Horizontal/vertical sliders provide keyboard control and 1% adjustments. The full photo and a live crop preview remain visible; preview options include wide, landscape, square and portrait frames. A smaller vertical percentage retains more of the top. Size, fit and focus are saved on this placement. Replacing its source keeps size/fit and resets the old image's focal point.

Photos and project main images also have an **Adjust crop focus** editor for their shared/default focus, and project-uploaded photos have the same control. Existing named focus presets still work. CMS thumbnails and collection previews show the whole image, and the Photos preview includes an explicitly uncropped view. Real photo dimensions determine portrait/landscape on the site, including when a replacement inherits an old landscape value. Normal portrait gallery images use the actual ratio; deliberately fixed Home tiles can use crop focus.

`npm run test:media-focus` exercises all Page Media routes at desktop/phone widths across three fit modes, checks that explicit focal points override template defaults, and checks real portrait assets in natural and fixed frames. The CMS suite also checks pointer selection, keyboard refinement and saved coordinates. Original files, alt text, optional captions and owner selections are preserved.

Validation: `PLAYWRIGHT_CHANNEL=chrome node tests/media-sizing.mjs` checks all populated Page Media placements at 1440, 390 and 320px across all four sizes; `npm run test:dashboard` checks the editor and replacement persistence. `EVIDENCE_DIR` optionally saves About screenshots and the sizing report.

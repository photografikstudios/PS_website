# Automatic dashboard photo preparation

New JPG, PNG and WebP uploads are prepared in the browser before Decap receives the file. This applies to the shared photo/gallery/page controls (including client logos) and file selection or drag-and-drop in Decap's article-image Media window. Existing library choices and saved files are untouched.

- Long edge: maximum 2,400 px, proportional downscaling, no crop, stretch or upscaling.
- File size: strictly below 5,000,000 bytes, including files exactly at that limit.
- Small compliant photos: original bytes retained. Modified copies retain the source's displayed EXIF orientation and encode that upright orientation into the pixels.
- PNG stays lossless when it fits. Oversized PNG may become WebP with its transparency. Browsers without WebP encoding can use JPEG for opaque photos; unusually large transparent graphics may scale down further as PNG to preserve alpha and meet the byte limit.
- Original files on the computer are never changed. File extension and MIME type match the chosen encoder. Custom widgets retain title-based names and content fingerprints.
- Batches prepare sequentially, retain order and accept valid photos while explaining failures. Failed single-photo replacements retain the old placement. Save waits until preparation/persistence finishes.
- Videos keep the existing Google Drive flow; captions and PDFs are not resized. HEIC still needs a JPG export. Animated GIF/SVG is not rasterized by this feature.

Implementation: `src/admin/photo-upload.js`, shared `addFiles` and the stock Media-window capture in `src/admin/cms.js`. The helper loads before the controls, with the same versioned admin asset URLs. No third-party image-processing service or new dependency.

Checks: `npm run test:photo-upload` (real browser decoding/encoding; select Chrome with `PLAYWRIGHT_CHANNEL=chrome`), `npm run test:dashboard` (42 widget checks, including three upload workflows), and the unit suite. `PHOTO_BROWSER=webkit` runs the image checks in installed Playwright WebKit; this is engine testing, not physical iPhone/VoiceOver acceptance. Preserve production approval and unpublished Field Notes isolation.

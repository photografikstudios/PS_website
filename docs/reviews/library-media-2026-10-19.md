# Client media, library folders and image sizing — October 19, 2026

Preview branch only. Owner requested folders/tags and imported supplied client media. No production, pricing, legal, deployment-protection or approval-gate changes.

## Changes
- Optional Library folder and Tags on Photos, Films and Projects; folder grouping, whole-tag collection filters, and folder/tag/service/search filters in both photo and Page Media pickers. Hidden media remains available. Project photo batches inherit their project organization.
- 180 source photos: 174 new optimized WebP records and six exact canonical reuses. WebSize supplied variants preferred; 2500px maximum long side and 900px thumbnails, with accurate responsive width descriptors and descriptive filenames/alt text.
- 11 source videos: ten imported web films/posters/loops, one existing BPE full film reused. Four spoken films have machine-draft captions and remain unapproved for captions. Source originals remain in their Drive client folders; no moves or permission changes.
- Six new project pages; 12 client folders. BPE Ironworks, Rachel Lynch Pools, Evolution Unlimited and RevivaLuxe stay Commercial; other supplied builder/interior/architecture clients use Architecture & Design. Existing project routes, owner hero choices and Home selection preserved.
- Goldin opening title retained under James's explicit October 19 approval. Website title and filename remain descriptive and street-free; this exception does not approve other address-bearing legacy records.
- RevivaLuxe supplied 11 photos and no new video. Existing audio-rights hold preserved.
- Commercial's oversized service images fixed; base image height also corrected to prevent the same regression across project and service pages. Typography, palette, copy and aspect-ratio crops retained.

## Independent checks before preview deployment
- Unit suite: 84 pass, four skipped because ffmpeg was initially absent from PATH; all seven film-import tests then passed with ffmpeg, including all four skipped cases. All 88 distinct unit checks covered successfully.
- CMS widget browser harness: 30/30, no page errors.
- Full Chromium e2e: 75/77. Only the two existing hidden-address review warnings fail; tests remain intact. New sizing check covers ten routes at desktop and phone widths.
- Commercial: six Firefox/Chromium runs at 1440, 2048 and 390px; every image decoded and every service-card image retained 3:2 geometry.
- Media pins: 400/400; card posters: 50/50.
- Claude independently reviewed a separate worktree and supplied the minimal global-sizing, tag-boundary, privacy, validation and label-focus fixes. Those fixes were inspected and incorporated, with rights-pending records additionally excluded from production suggestions. His Session 74 prerequisite diagnostics are included in the e2e suite. Independent current-source results above supersede his older counts.

## Acceptance boundary
Local checks do not establish a deployed preview. The shared brief's LIBRARY_MEDIA_REVIEW_2026-10-19.md records exact deployment and live CMS/playback acceptance after release. Production remains unchanged and requires owner launch approval. Four new caption drafts require proofreading before production; prior launch limitations remain.

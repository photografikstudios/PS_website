# CMS usability audit — October 17, 2026

Baseline: a5aeb05403caa4464c73f31f68c5bce7f3e23427, redesign/2027-preview. Includes the owner's newer Film saves. Decap retained; no public-site redesign or production change.

## Already implemented — preserve

- Drive-only video intake, computer-video interception, file validation, import polling/retry and replacement freshness; playable preview and captions/burned-caption approval fields.
- One shared media library, section-specific Page Media thumbnails, single/list/gallery selections, ordering, automatic/custom modes and removals without library deletion.
- Project descriptions, gallery photos, current-form validation, held projects and review-only projects; unknown top-level fields kept hidden.
- Markdown Field Notes, draft isolation, SEO, media blocks, galleries, related service and CTA.
- Fresh where-used checks, protected deletion, typed confirmation, concurrent-write protection and Undo.
- GitHub OAuth with state cookie and origin-limited token handoff; Vercel protection; status.json plus authenticated branch/deployment comparison.

## Targeted gaps

- Flat forms obscure the five-step Film workflow. Sections can be reorganized without nesting/migrating stored fields.
- Published vs Shown/Hidden names conflict. A visibility request must not assert a completed deployment.
- sortPriority is descending gallery priority; order is ascending collection/project tie order. Preserve integers and expose friendly step/reset actions plus an optional exact value.
- Media `featured` is stored but is not used by the current gallery renderer. Field Notes `featured` is also stored, while the list sorts by date. Do not pretend these flags select Home items. Home → Selected work already has thumbnail selection/order; link to it rather than duplicating records.
- Published project category currently only has a warning even though its URL can depend on category. Lock previously shown projects to their saved category; moves need reviewed redirects.
- Testimonial `featured` is an optional integer: integer means shown on About, ascending order; missing means reserve. Present a toggle plus earlier/later controls on this same field. Keep exact quotes/approval untouched.
- Page Media lacks persistent page/section/device context in each control. The where-used panel already checks live saved data; add a direct item link rather than a second usage API.
- Some project/film state messages infer “shown” from a switch and any status file. Replace with requested visibility and separately verified deployment status.
- Admin access needs clear two-step sign-in and return guidance. No secrets, new scopes or protection changes.

## Verification required

Unit and widget suites; real Decap draft/import/error, Field Note edit/reopen/preview, Page Media selection/undo, deployment feedback; protected login behavior. Keep implementation, test stand-in, real editor and READY preview evidence distinct.

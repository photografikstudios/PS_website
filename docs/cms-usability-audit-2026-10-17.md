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

## Implemented pass

- Flat, named form sections and jump links; Film essentials first; original field names and hidden metadata retained.
- Show on site / Hidden draft controls. Film visibility request is refused before import readiness; the existing rights/caption/build gates remain.
- Gallery placement actions keep exact integer values and offer reset/Undo. Project list order explicitly uses the opposite direction.
- Featured designation is explicitly described as a retained flag, with a direct Home Selected work management link. Existing thumbnail/order control is reused.
- Previously shown project categories are locked in the current saved editor/build snapshot, with a reviewed redirect explanation.
- Testimonial display toggle and earlier/later actions use the same optional integer. No quotations or approvals changed.
- Page/section/required/device context, preview link, and fresh authenticated where-used lookup beside a selected Page Media item.
- Clearer Git-saved versus built versus website-confirmed feedback; immediate status check after Save; validation/saving state; import instructions no longer require GitHub Actions knowledge.
- Protected sign-in help at /admin/login.html, inline guidance, callback return link, and same-origin/same-opener token handshake. Vercel metadata confirms all_except_custom_domains protection and main production branch. No protection/permissions/secrets changed.

## Local gates

- Unit tests: 80/80 Pass; no failures, cancellations or skips.
- CMS widget browser stand-in: 25/25 Pass; no page errors. Includes existing import/retry, current-draft project checks, captions, checked delete/Undo, keyboard, phone layout plus ordering preservation, testimonial visibility, category lock and Film readiness.
- Review build: 31 pages Pass before adding the temporary article fixture.
- Test harness fixed to accept a component returning null, as React does; test fixtures isolated so phone footer checks do not obscure later desktop controls. Copy assertions updated to the intentionally reordered Drive field.
- Browser test runtime lives under /private/tmp; no dependency/runtime change committed.

Primary API reference: [Decap CMS event hooks](https://decapcms.org/docs/registering-events/). Real editor evidence and cleanup will be recorded separately; the stand-in is not a signed-in acceptance test.

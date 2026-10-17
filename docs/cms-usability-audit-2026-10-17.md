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
- Previously shown project categories are locked, and a hidden URL-category marker preserves the lock through hiding and reopening, with a reviewed redirect explanation.
- Testimonial display toggle and earlier/later actions use the same optional integer. No quotations or approvals changed.
- Page/section/required/device context, preview link, and fresh authenticated where-used lookup beside a selected Page Media item.
- Clearer Git-saved versus built versus website-confirmed feedback; immediate status check after Save; validation/saving state; import instructions no longer require GitHub Actions knowledge.
- Protected sign-in help at /admin/login.html, inline guidance, callback return link, and same-origin/same-opener token handshake. Vercel metadata confirms all_except_custom_domains protection and main production branch. No protection/permissions/secrets changed.

## Local gates

- Unit tests: 81/81 Pass; no failures, cancellations or skips.
- CMS widget browser stand-in: 26/26 Pass; no page errors. Includes existing import/retry, current-draft project checks, captions, checked delete/Undo, keyboard, phone layout plus ordering preservation, testimonial visibility, category lock and Film readiness.
- Review build: 31 pages Pass before adding the temporary article fixture.
- Test harness fixed to accept a component returning null, as React does; test fixtures isolated so phone footer checks do not obscure later desktop controls. Copy assertions updated to the intentionally reordered Drive field.
- Browser test runtime lives under /private/tmp; no dependency/runtime change committed.

Primary API reference: [Decap CMS event hooks](https://decapcms.org/docs/registering-events/). Real editor evidence and cleanup will be recorded separately; the stand-in is not a signed-in acceptance test.

## Signed-in editor acceptance (October 17)

All changes below were on the protected review alias/branch. No production change.

- **Film draft:** created `qa-cms-usability-film` through real Decap. Title, Drive link and category saved flat; no display-only `_section_*` keys were written. `published` remained false. A Drive folder link was rejected in the field. New Films now default their work type to Video & Film so that the essentials do not depend on a buried required selection.
- **Import/error/retry:** a deliberately nonexistent Drive file produced the real access-error explanation and Retry control in the same open form. Retry with the owner's previously approved JM2 source reached importing, then Ready/Reload in that same form. Reload loaded a 23.104-second film, readyState 4. Keyboard playback advanced 0.074 → 5.797 seconds with paused=false, then was paused. The QA film was never shown on site; caption approval was not fabricated.
- **Queue evidence:** the initial automatic run was delayed; a retry of the existing review workflow was initially rejected by automatic approval review because its scope could include other waiting films. A fresh inventory at head b551c321 proved the QA film was the only waiting/retry record, after which the retry was permitted. The automatic original request also subsequently appeared. No permissions/scopes/protection changed. UI wording no longer promises a start within one or two minutes, and an absent run is described as unconfirmed rather than definitely not started.
- **Field Notes:** real excerpt edit → Save → reload retained excerpt, Markdown body/media blocks, SEO, CTA and hidden metadata. The side-by-side preview showed “Draft, not published.” A preview-only publication request was saved; the switch explicitly did not claim completion. The deployed review article then rendered at its expected URL, and the CMS reported Website updated. The QA article was removed after the test.
- **Page Media:** Contact's empty optional intro slot → library thumbnail selection of existing `lauryn-lead` → Save → reload retained selection. Fresh usage included Contact plus existing Home/Real Estate/project references. Take off this page → Save restored the original empty Contact JSON, with no library media deletion.
- **Project URL:** real existing Lauryn project opened with a disabled Service page selector and reviewed-redirect explanation. Services delivered and disciplines remained separate.
- **Ordering:** real QA Film Move higher → Undo placement change restored its initial exact value. Widget checks separately cover ascending project order and testimonial off/on integer preservation.
- **Recovery:** QA article Delete → Deleted → Undo → Restored → reload retained the article. Shared hero image was explicitly protected. Final QA record deletion was then repeated for cleanup.
- **Access:** protected login guide opened under existing authorized access; Return to dashboard returned to Decap. Vercel protection metadata remains `all_except_custom_domains`; production branch remains main. A fresh login with Marie's own account was not performed, so her membership/access is not certified.

Proof images are in the shared brief at `_transfer/review/cms-usability-2026-10-17/`: field-note-draft.png, page-media-context.png, project-category-lock.png, film-import-error.png, film-ready-playing.png, undo-restored.png and article-preview-deployed.png.

## Scope and limits

- Home features use the existing single-library thumbnail picker/order. No duplicated media collection, new drag-and-drop global ordering system, or new meaning for legacy featured booleans was introduced; their optional old flag is retained under Advanced.
- Grouping uses named sections/jump links and existing flat data, not a nested data migration. Advanced fields stay mounted, preserving current draft state.
- Saved/published project categories are protected by the editor and a persistent hidden URL-category marker. Category moves still require a reviewed redirect; this is not a new server-side immutable URL-history database.
- Tests with a browser stand-in remain distinct from real Decap acceptance. Full physical-iPhone, VoiceOver, every guest's caption proofreading and Marie's separate fresh login are not certified by this pass.
- This work does not approve public launch, supply Resend credentials, change prices or automatically approve replacement clip placement.

### URL-history safeguard

A hidden `urlCategory` marker is now saved for a previously shown project (and when a new project first requests publication). Hiding, saving and reopening retains that marker; the category remains locked. A never-shown new draft stays editable. The preSave hook returns the complete Immutable data map with only this marker added, retaining unknown metadata. The widget regression exercises the hide/save/reopen case and verifies exact preservation of title and unrelated nested hidden metadata. Direct Git edits still require the reviewed developer path; no URL migration/redirect was performed.

## Final clean-content gates

- 81/81 unit tests, zero failed/cancelled/skipped (29.365 seconds).
- 26/26 CMS widget checks, zero page errors; includes hide/save/reopen URL lock and unrelated nested metadata preservation.
- 31-page REVIEW build; 368/368 web media and 40/40 card posters, zero problems.
- All QA records, their three generated files and manifest entries removed. Contact JSON and every content/static file are byte-identical to owner baseline a5aeb05403caa4464c73f31f68c5bce7f3e23427. All 20 owner Drive imports and the owner's later visibility/category saves in that baseline are preserved.
- No main push, production deployment, domain cutover, credential or protection change.

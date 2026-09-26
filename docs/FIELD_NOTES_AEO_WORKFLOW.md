# Field Notes: weekly AEO rewrite workflow

**Owner decision (James, Sep 25 2026):** the byline is **Photografik Studios**. Reuse the useful substance of the original blog posts, keep their URL mappings, and plan one rewritten, answer-first (AEO) article per week. Weekly drafting does **not** authorize automatic publication. Every article passes editorial review before it goes live.

## Source material

- `content/legacy-articles.json` lists the 18 original Squarespace posts, their old URLs and their status.
- `content/field-notes.json` holds the rewritten articles. Statuses: `source-needed`, then `draft` or `review` (review builds only, tagged "Draft for review", kept out of the sitemap), then `published`, which requires `approvedBy` and `datePublished`.

## Weekly cycle

| Day | Step | Who | Output |
|---|---|---|---|
| Mon | Pick next legacy post from the queue (highest search value first, never one already in progress) | Claude or Codex | Queue entry marked `in progress` in `legacy-articles.json` |
| Mon to Tue | Draft the rewrite: one real customer question as the title, a 2 to 3 sentence direct answer first, then short sections, a list where it helps, one approved `work.json` media item | Claude | `field-notes.json` entry with `status: "draft"` and `legacyUrls` set |
| Tue | Fact check against approved site copy, HD Photo Hub and James. Remove anything not sourced. No prices unless they are approved in `pricing.json` or `offers.json` | Codex | Review notes, `status: "review"` |
| Wed | Editorial review of the wording, facts, attribution, media rights and redirects | James | Approve, or return with changes |
| Thu | Publish only when approved: set `approvedBy`, `datePublished`; add a `vercel.json` 308 from each `legacyUrls` path; confirm the article appears in the sitemap and index | Claude, after approval | `status: "published"` |
| Fri | Check the live page, canonical, JSON-LD and the old URL redirect | Codex | Handoff line |

## Rules

1. Byline is always "Photografik Studios" (Organization in JSON-LD).
2. Keep the original post's useful substance. Rewrite for clarity; do not invent new claims, statistics, client names or results.
3. One primary question per article. The first paragraph answers it plainly.
4. Only rights-approved media from `work.json`.
5. Each legacy URL maps to exactly one article, with no redirect chains.
6. Nothing moves to `published` without `approvedBy`. The build enforces this.
7. If a week is missed, the queue simply waits. There is no automatic or scheduled publishing.

## Not yet in place

- A scheduled drafting task has not been created. It can be set up once James confirms the review day.
- The three current drafts remain in `review` until James approves them.

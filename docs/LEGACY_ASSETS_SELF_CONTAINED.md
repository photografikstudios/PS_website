# Legacy stills and clips: from Replit to a self-contained build

**Revision:** 840fdc4. **Review deployment:** dpl_J2ByEEzFDhHKNfPiJ5s3NMzE8xn8, on `ps-website-rust.vercel.app`.

## What changed

- **Pinned by size and SHA-256.** `content/legacy-assets.json` lists the 23 legacy files the site references: 19 stills and 4 clips, 18,045,107 bytes in all. Each has its exact size and SHA-256. The bytes were recorded from the review alias, which serves what earlier builds copied in. They were checked again, byte for byte, on the new alias: 23/23 identical.
- **Replit removed from the build.** `legacyOrigin` is deleted from `content/media-sources.json`. `scripts/media.mjs` no longer contacts Replit under any condition.
- **Build rules.**
  - A file committed under `static/` is used only if it matches its pin.
  - A review build may fall back to a *pinned bridge*: it downloads the same file from this project's own review alias and refuses any copy whose hash differs.
  - A production build (`SITE_MODE=production`) never uses the bridge. It fails if any pinned file is not committed.
- **`npm run check:legacy`** checks every referenced file for three things: it is present under `static/`, its size is right, and its SHA-256 is right. It also fails if any referenced file is not pinned.
- **`npm run fetch:legacy`** downloads the pinned files from the alias, verifies each one, and saves it under `static/`. It refuses a Replit origin.

## Evidence

**Cold build on Vercel.** In dpl_J2By, the build removed the 24 cached legacy files before running `media.mjs`. It then fetched all 23 through the pinned bridge, and all 23 passed the SHA-256 check. The log line reads: `legacy assets 0 committed, 23 via pinned review bridge, 0 failed`. There were no Replit requests.

**Loaded media on the alias.** Checked in headless Chromium across 26 pages, from a Vercel Sandbox:

| Viewport | Visible images loaded | Legacy responses | Errors | Replit requests | Horizontal overflow |
|---|---|---|---|---|---|
| Desktop, 1440 px | 120 of 120 | 13 | 0 | 0 | None |
| Phone, 375 px | 117 of 117 | 7 | 0 | 0 | None |

The four legacy clips load metadata at 720×1280 with no player error.

**Browser pane on the Mac.**
- Desktop: the Peterson & Ramlowtan page loaded the `peterson-hero` still.
- Phone, 375 px: on Architecture & Design, the logo, `yankee-card`, `peterson-card` and `peterson-gallery` all loaded (4 of 4).
- Screenshots are in `docs/screenshots/2026-09-26/`.

## The one remaining step (outside this Cowork session)

`check:legacy` reaches 0 when the 23 files are committed under `static/`. This Cowork session cannot do that:
- its network policy blocks vercel.app;
- the Mac's Cowork shell has no network;
- the Git proxy refuses a push to this repository (403).

Committing is a single command in the Mac's own Terminal, and it also pushes the branch once GitHub sign-in is done:

```
bash ~/Dev/photografik-cowork-brief/_transfer/finish-legacy-and-push.sh           # verify and commit only
bash ~/Dev/photografik-cowork-brief/_transfer/finish-legacy-and-push.sh --push    # also push redesign/2027-preview
```

The script works as follows:
1. It clones the newest bundle.
2. It downloads and SHA-verifies the 23 files.
3. It runs `check:legacy` (must print 0 problems) and `npm test`.
4. It commits `static/images` and `static/media`.
5. With `--push`, it pushes only `redesign/2027-preview` and confirms the remote SHA.

After that commit, a GitHub or Vercel build is self-contained, and production would accept it.

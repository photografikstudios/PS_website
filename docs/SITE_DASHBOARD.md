# Your site dashboard: a walkthrough

This is the guide for James and anyone he trusts to update the website. It covers the dashboard at **/admin** on the review site. It is built and tested on the review branch only. It is not on the live photografikstudios.com yet, and it needs the one-time sign-in setup at the end of this guide before anyone can log in.

## What you can change yourself

| Section | What it is for |
|---|---|
| **Projects** | Portfolio projects for every service: name, town, story, main image, photos with descriptions, films from the library, rights, order. |
| **Photos** | Every photo in the galleries. Fix a description, change the focus point, move it up or down, hide it, or replace the picture. |
| **Films** | Films already on the site. Change the title, description, project or order, or hide one. |
| **Page text** | The heading and intro at the top of the main pages. |
| **Testimonials** | Client reviews on About, which ones show and in what order, and the short version used on Home. |
| **FAQs** | The general Real Estate questions. |
| **Field Notes** | Articles. |

What stays with us on purpose: prices, legal policies, booking links, cancellation and licensing answers, and the page layout. Those go through review so a typo can never change a price or a policy.

## The three ideas that keep it safe

1. **Save** keeps your work. It does not make anything public by itself.
2. **Published** is the switch on each project, photo and article. Off means draft: it is saved, the preview shows it with a small "Draft, not published" note, and the live site, its galleries and the sitemap leave it out completely.
3. **The site checks your work before it goes live.** If something is missing on a published item, the update stops and the live site keeps running the previous version. The message tells you exactly what to fix.

The checks: rights marked Approved, a description (alt text) on every photo, no street address in names or towns, photos large enough for the layout (at least 1,200 px on the long side, 1,600 px or more recommended), required project text, files that actually exist, and short Home review versions that use the client's own words.

## Walkthrough 1: edit an existing Architecture & Design project

1. Open **/admin** and sign in.
2. Choose **Projects**, then **Yankee Barn Builders**.
3. Change what you need, for example the **Story / goal** paragraph.
4. Choose **Save**, then **Save now**.
5. Open the preview link (or wait a minute and refresh the review site). Only that project page changes.

## Walkthrough 2: add a new project with photos, as a draft

1. **Projects**, then **New Project**.
2. Fill in **Project name**, choose the **Service** (for example Architecture & Design), and add the **Town or area** (never a street address).
3. Add a **Short description** (one sentence for cards) and the **Story / goal** paragraph.
4. Under **Photos**, choose **Add photo**, then **Choose an image** and upload the file. Write the **Description** right away, for example "Kitchen with a marble island and brass pendant lights". Repeat for each photo. Drag to reorder.
5. Set **Rights to show this work** to Approved only when the owner or client has agreed, and note who approved it and when.
6. Leave **Published** off and choose **Save**.
7. Check the preview. The project has its own page with a Draft note. It does not appear on the live site, in galleries or in the sitemap.

Tips for photos: a web JPG or WebP, 2,000 to 2,400 px on the long side, under 5 MB. Name the file after the client or subject. The site makes the smaller sizes automatically.

## Walkthrough 3: publish it

1. Open the project again, switch **Published** on, and **Save**.
2. After the update finishes (usually a minute or two), the project appears on its service page, in the galleries and in the sitemap.

## Walkthrough 4: undo a change

* **Small mistake:** open the item, put it back, Save.
* **Take something down fast:** switch Published off and Save. It disappears from the live site on the next update.
* **Undo a whole bad update on the live site:** in Vercel, open the project, choose the previous good deployment, and use **Instant Rollback** (on the current Vercel plan it returns to the previous live version). The site goes back immediately while we fix the content.
* **Undo several changes at once:** ask us. Every Save is a separate, labeled change in the site history, so we can reverse exactly those changes. In our test, reversing an edit, a new draft and its publish rebuilt the site byte for byte the same as before.

## On your phone

The dashboard works at phone width: the form fills the screen and the side preview is hidden (use the preview link instead). Editing text and switching Published on or off is comfortable on a phone. Uploading and describing a batch of photos is easier on a laptop. Some of the dashboard's small icon buttons are below the size we would like for touch, so take care with the remove and reorder icons.

## Video

New films are not uploaded through the dashboard yet. Large original video files do not belong in the website's code, so adding a new film needs a video host decision (see the proposal: a hosted video service is recommended). Until then, send new films to us and they will appear in **Films**, where you can manage them.

## One-time setup before anyone can log in

These are owner decisions and accounts. Neither Claude nor Codex creates accounts or changes permissions.

1. **Sign-in:** create a GitHub OAuth App under the Photografik GitHub account and add its two keys to the Vercel project as `CMS_GITHUB_CLIENT_ID` and `CMS_GITHUB_CLIENT_SECRET`. No paid service is involved.
2. **Editors:** each person who edits needs a GitHub account with write access to the website repository.
3. **Who can publish:** today anyone with editor access can switch Published on. If you want Marie's changes to wait for your OK, we can turn on the dashboard's review workflow so every change becomes a draft with its own preview link that you approve.
4. **Video host:** choose an option from the proposal when you are ready to add films yourself.

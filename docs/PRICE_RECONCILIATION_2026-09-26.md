# Price and inclusion reconciliation, September 26, 2026

**Sources (read-only, nothing ordered or booked):**
- HD Photo Hub order page, `photografikstudios.hd.pics/order`. I read its product catalog (297 product rows, each with its sq ft minimum and maximum and its price) in the browser pane.
- The Long Island Creator Studios Square services page, including each service's options view.

**Website side:** `content/pricing.json` at this revision, `content/offers.json` for Creator Studios.

## 1. Residential prices (HD Photo Hub)

**Method.** 24 website records were compared automatically against HDPH:
- 4 packages, 7 size-based services (Cinematic Video and Cinematic Reel are compared separately), and 12 fixed items.
- Each size tier was checked at its lowest, middle and highest sq ft, giving **648 comparisons**.

**Result: every price the website shows matches the HDPH checkout price. There are no numeric differences.**

The only findings come from how HDPH defines its size bands. James confirmed these on Sep 25 as intended, so the website does not "correct" them. They are listed here so the release sign-off is explicit.

| Where | HD Photo Hub row | Effect at checkout | Website |
|---|---|---|---|
| All 4 packages at exactly 17,501, 18,501, 19,501 and 20,501 sq ft | Adjacent rows share the boundary (for example 16,501–17,501 and 17,501–18,501) | At those four exact sizes, two package prices are eligible | Uses the higher band from each boundary. **James: confirm which price HDPH charges at exactly those sizes** |
| Luxury Media 12,501 row | Maximum is 1,250,138 sq ft (other rows end at x,500) | Above 13,500 sq ft, the $3,865 Luxury row stays eligible alongside the correct band | Stops the $3,865 band at 13,500. **James: confirm HDPH shows only one Luxury price above 13,500** |
| Final band | Packages 20,501–25,500 and 25,501–30,000; services 20,501–25,000 and 25,001–30,000 | Matches | Mirrored exactly; above 30,000 sq ft is a custom quote |
| "(reg. $…)" amounts | HDPH shows a regular price next to each package price (for example Starter $720, reg. $800) | Customers see a discount | The website shows only the checkout price and does not advertise a discount. James can decide whether to show "reg." prices |
| A second catalog group, category 78376 | Duplicate Photography, Floor Plan and Cinematic rows. Some prices differ, for example Cinematic Reel from $550, and Cinematic Video at 5,501–6,500 is $695 | Not in the standard product list; probably a special-tier or member group | Not used. **James: confirm what this group is and whether any public customer sees it** |

## 2. Inclusions (HD Photo Hub)

| Package | HDPH items | Website features | Match |
|---|---|---|---|
| Listing Starter | Photography, Drone Photography, Floor Plans | interior, exterior, drone, floor plan | Yes |
| Social Media | Photography, Drone Photography, Cinematic Reel | interior, exterior, drone, reel | Yes |
| Luxury Media | Photography, Drone Photography, Floor Plans, Cinematic Reel, Cinematic Video | plus floor plan, film, reel | Yes |
| Signature | adds Day to Night, Agent On Camera, Twilight/Dusk | plus day-to-night, agent, twilight | Yes |

**Engines:** HDPH lists Listing and Agent Engine at $1,000 as an add-on and $1,200 on their own, and the Full Engine at $1,900 add-on and $2,200 on its own. The website matches all of these.

**Copy difference to review:**
- HDPH describes the **Listing Engine** as "a cinematic, agent-on-camera social video plus 3–4 additional short-form videos focused on the home, location, and lifestyle".
- The website says "three to four short videos about the property and its launch cycle (Coming Soon, Just Listed, Under Contract, Just Sold) or a nearby lifestyle feature".
- The website does not mention the agent-on-camera video, and the launch-cycle examples are not in HDPH.
- **James: choose which wording is the commitment.** I have not changed it.

## 3. Creator Studios (Square)

| Website says | Square options view | Status |
|---|---|---|
| Podcast session, 1.5 hours, $250, full episode without editing | **"Podcast Recording, Brooklyn" → One Podcast Recording: $250, 1 hr 30 min** (live cut, raw audio, up to 3 guests) | Matches |
| (same) | **"Podcast Recording, Hamptons" → One Podcast Recording: "Price varies", 1 hr 30 min.** Two recordings $500, three $750, four $950 | **Gap:** the single Hamptons-set session has no fixed price on Square |
| Studio content session, 2 hours, $500, without editing | "General Studio Content Session" → 2 Hours: $500 (raw files included, engineer, 2-hour minimum). Extra hour $250 | Matches |
| Category list | Both main services show "Price varies" at the category level | As expected; the website does not claim Square shows the price there |

**Wording the website does not use and should not add:**
- Square also calls the sets "Hamptons" and "Brooklyn".
- The website says "Bohemia" (the Square page title is "Bohemia, NY") and does not name the sets.
- **James: confirm whether "Brooklyn" is a set name or a separate location**, so the page never implies the wrong place.

Editing, ISO files and clip packages are Square add-ons. The website says they are quoted separately and does not list them, per James.

## Release gate

`releaseApproved` stays `false`. Before it can flip, James needs to answer the four questions above:
1. the boundary sizes;
2. the Luxury 12,501 row;
3. category 78376;
4. the Listing Engine wording.

He also needs to decide whether the Hamptons single-session price on Square should be fixed at $250.

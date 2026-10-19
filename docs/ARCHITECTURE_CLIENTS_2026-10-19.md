# Architecture & Design client board — October 19, 2026

## Owner request and scope

Add a scrolling “Clients we work with” board and more relevant photography from the October 19 upload. Eight Architecture & Design clients from that upload are represented. BPE Ironworks, Rachel Lynch Pools, Evolution and RevivaLuxe remain Commercial only. Existing project URLs, gallery filters, hero choices, rights, captions, published states and release gates are retained. No production deployment is authorized by this change.

## Official logo sources

Retrieved October 19, 2026. Assets are stored locally under `static/images/clients/`; the page does not hotlink third-party images. The image bytes are retained, with extensions matching their actual formats. CSS fits the marks and gives white marks a dark presentation on the ivory strip. No client logos were invented.

| Client | Official source | Asset / treatment |
| --- | --- | --- |
| Barba Architectural Design | https://www.bardarch.com/ | Official header mark: https://images.squarespace-cdn.com/content/v1/6942be2c87c7182ce2da29b6/3de996fc-2d3e-4cc0-867a-2521a73297ac/Logo.png?format=1500w — 1500 × 443 WebP |
| Bellard Brothers | https://www.bellardbrothers.com/ | Higher-resolution hero crest, rather than its 126 × 78 header copy: https://static.wixstatic.com/media/d79df2_1cdcb2e2a2fe4432a296015b3b84ebd8~mv2.png/v1/crop/x_0,y_3,w_7269,h_5824/fill/w_701,h_562,fp_0.50_0.50,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/BB-white-trans-white-bigger-BB.png — 701 × 562 PNG |
| Goldin Luxury | https://www.goldinluxuryhomes.com/ | **Owner approved plain “Goldin Luxury” text for now.** Its current header image says Goldbarn Homes, so that image is not used. |
| Delrose Design Group / Kerry Delrose | https://delrosedesigngroup.com/ and https://delrosedesigngroup.com/about/ | Official static mark discovered in its public media catalog: https://delrosedesigngroup.com/wp-content/uploads/2025/03/ddg-logo.png — 190 × 72 PNG. Prefer this to the 163-frame animated header GIF; display at no more than its native width. |
| Laura Grollmus Design | https://lauragrollmusdesign.com/ | Original header image: https://img1.wsimg.com/isteam/ip/9171a080-cc33-4c1f-ab0d-a0a0a01fbc1e/blob-c27dca7.png — 2560 × 2000 JPEG; the site CDN returns JPEG despite the URL extension. |
| Long Island Building Systems | https://www.libuildingsystems.com/ | Official header mark: https://www.libuildingsystems.com/images/Long_Island_Building_Logo.png — 488 × 140 PNG |
| Nite-Lite Landscape Lighting | https://nitelitelandscapelighting.com/ | Official header mark: https://nitelitelandscapelighting.com/wp-content/uploads/2024/02/Nite-Lite_Logotipo-vF_NT-2.png — 1401 × 349 WebP. This is the Long Island firm, not the separate NiteLites franchise. |
| Peterson & Ramlowtan | https://www.petersonramlowtan.com/ | The official header is the text wordmark “P&R Builders.” Retained as text with Peterson & Ramlowtan below it; no separate logo artwork found on the official site. |

## Visitor-visible changes

- Client board directly below the Architecture & Design hero. Eight businesses, six supplied official logo files and two text treatments. No numerical claims or client results added.
- Gentle 70-second loop, Pause/Resume button, pause on hover, stationary keyboard/touch browsing, Home/End access, and one accessible copy of the list. Reduced motion and JavaScript-disabled browsers get manual scrolling. Offscreen animation pauses.
- Ten existing approved library photos assigned through the existing Page Media configuration; media records are not duplicated or reclassified.

| Page Media field | Photo |
| --- | --- |
| introPhoto | Laura Grollmus waterfront living room, 01 |
| storyPhoto | Kerry Delrose double-height living room, 13 |
| detailPhoto | Peterson & Ramlowtan staircase and dining room, 37 |
| designDetail 1 | Bellard white cabinet and brass-handle detail, 19 |
| designDetail 2 | Goldin stair landing and pendant lights, 07 |
| designDetail 3 | Kerry Delrose powder-room vanity, 05 |
| designDetail 4 | Bellard kitchen range and hood, 22 |
| stepTell | Barba waterfront front elevation, 06 |
| stepPlan | Long Island Building Systems fire-station facade, 02 |
| stepProduce | Nite-Lite illuminated residence, 01 |

The Design in detail caption now identifies the pictured clients, replacing its obsolete reference to Bridgehampton real-estate photos. Hero, interview still and closing photo remain the existing selections.

## Verification

- Review build: 37 pages. Existing gallery unit tests: 8/8 pass. `git diff --check` clean.
- Real browser: desktop 1440px and phone 390px; no horizontal page overflow. All six logo files decode. Eight list entries exposed once to accessibility; duplicate loop is inert and aria-hidden.
- Pause/Resume changes actual animation state. Reduced-motion emulation stops animation and hides the repeated copy/control. Keyboard End reaches the last client, including at phone width; Home returns to the start.
- All ten new photos load at phone width with positive image geometry. Design detail uses two columns on phone.
- Photo filter → Bellard photo lightbox → Close works. Video filter → Yankee Barn film reaches readyState 4, unpaused, with advancing playback.
- Final deployed acceptance and deployment ID are recorded in the shared `WHAT_WAS_CHANGED.md` once verified; local checks alone do not mean the preview is updated.

## Related Commercial change

Commit `7ce5b63d2b94b5e9ef14c19838ec672e86afed91` renders films before photos in separate Commercial gallery groups, preserving the order within each group and the existing hero. All 7 Commercial project page card sets and heroes preserved; 12 non-Commercial project bodies byte-identical. Six desktop/phone geometry checks pass. Its protected preview reached READY and Evolution's six gallery videos were verified above its three gallery photos, with actual playback. Pricing, legal text, production and launch approval remain unchanged.

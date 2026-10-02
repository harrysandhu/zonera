# Zonera hero plate — adversarial prompt debate

Founder brief (transcribed): *"This is the vibe… if you look at this entire image you should feel good. It's not a focus on self storage — the facility is just in there… even though it's isometric… [levitation retracted]… Studio Ghibli watercolor anime-ish, same structure as Dray, a view of a self-storage facility, isometric, nice scenery, with 'zonera' in the middle, big type."*

References: `refs/ref-1-lake-meadow` (anime lake + meadow, bright), `refs/ref-2-lake-panorama` (60% cerulean sky, calm), `refs/ref-3-sf-dolores-golden` (SF from Dolores Park, golden hour photo).

Process: v1 draft (`hero-v1.txt`) → independent art-director critique (round 1) → counter-critique (round 2) → hardened prompts → generation → review.

## Round 1 — critic's attacks on v1 (summary)

| # | Attack | Fix adopted |
|---|---|---|
| 1 | "Isometric" pulls game-asset dioramas, floating slabs, tilt-shift — i.e. the rejected levitation | Describe a camera: hillside viewpoint, ~30° down, long lens; "isometric" once, as a simile, after ground + horizon exist |
| 2 | A level 16:9 camera cannot see a facility from 30° above *and* a horizon | Allow stacked painter's perspective; pin ridgeline (y 42% centre / 33% edges) and the facility box |
| 3 | Model prior for self-storage = Public Storage orange, asphalt, chain-link, barbed wire, pylon sign | Name the one signifier that survives styling — continuous ribbed roll-up doors on long low rows — and restyle everything else; ban the clichés by name |
| 4 | GPT Image writes text wherever reality has it (signs, unit numbers, hex codes as swatches) | Wordmark only in the sky; ban signs/numbers/markings; label colour notes "never drawn"; no brand name in the clean plate |
| 5 | From 30° above, roofs dominate and doors vanish; ref-1's in-front sun shades the door walls | Three rows, wide aisles, door sides face lower-left into upper-left sun; value separation per surface; one open door with boxes |
| 6 | v1 asks for ~11 things in ~6% of the frame → mush or an inflated hero facility | Box the facility; cut solar panels, separate office, lakeside road, far town, van |
| 7 | Wordmark size/colour unspecified; white type turns into cloud | Centred x 29–71%, y 17–29%; deep indigo ink (~6:1 on mid-sky vs ~2.4:1 for white) |
| 8 | Spelling drift, script/Didone drift, effects | "exactly six lowercase letters", serif described by structure, flat ink; production uses the vector wordmark |
| 9 | Noon sky + apricot horizon = grey-brown band; GPT amber cast | One lighting statement: late-morning, upper-left, neutral white balance |
| 10 | "Apricot" doors snap to chain orange (~25° hue) | Matte peach-coral #E59A84; "orange doors" in the avoid list |
| 11 | Ref-3 is a photo → photographic rendering + skyline/palms leak | Attach refs 1–2 only; transcribe ref-3's useful ideas (looking down from a park hill, pale curving paths) into words |
| 12 | Van + person inflate to toy scale / read as a moving company | Cut van; keep one open door with boxes and one tiny figure "shorter than the doorway" |
| 13 | "Watercolor and gouache" averages into mud; naming the studio brings clichés + reputational risk | Opaque poster-colour gouache, anime-background technique described, no studio name |
| 14 | Ref-1 foreground (huge grass, bench) eats the bottom third | Foreground y 80–100%, corners only, centre low |
| 15 | Two text prompts never give the same scene; hero gets centre-cropped on phones | One 16:9 master, centre-weighted; generate the clean plate (B) first, then the identity plate (A) as an edit of B |

## Round 2 — counter-critique (what we did not accept as-is)

1. **Ref-3 is the founder's own choice.** Dropping it silently overrides the brief. Resolution: it is not blended into the main plate (the critic is right about photo leak and orange skies), but it gets its **own warm variant** — refs 1+2+3 with a guarded role line and a late-afternoon light statement. The founder picks.
2. **6.4% of frame is too timid for a web hero** where UI will sit over parts of the painting. Facility box widened to **x 31–69%, y 57–79%** — still scenery, still inside a 9:16 centre crop (x 34–66% holds the core rows).
3. **"Watercolor" is in the founder's words.** Keep one medium (opaque gouache) for objects, but allow *watercolor-like graded washes in the sky and distance only* — that is exactly how the references read and does not mix materials on the same surface.
4. **Slogan.** Critic offered "Just ask." / "Make room." / "Rest easy." We take **"Just ask."** — it is the product thesis (agent-native, zero learning curve) in two words, and it is true for the storefront customer and the operator alike.

## Hardened prompts (as sent)

See `hero-B-cool.txt`, `hero-B-warm.txt`, `hero-A-edit.txt`. Generation log: `generations.json`.

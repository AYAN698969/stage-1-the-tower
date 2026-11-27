# Tower Game — 3D Asset Acquisition Report

**Date:** 2026-11-27 · **Game:** STAGE 1 – THE TOWER (Three.js, 10-storey residential building, Bangladesh)
**Delivered:** 36 models · **Missing:** 2 · **Total size:** 1,790 KB (1.75 MB) · **All files:** `assets/*.glb`
**Manifest:** [`assets/manifest.json`](../assets/manifest.json)

## Summary

All 20 must-have furniture models, all 7 street/exterior models, all 3 characters,
and 3 of 4 nice-to-haves were delivered. The two hard-to-find Bangladeshi street
items could not be found as free models: the **rickshaw** has no free CC0/CC-BY model
anywhere searched (a bicycle is delivered as its alternative — the user decided
2026-11-27 to KEEP the bicycle stand-in). The **CNG/tuk-tuk** was first delivered
as a golf-cart stand-in, but on 2026-11-27 the user decided to swap it for a real
**auto-rickshaw model from 3DAssets.dev** (CC0, teal body) — see the CNG swap note
below. The **tea stall** is delivered as a Quaternius market-stall set (closest free match).

Every model is **CC0 or CC-BY only**, downloaded from Poly Pizza
(`poly.pizza`, which mirrors Quaternius/Kenney/Google Poly models with their
licences shown per model) — except the auto-rickshaw, which comes from
3DAssets.dev (CC0). No Sketchfab, Mixamo, marketplace, AI-generated,
ripped, or unattributed models were used. Source URL + licence + author for every
model are in `assets/manifest.json` and in the table below.

## Delivered models

| Logical name | Model title | Source | Licence | Author | Triangles | Size | Animations |
|---|---|---|---|---|---|---|---|
| armchair | Armchair | Poly Pizza | CC0 | CreativeTrio | 162 | 7.1 KB | – |
| bed_double | Bed Double | Poly Pizza | CC0 | Kenney | 364 | 8.3 KB | – |
| bench | Bench | Poly Pizza | CC0 | Quaternius | 376 | 7.0 KB | – |
| bicycle † | Bicycle | Poly Pizza | **CC-BY** | Poly by Google | 1,714 | 59.7 KB | – |
| bin | Trashcan | Poly Pizza | CC0 | Quaternius | 739 | 9.0 KB | – |
| bookshelf | Bookcase Open | Poly Pizza | CC0 | Kenney | 640 | 4.6 KB | – |
| car | Car | Poly Pizza | CC0 | Quaternius | 3,124 | 40.9 KB | – |
| ceiling_fan | Ceiling Fan | Poly Pizza | CC0 | Kenney | 428 | 6.7 KB | – |
| chair_office | Office Chair | Poly Pizza | CC0 | Quaternius | 2,116 | 31.1 KB | – |
| cng_tuktuk | Auto Rickshaw (Indian Bazaar Street and Temple) | 3DAssets.dev | CC0 | @3dassets | 596 | 19.0 KB | roll |
| coffee_table | Coffee Table | Poly Pizza | CC0 | Kenney | 248 | 3.2 KB | – |
| desk | Desk | Poly Pizza | CC0 | Quaternius | 2,640 | 28.4 KB | – |
| dining_chair | Chair | Poly Pizza | CC0 | Quaternius | 216 | 4.8 KB | – |
| dining_table | Table | Poly Pizza | CC0 | Quaternius | 1,500 | 18.9 KB | – |
| fridge | Kitchen Fridge | Poly Pizza | CC0 | Quaternius | 404 | 6.6 KB | – |
| girl ★ | Animated Woman | Poly Pizza | CC0 | Quaternius | 1,908 | 349.2 KB | 10 (Idle, Walking, Running, Jump, Sitting, PickUp, Punch, Death…) |
| kitchen_counter | Kitchen Cabinet | Poly Pizza | CC0 | Kenney | 188 | 5.5 KB | – |
| man ★ | Man | Poly Pizza | CC0 | Quaternius | 1,852 | 147.8 KB | 11 (Idle, Walk, Run, Jump, Sitting, Clapping, Punch, Death…) |
| mirror | Bathroom Mirror | Poly Pizza | CC0 | Kenney | 144 | 5.0 KB | – |
| motorbike | Motorcycle | Poly Pizza | **CC-BY** | Poly by Google | 6,361 | 34.5 KB | – |
| nightstand | Night Stand | Poly Pizza | CC0 | Quaternius | 2,016 | 25.6 KB | – |
| plant | Potted Plant | Poly Pizza | CC0 | Kenney | 104 | 5.2 KB | – |
| rug | Rug | Poly Pizza | CC0 | Quaternius | 108 | 4.1 KB | – |
| sink | Kitchen Sink | Poly Pizza | CC0 | Kenney | 596 | 6.2 KB | – |
| sofa | Sofa | Poly Pizza | CC0 | Quaternius | 3,886 | 53.1 KB | – |
| stove | Kitchen Stove Electric | Poly Pizza | CC0 | Kenney | 676 | 6.0 KB | – |
| streetlight | Streetlight | Poly Pizza | CC0 | Quaternius | 526 | 8.0 KB | – |
| table_lamp | Table Lamp | Poly Pizza | CC0 | Quaternius | 244 | 5.2 KB | – |
| tea_stall ‡ | Market Stalls Compact | Poly Pizza | CC0 | Quaternius | 11,467 | 142.7 KB | – |
| toilet_wc | Toilet | Poly Pizza | CC0 | Quaternius | 402 | 5.4 KB | – |
| tree_leafy | Tree | Poly Pizza | CC0 | Quaternius | 5,766 | 226.6 KB | – |
| tree_palm | Palm Tree | Poly Pizza | CC0 | Quaternius | 3,134 | 28.4 KB | – |
| tv | Television Vintage | Poly Pizza | CC0 | Kenney | 560 | 8.4 KB | – |
| tv_stand | Cabinet Television | Poly Pizza | CC0 | Kenney | 308 | 3.5 KB | – |
| wardrobe | Closet | Poly Pizza | CC0 | Quaternius | 2,988 | 37.7 KB | – |
| woman ★ | Animated Woman | Poly Pizza | CC0 | Quaternius | 6,424 | 426.9 KB | 24 (Idle, Walk, Run, Wave, Interact, Punch, Kick, Roll, Death…) |

† `bicycle` is an extra model, delivered as the alternative for the missing rickshaw.
‡ Stand-in (see "Stand-ins" below).
★ Animated characters (GLB, skinned, animations preserved through optimisation).
Full animation lists are in `assets/manifest.json`.

Per-model Poly Pizza page URLs are in `assets/manifest.json` (`url` field) and in
`_source/meta/<name>.json` (with the direct `static.poly.pizza` download URL).

## Missing

| Name | Why | Alternative |
|---|---|---|
| **rickshaw** | No free CC0/CC-BY rickshaw model exists on Poly Pizza (21 search results, none a rickshaw). Quaternius/Kenney have no rickshaw either. Sketchfab was not used — downloads there require a login, which the task forbids bypassing. | `bicycle.glb` delivered (Poly by Google, CC-BY, 1,714 tris) — a cycle-rickshaw is a bicycle with a passenger seat; the game can use the bicycle as the street vehicle, or a rickshaw must be modelled. |
| **shoe_rack** | No free CC0/CC-BY shoe rack/shelf model found on Poly Pizza (searched: shoe rack, shoe cabinet, shoe shelf, shoe storage, shoe stand, shoe organizer, shoes, rack). | Generic rack: "Coat Rack" (Kenney) or "Storage Shelf" exist on Poly Pizza but are not shoe-specific, so nothing was delivered for this slot. A small shelf/bookcase model can be reused in-game. |

## CNG swap (2026-11-27)

- **cng_tuktuk → real auto-rickshaw** (`assets/auto_rickshaw.glb`, "Auto Rickshaw
  (Indian Bazaar Street and Temple)" by @3dassets, CC0, from 3DAssets.dev).
  The golf-cart stand-in (`assets/cng_tuktuk.glb`, Michael Ruddy, CC-BY) was
  removed from `assets/` and the manifest/CREDITS updated. The auto-rickshaw is
  teal, not CNG-green. Raw file: `_source/auto_rickshaw_3dassets.glb` (28 KB,
  596 tris, 11 meshes, 1 "roll" animation); optimised with the same gltf-transform
  command to 19.0 KB (meshopt + WebP, animation kept). Licence record:
  `_source/meta/auto_rickshaw_3dassets.json`. Provenance note: how 3DAssets.dev
  produces its models is unconfirmed — the swap was made on the user's explicit
  2026-11-27 decision, and the source/licence are recorded as shown on the asset page.

## Stand-ins (delivered, but not the exact requested item)

- **tea_stall → market stalls** (`assets/tea_stall.glb`, "Market Stalls Compact" by
  Quaternius, CC0). No free tea-stall model exists; this is a compact set of market
  stalls, usable as a street tea/food stall. Note it is a *set* of stalls in one file.

## Character notes

- **girl** (player character) and **woman** are both titled "Animated Woman" by
  Quaternius on Poly Pizza, but they are **two different models** (different model
  IDs/rigs): `girl` is the lighter Armature-rig version
  (`poly.pizza/m/9kF7eTDbhO`, 1,908 tris, 10 animations incl. Idle/Walking/Running);
  `woman` is the CharacterArmature-rig version
  (`poly.pizza/m/qJ2gsTUBHL`, 6,424 tris, 24 animations incl. Idle/Walk/Run/Wave).
- **man** (`poly.pizza/m/HMnuH5geEG`, 1,852 tris, 11 animations incl. Idle/Walk/Run).
- All three characters are within the ≤12k triangle and ≤3 MB limits, and their
  animations survived optimisation (verified by re-reading the output GLBs).

## Optimisation — NOT skipped

Tool: **gltf-transform CLI 4.5.1** (`npm install -g @gltf-transform/cli`, installed
successfully for this task). Every model was optimised:

```
gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false
```

- Characters (`girl`, `man`, `woman`) additionally used
  `--flatten false --join false --instance false --palette false` so the skinning
  rig and animations stay intact.
- Result: raw downloads totalled ~11.2 MB → optimised total **1.79 MB**.
  Largest file is `woman.glb` (427 KB); every file is ≤5 MB (target ≤1.5 MB met
  except the three characters, which are ≤3 MB as allowed).
- Textures were recompressed to WebP and capped at 1024 px.
- Triangle budgets: furniture ≤5k (max: sofa 3,886), small props ≤1.5k,
  trees ≤6k (leafy tree simplified 6,265 → 5,766), vehicles ≤15k, characters ≤12k —
  **all met except `tea_stall` (11,467 tris)**. The market-stall mesh resisted
  meshoptimizer simplification (split vertices limit it; weld + ratio 0.35 +
  error 0.02 only reached 11,467 from 14,164). It is a street prop set, so it sits
  inside the 15k vehicle-class budget; per stall it is ~3–4k tris. Kept as-is
  rather than destroying its shape with aggressive decimation.

## Sources tried, not used

- **Kenney.nl direct downloads** — the site returns 403 to plain requests and its
  download buttons are JS-driven; the same CC0 Kenney models were instead taken
  from Poly Pizza, where they are hosted with the same licence.
- **Quaternius.com direct downloads** — pack downloads there go through Google
  Drive folders / itch.io; the same CC0 Quaternius models were taken individually
  from Poly Pizza instead.
- **Poly Haven** — models API works and is CC0, but the models are high-poly
  realistic scans (e.g. armchair 5,626 tris with 4K textures) and were not needed.
- **Sketchfab** — only CC0/CC-BY models would qualify, but Sketchfab requires a
  login to download; per the task rules that path was not pursued.
- **Poly Pizza API** (`api.poly.pizza`) — search requires an API key; the public
  website search/model pages were used instead (no login, no key, no paywall).

## Files

- Optimised models: `~/workspace/tower-game/assets/*.glb` (36 files) + `assets/manifest.json`
- Raw downloads: `~/workspace/tower-game/_source/*.glb` (38 files, incl. the two
  rejected first picks `rickshaw.glb` = "Rover" and `shoe_rack.glb` = "Towel Rack",
  which are **not** in `assets/` and must not be used)
- Per-model metadata: `~/workspace/tower-game/_source/meta/*.json`
- Acquisition scripts (re-runnable): `_source/acquire_polypizza.py`,
  `_source/fixup_polypizza.py`, `_source/fixup2.py`, `_source/optimise.py`

## Attribution required (CC-BY models)

Two delivered models are CC-BY (not CC0) and need attribution in the game credits:

- **Bicycle** — "Bicycle" by Poly by Google — https://poly.pizza/m/19VoUuA2pcN
- **Motorcycle** — "Motorcycle" by Poly by Google — https://poly.pizza/m/dse64pqMKAR

Suggested credit line: *"Bicycle and Motorcycle by Poly by Google (CC-BY), via Poly Pizza."* All other models are CC0 (public domain,
no attribution required, though crediting Quaternius/Kenney is good practice).

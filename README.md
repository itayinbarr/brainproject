# Brain Atlas - an interactive 3D brain you can learn from

**A 3D map of the brain that's easy to learn from and explore - built to share knowledge,
freely and openly.**

I'm a visual learner. I've always wished for a tool that would let me actually *see* the
brain and explore it myself - at a deeper level than just its main components. Every brain
map I could find online stopped at the **major regions**: a dozen labelled blobs. That's
not enough to truly study from. So I built the thing I wanted to exist.

Spin it, search it, fade the cortex away, isolate a single structure, peel the brain apart
system by system. This one resolves **344 individually‑named structures** - every cortical
gyrus and sulcus, the deep grey nuclei, the ventricles, brainstem, cerebellum, the dural
venous sinuses, the circle of Willis, the dural reflections, and the cranial nerves - each
a separate, labelled, toggleable mesh, with its full anatomical (TA2) path and a
plain‑language description. The granularity neuroscientists and students actually need, in
something anyone can open in a browser.

Nothing here is fabricated - every mesh is a real, TA2‑named anatomical structure, derived
from open anatomical data (full credits & licence [below](#attribution--licence)).

![Brain Atlas - interactive 3D brain](docs/default.png)

## Live demo

- **GitHub Pages:** https://itayinbarr.github.io/brainproject/
- **Firebase Hosting:** https://brain-atlas-7f5fe.web.app

Runs entirely in the browser - no install, works on desktop and mobile (pinch‑free zoom
buttons on touch). Optional, consent‑gated Google Analytics; declining keeps it anonymous
and cookieless.

---

## Run locally

No build step - the JSX is transpiled in the browser. Just serve the `brain-atlas/` folder
over HTTP (the model is fetched at runtime, so opening the file directly won't work):

```bash
cd brain-atlas
python3 -m http.server 8861
# open http://localhost:8861/
```

Three.js + React load from a CDN; the Draco decoder, the model, the data and the UI are all
local. Any static host works - this is what's deployed to the live demos above.

---

## Using it

### Navigation
| Action | Control |
|---|---|
| **Rotate** | left‑drag |
| **Pan / drift** | hold **⌘ Cmd** (or **Ctrl**) and left‑drag, or right‑drag |
| **Zoom** | scroll / pinch |
| **Select a structure** | click it in the 3D view |
| **Hover** | structures glow faintly under the cursor |

When you select something, its full name (with side) and its **TA2 anatomical path**
(e.g. `Telencephalon › Frontal lobe › Precentral gyrus`) appear at the bottom‑left.

### Side panel
- **Search** - type any part of a name, region, or system (`calcarine`, `thalamus`,
  `M2`, `sinus`, `vagus`). The list filters live and non‑matching meshes fade back in 3D.
- **Layers** - structures are grouped into 11 colour‑coded subsystems. Toggle a whole
  subsystem with its header checkbox, or expand it and toggle individual structures.
- **Isolate** - show *only* the current search matches (or the current selection), and
  frame the camera on them.
- **Reset** - restore the default view.
- **Focus** - fly the camera to the current selection.
- **Cortex opacity** - fade the cortical surface to see the deep structures, vessels and
  ventricles inside.
- **Left / Right / Both** - show one hemisphere or both (median/unpaired structures always
  stay visible).

### Colour key
| Subsystem | Colour | | Subsystem | Colour |
|---|---|---|---|---|
| Cortex (gyri/sulci/lobes) | cream | | Ventricular system | cyan |
| White matter & commissures | off‑white | | Arteries (circle of Willis) | red |
| Deep grey / basal ganglia | violet | | Dural venous sinuses & veins | blue |
| Diencephalon | light blue | | Cranial nerves (I–XII) | yellow |
| Brainstem | gold | | Meninges & dura (falx, tentorium) | purple |
| Cerebellum | orange | | | |

---

## What's actually in the model (detail & coverage)

This is **illustration‑/gross‑anatomy grade**, derived from MRI segmentation. Here's an
honest account of what is and isn't resolved, because it matters for how you use it.

### Fully present and individually named ✅
- **Every cortical gyrus and sulcus**, left and right, including the specific ones you'd
  want: **calcarine sulcus, supramarginal gyrus, angular gyrus, cuneus, precuneus,
  lingual gyrus, fusiform (occipitotemporal) gyri**, central/precentral/postcentral,
  parieto‑occipital, etc. (128 cortical meshes.)
- **Basal ganglia as separate masses**: **caudate nucleus, putamen, globus pallidus,
  lentiform nucleus**, plus **amygdaloid body**, claustrum‑level structures.
- **Diencephalon**: **thalamus** (whole), hypothalamus, **medial & lateral geniculate
  bodies**, mamillary bodies, optic chiasm/tract, habenula, **red nucleus**.
- **Ventricles**: lateral (L/R), third, fourth, septum pellucidum, choroid plexus.
- **White matter / commissures**: **corpus callosum, fornix, anterior & hippocampal
  commissures, internal capsule, stria terminalis/medullaris**.
- **Brainstem** (midbrain/pons/medulla) with colliculi, peduncles, many cranial‑nerve
  nuclei.
- **Cerebellum** with vermis/hemispheres/peduncles.
- **Vasculature**: the **circle of Willis** in full - anterior/middle/posterior cerebral
  arteries (incl. M1/M2/M3 segments), anterior/posterior communicating, basilar,
  vertebral, internal carotid, the cerebellar arteries - and the **dural venous sinuses**:
  superior/inferior sagittal, straight, transverse, sigmoid, cavernous, petrosal,
  confluence, etc.
- **Meninges**: falx cerebri, tentorium cerebelli (the dural reflections).
- **Cranial nerves I–XII** and major branches, as tube meshes.

### Not modelled - and why ❌
These exist only as empty placeholder names in the source taxonomy; **no geometry was
ever built** for them, because they're below the resolution of the MRI‑based segmentation
Z‑Anatomy/BodyParts3D was made from:

- **Nucleus accumbens / ventral striatum**
- **VTA (ventral tegmental area)**
- **Substantia nigra**
- **Subthalamic nucleus**
- **Individual thalamic nuclei** (pulvinar, MD, VA/VL, VPL/VPM, …) - only the whole
  thalamus + geniculate bodies are present.
- **Amygdala subnuclei** (basolateral, central, …) - only the whole amygdaloid body.

**If you need those**, they require a different *kind* of source: a histology/high‑field
MRI subcortical atlas rather than a surface‑mesh model. Good open options to register in
later are the **DISTAL / AHEAD** atlases (which do contain SN, STN, VTA, accumbens) and
**FreeSurfer `fsaverage` + a thalamic‑nuclei or amygdala‑subnuclei parcellation** for the
small grey nuclei. Those ship as voxel/NIfTI volumes, so they'd need marching‑cubes
surface extraction and alignment to this brain - a separate task, but a clean upgrade path.
The model here deliberately doesn't fake geometry it doesn't have.

---

## Project layout

```
brainmodel/
├── README.md                     ← this file
├── LICENSE                       ← Apache 2.0 (code) + CC BY‑SA 4.0 (3D assets)
├── firebase.json                 ← Firebase Hosting config (serves brain-atlas/)
├── .github/workflows/
│   └── deploy-pages.yml          ← publishes brain-atlas/ to GitHub Pages on push
├── brain-atlas/                  ← the app (this is what gets deployed)
│   ├── index.html
│   ├── app.jsx                   ← composition, state & scene wiring
│   ├── scene.js                  ← Three.js scene, picking, camera, poster export
│   ├── control-panel.jsx · selection-card.jsx · layers-tree.jsx · components.jsx · …
│   ├── data.js                   ← structures + metadata (generated from the manifest)
│   ├── firebase-analytics.js     ← consent‑gated Google Analytics (Consent Mode v2)
│   ├── models/
│   │   ├── brain.glb             ← Draco‑compressed, 344 named structures
│   │   └── manifest.json         ← per‑structure metadata (id, label, category, side, TA2 path)
│   └── vendor/draco/             ← Draco decoder (vendored, offline‑ready)
├── scripts/
│   ├── export_brain.py           ← Blender: Z‑Anatomy .blend → named brain.glb + manifest
│   ├── inspect_scene.py          ← dumps the collection tree / object inventory
│   ├── check_positions.mjs       ← QA: per‑structure world position + extras check
│   └── shot.mjs                  ← headless screenshot helper (Playwright)
└── Z-Anatomy/                    ← source .blend (Startup.blend) + extracted inventory
```

### Metadata model
Each mesh carries its anatomy as glTF `extras` (so it survives Three.js name
sanitisation and Draco compression). The viewer reads these directly - it never
matches on display names:

| field | meaning |
|---|---|
| `bx_id` | stable unique id (one per structure; left & right are distinct) |
| `bx_cat` | subsystem (`cortex`, `arteries`, `cranial_nerves`, …) |
| `bx_label` | clean human label |
| `bx_side` | `left` / `right` / `median` |
| `bx_region` | parent region (lobe / brainstem / cerebellum …) |

`manifest.json` mirrors this and adds the full TA2 ancestor path per structure.

---

## Regenerating the model

The committed `brain-atlas/models/brain.glb` is already built; you only need this to change
the selection, colours, or detail.

**Requirements:** Blender 4.x/5.x, Node 18+, and the `@gltf-transform/cli` + `draco3dgltf`
npm packages (already in this repo's `node_modules`).

```bash
# 1. Export the brain from the Z‑Anatomy .blend → brain-atlas/models/brain.glb + manifest.json
/Applications/Blender.app/Contents/MacOS/Blender \
    Z-Anatomy/Startup.blend --background --python scripts/export_brain.py

# 2. Compress for the web (dedup → weld → Draco), preserving every node + its extras
export PATH="$PWD/node_modules/.bin:$PATH"
gltf-transform dedup brain-atlas/models/brain.glb /tmp/b1.glb
gltf-transform weld  /tmp/b1.glb                  /tmp/b2.glb
gltf-transform draco /tmp/b2.glb                  brain-atlas/models/brain.glb
```

What `export_brain.py` does, in order:
1. Walks the Z‑Anatomy collection tree and selects the brain scope - everything under
   `Brain`, the cranial meninges, the cranial nerves (neural structures only - it
   explicitly drops the muscles/glands/eyes each nerve is filed with), and the cranial
   arteries / dural sinuses chosen by an anatomical name whitelist.
2. Bakes the vessel/nerve **curves into tube meshes** (glTF has no curve type).
3. **Bakes world transforms into geometry** and clears parents - this is what fixes
   otherwise‑displaced structures like the corpus callosum and fornix - and strips stray
   vertices from a couple of glitched source meshes.
4. Writes the `bx_*` metadata as glTF extras and exports a single named GLB + manifest.

---

## Tech stack

- **Three.js** (`GLTFLoader`, `DRACOLoader`, ACES tone mapping, a custom lightweight
  orbit/pan/zoom) for the 3D scene, picking and poster export.
- **React** (+ Babel standalone) for the UI, loaded from a CDN. No bundler, no build step.
- **Blender** (headless Python) for the asset export; **glTF‑Transform** for Draco
  compression.

---

## Attribution & licence

This project is **dual‑licensed** - see [`LICENSE`](LICENSE) for the full text:

- **Viewer source code** (HTML/CSS/JS/JSX, build & export scripts) - **Apache License 2.0**.
  Use it, fork it, embed it, do what you like.
- **3D anatomy assets** (the `brain.glb` model and the metadata derived from it):
  **Creative Commons Attribution‑ShareAlike 4.0 (CC BY‑SA 4.0)**, © Z‑Anatomy contributors
  and BodyParts3D / DBCLS.

**CC BY‑SA is share‑alike:** if you distribute a modified version of the *model*, it must
stay under CC BY‑SA and keep this attribution. The Apache 2.0 code licence does **not**
relicense the model - keep this notice with the `.glb`.

- Z‑Anatomy - https://www.z-anatomy.com/  ·  https://github.com/Z-Anatomy
- BodyParts3D, © The Database Center for Life Science (DBCLS) - https://lifesciencedb.jp/bp3d/

**Deep‑brain nuclei (added by atlas‑guided registration).** The globus pallidus
internal/external split, the seven thalamic nuclei groups, the subthalamic
nucleus, substantia nigra, nucleus accumbens, the amygdala functional groups and
the hypothalamus zones are not in the source model; they were registered from open
MNI‑space atlases and remain **CC BY‑SA 4.0**. They are **approximate** (about
7 mm, educational, not for clinical use). How it is done and how to extend it:
[`docs/registration.md`](docs/registration.md).

- CIT168 subcortical atlas - Pauli, Nili & Tyszka 2018, *Scientific Data*
  (**CC BY 4.0**) - https://osf.io/jkzwp/
- CIT168 amygdala atlas - Tyszka & Pauli 2016 (**CC BY‑SA 4.0**) - https://osf.io/hksa6/
- Najdenovska et al. 2018, in‑vivo probabilistic thalamic atlas, *Scientific Data*
  (**CC BY‑SA 4.0**) - https://doi.org/10.5281/zenodo.1405484
- Neudorfer et al. 2020, hypothalamic region atlas, *Scientific Data*
  (**CC BY 4.0**) - https://doi.org/10.5281/zenodo.3942115

## Contributing

Issues and PRs are welcome - corrections to anatomy/labels, accessibility, and new
"cinematic" presets especially. By contributing you agree your changes are released under
the same dual licence above. Please don't add fabricated geometry; this atlas only ships
real, source‑derived structures.

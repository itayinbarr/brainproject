# Brain Project - the most detailed interactive 3D brain

**The most detailed interactive 3D brain available to date, free and open in your browser -
and it's constantly growing.**

I'm a visual learner. I've always wished for a tool that would let me actually *see* the
brain and explore it myself, at a deeper level than just its main components. Every brain
map I could find online stopped at the **major regions**: a dozen labelled blobs. That's
not enough to truly study from. So I built the thing I wanted to exist, and I keep adding
to it.

Spin it, search it, fade the cortex away, isolate a single structure, follow a white-matter
tract, peel the brain apart system by system. Every gyrus and sulcus, the deep grey nuclei,
the diencephalon, the white-matter pathways, the ventricles, brainstem, cerebellum, the
dural venous sinuses, the circle of Willis, the dural reflections and the cranial nerves are
each a separate, labelled, toggleable mesh, with its full anatomical (TA2) path and a
plain-language description. This is the granularity neuroscientists and students actually
need, in something anyone can open in a browser.

Nothing here is fabricated. Every mesh is a real, TA2-named anatomical structure derived
from open anatomical and imaging data (full credits & licence [below](#attribution--licence)).
The model is updated regularly as new structures are registered and refined.

![Brain Project - interactive 3D brain](docs/default.png)

## Live demo

- **GitHub Pages:** https://itayinbarr.github.io/brainproject/
- **Firebase Hosting:** https://brain-atlas-7f5fe.web.app

Runs entirely in the browser, no install, works on desktop and mobile (pinch-free zoom
buttons on touch). Optional, consent-gated Google Analytics; declining keeps it anonymous
and cookieless.

The [r/neuro community](https://www.reddit.com/r/neuro/comments/1tyfydj/the_lack_of_a_proper_brain_map_drove_me_nuts_when/)
gave the project a warm welcome, which has helped shape where it's headed.

---

## Run locally

No build step. The JSX is transpiled in the browser. Just serve the `brain-atlas/` folder
over HTTP (the model is fetched at runtime, so opening the file directly won't work):

```bash
cd brain-atlas
python3 -m http.server 8861
# open http://localhost:8861/
```

Three.js + React load from a CDN; the Draco decoder, the model, the data and the UI are all
local. Any static host works, which is what's deployed to the live demos above.

---

## Using it

### Navigation
| Action | Control |
|---|---|
| **Rotate** | left-drag |
| **Pan / drift** | hold **⌘ Cmd** (or **Ctrl**) and left-drag, or right-drag |
| **Zoom** | scroll / pinch |
| **Select a structure** | click it in the 3D view |
| **Hover** | structures glow faintly under the cursor |

When you select something, its full name (with side) and its **TA2 anatomical path**
(e.g. `Telencephalon › Frontal lobe › Precentral gyrus`) appear at the bottom-left.

### Side panel
- **Search** - type any part of a name, region, or system (`calcarine`, `thalamus`,
  `M2`, `sinus`, `vagus`, `arcuate`). The list filters live and non-matching meshes fade in 3D.
- **Layers** - structures are grouped into colour-coded subsystems. Toggle a whole
  subsystem with its header checkbox, or expand it and toggle individual structures.
- **Isolate** - show *only* the current search matches (or the current selection), and
  frame the camera on them.
- **Reset** - restore the default view.
- **Focus** - fly the camera to the current selection.
- **Cortex opacity** - fade the cortical surface to see the deep structures, tracts, vessels
  and ventricles inside.
- **Left / Right / Both** - show one hemisphere or both (median/unpaired structures always
  stay visible).

### On-stage controls
- **Spin** (desktop) - stop or resume the idle auto-rotation.
- **Share** - copy a link that reopens this exact view, or download a high-definition poster.
- **About** - the story, credits and licence.

---

## What's inside

This is **illustration-/gross-anatomy grade**, derived from MRI segmentation and registered
imaging atlases. Rather than chase a headline count (the number keeps changing as the model
grows), here is an honest account of what is and isn't resolved, because it matters for how
you use it.

### Present and individually named
- **Cortex** - every gyrus and sulcus, left and right, including the specific ones you'd
  want: calcarine sulcus, supramarginal and angular gyri, cuneus, precuneus, lingual gyrus,
  the fusiform (occipitotemporal) gyri, central/precentral/postcentral, parieto-occipital, etc.
- **White-matter tracts** - the major association, projection and commissural pathways as
  tube meshes (arcuate, cingulum, SLF/ILF/IFOF, uncinate, corticospinal tract, optic
  radiations, fornix, and more), registered from HCP1065 tract templates.
- **Deep grey / basal ganglia** - caudate, putamen, globus pallidus (internal/external),
  lentiform nucleus, amygdaloid body and its functional groups, claustrum-level structures,
  plus the registered subthalamic nucleus, substantia nigra and nucleus accumbens.
- **Diencephalon** - thalamus (whole plus the seven nuclei groups), hypothalamus and its
  zones, medial & lateral geniculate bodies, mamillary bodies, optic chiasm/tract, habenula,
  red nucleus.
- **Ventricles** - lateral (L/R), third, fourth, septum pellucidum, choroid plexus.
- **White matter / commissures** - corpus callosum, fornix, anterior & hippocampal
  commissures, internal capsule, stria terminalis/medullaris.
- **Brainstem** (midbrain/pons/medulla) with colliculi, peduncles, many cranial-nerve nuclei.
- **Cerebellum** with vermis/hemispheres/peduncles.
- **Vasculature** - the circle of Willis in full (anterior/middle/posterior cerebral
  arteries incl. M1/M2/M3 segments, the communicating arteries, basilar, vertebral, internal
  carotid, the cerebellar arteries) and the dural venous sinuses (superior/inferior sagittal,
  straight, transverse, sigmoid, cavernous, petrosal, confluence, etc.).
- **Meninges** - falx cerebri, tentorium cerebelli (the dural reflections).
- **Cranial nerves I-XII** and major branches, as tube meshes.

### A note on resolution
The surface-mesh structures are gross-anatomy grade. The deep nuclei, hypothalamic zones and
white-matter tracts are **registered from open MNI-space imaging atlases**, so they are
**approximate** (about 7 mm, educational, not for clinical use). The model deliberately
doesn't fake geometry it doesn't have; finer subnuclei are added only when a suitable open
atlas can be registered cleanly. See [`docs/registration.md`](docs/registration.md) for how
this is done and how to extend it.

---

## Project layout

```
brainmodel/
├── README.md                     ← this file
├── LICENSE                       ← Apache 2.0 (code) + CC BY-SA 4.0 (3D assets)
├── firebase.json                 ← Firebase Hosting config (serves brain-atlas/)
├── .github/workflows/
│   └── deploy-pages.yml          ← publishes brain-atlas/ to GitHub Pages on push
├── brain-atlas/                  ← the app (this is what gets deployed)
│   ├── index.html
│   ├── app.jsx                   ← composition, state & scene wiring
│   ├── scene.js                  ← Three.js scene, picking, camera, poster export
│   ├── control-panel.jsx · selection-card.jsx · layers-tree.jsx · components.jsx · …
│   ├── data.js                   ← structures + metadata (generated from the manifest)
│   ├── firebase-analytics.js     ← consent-gated Google Analytics (Consent Mode v2)
│   ├── models/
│   │   ├── brain.glb             ← Draco-compressed, every named structure
│   │   └── manifest.json         ← per-structure metadata (id, label, category, side, TA2 path)
│   └── vendor/draco/             ← Draco decoder (vendored, offline-ready)
├── scripts/
│   ├── export_brain.py           ← Blender: Z-Anatomy .blend → named brain.glb + manifest
│   ├── build_tracts.py           ← builds white-matter tract tubes from HCP1065 centerlines
│   ├── gen_data.py               ← manifest.json → data.js
│   └── shot.mjs                  ← headless screenshot helper (Playwright)
└── Z-Anatomy/                    ← source .blend (Startup.blend) + extracted inventory
```

### Metadata model
Each mesh carries its anatomy as glTF `extras` (so it survives Three.js name
sanitisation and Draco compression). The viewer reads these directly; it never
matches on display names:

| field | meaning |
|---|---|
| `bx_id` | stable unique id (one per structure; left & right are distinct) |
| `bx_cat` | subsystem (`cortex`, `tracts`, `arteries`, `cranial_nerves`, …) |
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
# 1. Export the brain from the Z-Anatomy .blend → brain-atlas/models/brain.glb + manifest.json
/Applications/Blender.app/Contents/MacOS/Blender \
    Z-Anatomy/Startup.blend --background --python scripts/export_brain.py

# 2. Compress for the web (dedup → weld → Draco), preserving every node + its extras
export PATH="$PWD/node_modules/.bin:$PATH"
gltf-transform dedup brain-atlas/models/brain.glb /tmp/b1.glb
gltf-transform weld  /tmp/b1.glb                  /tmp/b2.glb
gltf-transform draco /tmp/b2.glb                  brain-atlas/models/brain.glb
```

The white-matter tracts are built separately from HCP1065 centerlines by
`scripts/build_tracts.py` and merged in, reusing the same affine as the registered nuclei.

---

## Tech stack

- **Three.js** (`GLTFLoader`, `DRACOLoader`, ACES tone mapping, a custom lightweight
  orbit/pan/zoom) for the 3D scene, picking and poster export.
- **React** (+ Babel standalone) for the UI, loaded from a CDN. No bundler, no build step.
- **Blender** (headless Python) for the asset export; **glTF-Transform** for Draco
  compression.

---

## Attribution & licence

This project is **dual-licensed**. See [`LICENSE`](LICENSE) for the full text:

- **Viewer source code** (HTML/CSS/JS/JSX, build & export scripts): **Apache License 2.0**.
  Use it, fork it, embed it, do what you like.
- **3D anatomy assets** (the `brain.glb` model and the metadata derived from it):
  **Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)**, © Z-Anatomy contributors
  and BodyParts3D / DBCLS.

**CC BY-SA is share-alike:** if you distribute a modified version of the *model*, it must
stay under CC BY-SA and keep this attribution. The Apache 2.0 code licence does **not**
relicense the model; keep this notice with the `.glb`.

- Z-Anatomy, built on BodyParts3D, © The Database Center for Life Science (DBCLS).

**Imaging-registered structures.** The globus pallidus internal/external split, the thalamic
nuclei groups, the subthalamic nucleus, substantia nigra, nucleus accumbens, the amygdala
functional groups, the hypothalamus zones and the white-matter tracts are not in the source
model; they were registered from open MNI-space imaging atlases and remain **CC BY-SA 4.0**.
They are **approximate** (about 7 mm, educational, not for clinical use). How it's done and
how to extend it: [`docs/registration.md`](docs/registration.md).

- CIT168 subcortical atlas - Pauli, Nili & Tyszka 2018, *Scientific Data*
  (**CC BY 4.0**) - https://osf.io/jkzwp/
- CIT168 amygdala atlas - Tyszka & Pauli 2016 (**CC BY-SA 4.0**) - https://osf.io/hksa6/
- Najdenovska et al. 2018, in-vivo probabilistic thalamic atlas, *Scientific Data*
  (**CC BY-SA 4.0**) - https://doi.org/10.5281/zenodo.1405484
- Neudorfer et al. 2020, hypothalamic region atlas, *Scientific Data*
  (**CC BY 4.0**) - https://doi.org/10.5281/zenodo.3942115
- HCP1065 white-matter tract templates (population-averaged, from the Human Connectome
  Project) used to build the tract centerlines.

## Contributing

Issues and PRs are welcome, especially corrections to anatomy/labels, accessibility, and new
"cinematic" presets. By contributing you agree your changes are released under the same dual
licence above. Please don't add fabricated geometry; this project only ships real,
source-derived structures.
</content>
</invoke>

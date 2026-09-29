# Deep-nuclei registration: how it works and how to extend it

This document explains how the deep-brain nuclei were added to `brain.glb`, the
coordinate mapping that makes it possible, how accurate it is, and how to reuse the
same mapping later to place **more nuclei** or to **project an MNI volume (e.g. an
fMRI statistical map) onto the model**.

The source model (Z-Anatomy / BodyParts3D) is a gross whole-organ segmentation: it
has a single thalamus mesh per side, one globus pallidus, and no subthalamic
nucleus, substantia nigra or nucleus accumbens at all. Those finer structures only
exist in dedicated neuroimaging atlases, which live in **MNI space**. The model is
**not** in MNI space, so the whole problem reduces to one thing: a reliable
transform between MNI space and the model's mesh space.

---

## 1. The two coordinate spaces

| | Space | Units | Axes |
|---|---|---|---|
| Atlases | MNI152 (RAS) | millimetres | +x right, +y anterior, +z superior |
| Model | Z-Anatomy mesh world (Blender) | metres (life-size) | +x is the model's **left**, +y posterior, +z superior |

So the mapping has to handle an axis flip (left/right and AP), a large scale change
(mm to metres, ~0.00089 mesh-units/mm), and the fact that the BodyParts3D brain is
not perfectly proportioned like the MNI template.

## 2. The transform: an anchored least-squares affine

We fit a single 12-parameter affine `T` (rotation + scale + shear + translation)
that maps **MNI mm to mesh world**, anchored on the centroids of structures that
exist in *both* the model and the atlases:

- caudate, putamen, globus pallidus, thalamus (left + right),
- hypothalamus and mammillary body (added because they sit *inferior* to the deep
  grey cluster and stop the vertical axis from being under-constrained, which
  matters because STN/SN are placed inferiorly).

Mesh centroids come from the `.blend` (`scripts/extract_subcortex.py`); MNI
centroids come from the atlas label volumes. With ~11 paired points we solve

```
mesh_xyz1 = T @ mni_xyz1          (least squares, row-vector homogeneous form)
mni_xyz1  = Tinv @ mesh_xyz1
```

`T`, `Tinv`, the scale, and the residuals are written to
`scripts/atlas_data/registration_affine.json` so you never have to refit. That file
is the reusable core of everything below.

## 3. How accurate is it?

Measured by `scripts/validate_nuclei.py`:

| Check | Mean | Max |
|---|---|---|
| In-sample residual (the 11 landmarks) | ~3.9 mm | ~5.5 mm |
| Leave-one-out cross-validation | ~6.1 mm | ~8.4 mm |
| **Held-out control: Red nucleus** (in both, never a landmark) | **~7.2 mm** | |

The held-out red nucleus is the honest number: the model already ships a red
nucleus (under the brainstem), CIT168 also has one, and it was deliberately left out
of the fit, so the gap between its atlas-predicted and true mesh positions is a
fully out-of-sample accuracy estimate of about **7 mm**.

The validator also reports the per-axis stretch of `T` (currently about
`[1.26, 1.06, 0.68]`). The 0.68 is real, not noise: the BodyParts3D deep brain
spans ~16 mm vertically where MNI spans ~24 mm, i.e. it is ~33% vertically
compressed. The affine absorbs this, which is exactly why the nuclei end up
correctly *scaled* to the model, but the leftover proportion mismatch is what caps
accuracy at ~7 mm. A nonlinear warp would do better; an affine is the chosen
educational-fidelity trade-off.

**Bottom line:** relative arrangement is correct (verified: GPi medial to GPe, STN
inferomedial to GP, SN below STN, red nucleus paramedian); absolute placement is
about 7 mm, on the order of the smaller nuclei's own size. Educational, not
surgical.

---

## 4. The pipeline (four passes)

```bash
# 0. one-time: deps + atlases (CC BY / CC BY-SA, into scripts/atlas_data, gitignored)
pip install nibabel numpy scipy scikit-image trimesh fast_simplification
#    CIT168 prob+det (osf.io/jkzwp) and Najdenovska (zenodo 1405484) - see build_nuclei.py

# 1. extract mesh-space landmark centroids + GP/thalamus vertices from the .blend
blender Z-Anatomy/Startup.blend --background --python scripts/extract_subcortex.py

# 2. fit the affine, partition GP + thalamus, generate the missing nuclei meshes
python scripts/build_nuclei.py           # writes nuclei_artifacts.json + registration_affine.json

# 3. apply splits + add nuclei in Blender, save Startup_nuclei.blend
blender Z-Anatomy/Startup.blend --background --python scripts/build_with_nuclei.py

# 4. export the GLB + manifest, then regenerate data.js, then Draco-compress
blender Z-Anatomy/Startup_nuclei.blend --background --python scripts/export_brain.py
python scripts/gen_data.py
npx gltf-transform dedup brain-atlas/models/brain.glb /tmp/b1.glb
npx gltf-transform weld  /tmp/b1.glb /tmp/b2.glb
npx gltf-transform draco /tmp/b2.glb brain-atlas/models/brain.glb

# optional: print the accuracy table
python scripts/validate_nuclei.py
```

Two ways structures are created, both in `build_nuclei.py`:

- **Partition an existing mesh** (used for GP -> GPe/GPi and thalamus -> 7 nuclei):
  for each vertex of the parent mesh, map it to MNI with `Tinv`, read the atlas
  label there, then split faces by the majority label of their vertices. This keeps
  the original surface exactly and just divides it, so the style matches the rest of
  the model and the result stays a CC BY-SA derivative of the original mesh.
- **Generate from the atlas** (used for STN / SN / accumbens, which have no parent
  mesh): threshold the atlas probability volume, run marching cubes, transform the
  vertices into mesh space with `T`, smooth and decimate.

Provenance is recorded per structure as the `bx_source` / `bx_parent` glTF extras
and the `source` / `parent` fields in `manifest.json` and `data.js`; the selection
card shows an "approximate, registered from ..." note for anything not from
Z-Anatomy.

---

## 5. Extending it

### 5a. Add another nucleus from a label/probability volume

You need an atlas volume in MNI space (a NIfTI). Load the affine and reuse it:

```python
import json, numpy as np, nibabel as nib
from skimage import measure
import trimesh

R = json.load(open("scripts/atlas_data/registration_affine.json"))
T = np.array(R["mni_to_mesh"])                     # MNI mm -> mesh world

img  = nib.load("my_atlas.nii.gz")                 # MNI-space NIfTI
vol  = np.asanyarray(img.dataobj)
mask = (vol == MY_LABEL)                            # or vol > threshold for a prob map

verts, faces, *_ = measure.marching_cubes(mask.astype(float), level=0.5)
verts_mm   = nib.affines.apply_affine(img.affine, verts)        # voxel -> MNI mm
verts_mesh = nib.affines.apply_affine(T, verts_mm)              # MNI mm -> mesh world
trimesh.Trimesh(verts_mesh, faces).export("my_nucleus.obj")
```

Then add the mesh to the scene (mirror the missing-nuclei block in
`build_with_nuclei.py`: create the object, tag `_nuc_source` / `_nuc_region`, link
it into the basal-ganglia collection so the exporter scopes it) and re-run pass 4.
If your atlas separates hemispheres, split by the sign of the MNI x of each voxel
(x < 0 is left in RAS); the affine handles the model's left/right flip.

Check the licence of any new atlas before shipping derived geometry: CC BY and
CC BY-SA are fine inside this CC BY-SA model; avoid non-commercial (NC),
no-derivatives (ND), and the FreeSurfer-licensed atlases for redistribution.

### 5b. Project an fMRI / MNI statistical map onto the model

Same transform, used the other direction. You have a per-mesh-vertex question
("what is the atlas/stat value at this anatomical point?"), so map each **mesh
vertex** to MNI with `Tinv` and sample your volume there:

```python
R    = json.load(open("scripts/atlas_data/registration_affine.json"))
Tinv = np.array(R["mesh_to_mni"])                  # mesh world -> MNI mm
stat = nib.load("zstat1_MNI.nii.gz"); data = np.asanyarray(stat.dataobj)
inv  = np.linalg.inv(stat.affine)

def value_at(mesh_xyz):                             # mesh world (metres)
    mm  = nib.affines.apply_affine(Tinv, mesh_xyz)
    ijk = np.rint(nib.affines.apply_affine(inv, mm)).astype(int)
    if (ijk < 0).any() or (ijk >= data.shape).any(): return 0.0
    return float(data[tuple(ijk)])
```

In practice you would sample every vertex of the cortical (and/or subcortical)
meshes, normalise to a colormap, and write the result as a glTF **vertex-colour**
attribute (or a small per-node value the viewer reads to tint the material). The
cortex is the natural target for fMRI; remember accuracy is ~7 mm in the deep brain
and the cortical surface was not part of the landmark fit, so treat any overlay as
indicative, and consider re-fitting `T` with cortical landmarks if you need the
surface to line up better.

> The affine is a global linear fit. It is good for placing compact deep structures
> and for indicative overlays, but it is not a substitute for proper nonlinear
> normalisation if you need millimetre cortical accuracy. If you go that route, the
> clean upgrade is to replace `T` with a nonlinear warp (mesh <-> MNI) and keep the
> rest of the pipeline unchanged.

### 5c. Add a white-matter tract as a centerline tube

Tracts are not closed solids; they are pathways, so they are rendered as **tubes swept
along a centerline** (the same curve->tube path the cranial nerves use) rather than
marching-cubed blobs. The source is the **HCP1065 population-averaged tractography
atlas** (Yeh 2022, CC BY-SA 4.0, ICBM/MNI152 space; release `hcp1065`, file
`hcp1065_avg_tracts_nifti.zip`, ~3.4 MB), unzipped into `scripts/atlas_data/tracts/`.

Each averaged tract is a binary envelope of the whole bundle. `scripts/build_tracts.py`
turns it into a centerline by skeletonising the envelope, taking the longest geodesic
path through the medial axis (the trunk; fans drop out), smoothing it with a spline, and
mapping the points MNI mm -> mesh world with the **same affine** the nuclei use (loaded
from `registration_affine.json`, never refitted). `scripts/build_with_tracts.py` sweeps
each centerline into a Blender curve with a bevel and tags it `_nuc_cat=tracts` plus a
`_nuc_decussation` note; the curve bakes to a tube and lands in the new `tracts` UI
category, with the crossing note carried through to `bx_decussation` and the Learn card.

**Clipping to the cortex.** The affine is anchored on deep grey and stretches laterally
(per-axis ~`[1.26, 1.06, 0.68]`), so a tract reaching the lateral cortex overshoots the
narrower BodyParts3D surface and the tube pokes out the side. `scripts/export_shell.py`
dumps the parenchyma as a solid mesh (`brain_shell.npz`) plus per-structure centroids
(`mesh_centroids.json`); `build_tracts.py` voxelises the shell into an inside/outside
mask and **snaps any out-of-brain centerline point inward to the nearest in-brain
location**, so the tube hugs the surface instead of piercing it. It then prints an
**endpoint-validation table**: the nearest named structure to each tract end (e.g. CST =
Pons <-> motor cortex, dentatorubrothalamic = superior cerebellar peduncle <-> thalamo-
cortical, optic radiation = lingual gyrus <-> geniculate), a quick sanity check that each
pathway starts and ends where it should.

```bash
blender Z-Anatomy/Startup_nuclei.blend --background --python scripts/export_shell.py   # shell + centroids
python scripts/build_tracts.py                                            # -> tract_artifacts.json (clipped + validated)
blender Z-Anatomy/Startup_nuclei.blend --background --python scripts/build_with_tracts.py
blender Z-Anatomy/Startup_tracts.blend  --background --python scripts/export_brain.py
python scripts/gen_data.py                                                # adds tracts palette/depth/descriptions
# then Draco-compress as in section 4
```

54 tract tubes are produced (corticospinal, corticobulbar, corticopontine x3,
corticostriatal x3, thalamic radiations x3, medial lemniscus, optic & acoustic
radiations, reticulospinal, dentatorubrothalamic, the three cerebellar peduncles, and
the major association tracts: arcuate, SLF I-III, IFOF, ILF, MdLF, uncinate, frontal
aslant). A single centerline is a deliberate simplification of sheet-like tracts (OR,
SLF) and of fanning ones (CST loses its corona-radiata spread); it inherits the global
affine's ~7 mm error, worse near the cortex (the surface was not a landmark). Treat the
tubes as schematic pathways, not tractography.

### 5d. Extending without Blender (recover the affine from `brain.glb`)

`scripts/atlas_data/` (and with it `registration_affine.json`) is gitignored, and the
Blender passes need the Z-Anatomy `.blend`. For additions that only *add* structures, the
whole loop can run on the shipped `brain.glb` instead:

```bash
pip install nibabel numpy scipy scikit-image trimesh fast_simplification rtree
# atlases (into scripts/atlas_data/, gitignored). TemplateFlow redistributes both the
# Najdenovska SPAMs and MASSP 2.0 in MNI152NLin2009cAsym:
B=https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009cAsym
curl -O $B/tpl-MNI152NLin2009cAsym_res-01_atlas-MIAL67ThalamicNuclei_probseg.nii.gz
curl -O $B/tpl-MNI152NLin2009cAsym_res-01_atlas-MASSP20_dseg.nii.gz
# + hcp1065_avg_tracts_nifti.zip unzipped into scripts/atlas_data/tracts/ (section 5c)

node scripts/glb_io.mjs dump brain-atlas/models/brain.glb scripts/atlas_data/glb_dump.json
python scripts/recover_affine.py          # -> registration_affine_glb.json (+ Blender-frame copy)
python scripts/build_extra.py             # -> extra_artifacts.json + a scoring table
node scripts/glb_io.mjs merge brain-atlas/models/brain.glb scripts/atlas_data/extra_artifacts.json \
     brain-atlas/models/manifest.json brain-atlas/models/brain.glb
python scripts/gen_data.py
node scripts/verify_extra.mjs /tmp/shots   # boots the app headless, checks + screenshots
```

**Recovering `T` exactly.** The seven Najdenovska thalamic nuclei per side in the GLB are
`T` applied to meshes marching-cubed in MNI space, and TemplateFlow's `MIAL67ThalamicNuclei`
is the same SPAM volume. The volume centroid of a closed mesh is affine-equivariant, so
regenerating the 14 solids exactly as `build_nuclei.py` does gives 14 exact MNI <-> mesh
pairs for the 12-parameter affine. Result: **0.000 mm residual**, 0.000886 mesh units/mm, and
the held-out red nucleus again comes out at **7.2 mm**, i.e. the original registration,
bit-for-bit, not a new fit. `recover_affine.py` refuses to write an affine if the residual
exceeds 0.5 mm. The GLB stores glTF (Y-up) coordinates: glTF `(x, y, z)` = Blender `(x, z, -y)`.

**Tracts reproduce too.** `build_extra.py` imports `build_tracts.py`'s centerline and spline
code unchanged; only the clipping shell is rebuilt from the GLB (see below). Regenerating
all 54 *existing* tracts this way lands on the shipped tubes with a median distance of
exactly 1.10 mm (= the tube radius, i.e. identical centerlines) and a worst 95th percentile
of 4.4 mm (a clipped uncinate end).

**Shell from the GLB.** The cortex in the GLB is a set of gyrus/sulcus surface patches with
sub-voxel gaps, so a plain hole-fill of their union leaks (only 67% of the shipped tube
vertices test as inside it). A morphological closing of 2 voxels (2.4 mm) before the fill
seals it and is what reproduces the shipped tubes; containment *scores* use a 3-voxel
closing, which is stable across hemispheres. `trimesh.voxelized()` runs out of memory on the
full cortex, so `build_extra.py` voxelises by dense surface sampling instead.

**How each addition is scored** (printed by `build_extra.py`, all from the run that shipped):

| Check | Result |
|---|---|
| MASSP 2.0 vs the structures already registered from CIT168 / Najdenovska (same affine) | STN 0.4, SN 0.6-0.7, GPi 1.0-1.4, thalamus 0.8-1.8, GPe 2.9-3.0, accumbens 3.2-3.4, amygdala 3.5-4.0 mm |
| MASSP 2.0 vs Z-Anatomy geometry (held-out, like the red nucleus) | red nucleus 7.2, caudate 5.7-6.1, colliculi 6.1-6.8, putamen 9.1-9.2 mm |
| Every new solid inside the brain parenchyma | 100% (all 13) |
| Brainstem nuclei inside the Z-Anatomy brainstem | VTA 96-97%, PAG 98%, PPN / dorsal & median raphe 100% |
| PAG centroid vs Z-Anatomy aqueduct centroid | 1.8 mm |
| VTA medial to SN (abs(x) in MNI) | 3.8-4.5 mm vs 9.4-9.5 mm - yes, both sides |
| Buried in existing meshes | VTA 27-28% inside the Z-Anatomy red nucleus; internal capsule 21% inside the Z-Anatomy putamen; everything else <= 5% |

The two overlaps are the known BodyParts3D-vs-MNI proportion mismatch, not new error: the
Z-Anatomy red nucleus is the held-out control that already sits 7.2 mm from its atlas
position, and the Z-Anatomy putamen is ~9 mm off. Against the *atlas-placed* neighbours
(GP, thalamus, SN) the new structures sit where the atlases put them (medial -> lateral:
thalamus, caudate, internal capsule, putamen, claustrum). Renders of each group from the
real viewer are in [`docs/extra/`](extra/) (`verify_extra.mjs`).

## 6. What has been added, and what was deferred (and why)

Built so far, all as **closed solids** (see the closed-surface note in section 4):
- Basal ganglia: GPe/GPi, subthalamic nucleus, substantia nigra, nucleus accumbens
  (CIT168 subcortical, CC BY 4.0).
- Thalamus: seven nuclei groups (Najdenovska 2018, CC BY-SA 4.0).
- Amygdala: four functional groups - lateral, basolateral complex, central,
  corticomedial - merged from the 9-subnucleus CIT168 amygdala atlas
  (Tyszka & Pauli 2016, CC BY-SA 4.0, OSF `hksa6`). Adding the whole amygdala as a
  registration landmark dropped its local residual to ~1 mm.
- Hypothalamus: five zones - preoptic, anterior, tuberal, lateral, posterior -
  merged from the Neudorfer 2020 atlas (CC BY 4.0, Zenodo `3942115`); only the 13
  true hypothalamic nuclei are used (its commissures, fornix, mammillary, STN/SN/RN,
  BNST, nucleus basalis etc. are dropped to avoid duplicating model structures).

White-matter tracts were added as centerline tubes (section 5c) from the HCP1065 atlas
(CC BY-SA 4.0). The small brainstem motor tracts that no open in-vivo atlas resolves -
**rubrospinal, vestibulospinal, tectospinal, bulbospinal**, and the **spinothalamic
tract, lateral lemniscus, medial longitudinal fasciculus and central tegmental tract** -
are simply absent from HCP1065 and were not authored by hand. (The only richer brainstem
source, the Tang 23-bundle atlas, is non-commercial, the same blocker as SUIT below.)

Two requested regions were deliberately **not** added:
- **Cerebellar deep nuclei** (dentate, interposed, fastigial): the standard atlas
  (SUIT, Diedrichsen) is **CC BY-NC 3.0** (NonCommercial), which is incompatible with
  this project's open licence and CC BY-SA assets. The Julich cerebellar-nuclei maps
  are likewise NC/SA-restricted. Revisit only if a CC BY / CC BY-SA, MNI-space
  cerebellar-nuclei atlas appears. (A separate cerebellum-anchored affine would also
  be needed, since the global fit is anchored on cerebral deep grey.)
- **Hippocampal subfields** (CA1-4, subiculum, DG): available atlases are either
  FreeSurfer-licensed (restricted) or unlicensed (e.g. CoBrA), and the subfields are
  sub-millimetre laminae along a curved structure that ~7 mm affine registration
  would misrepresent. A defensible non-atlas alternative is a geometric head/body/
  tail split of the existing hippocampus mesh, if that is ever wanted.

Added later without Blender (section 5d), all as closed solids unless noted:
- MASSP 2.0 (Alkemade & Bazin, 7T AHEAD data, CC BY 4.0; TemplateFlow
  `atlas-MASSP20`): ventral tegmental area, periaqueductal grey, pedunculopontine
  nucleus, dorsal and median raphe nuclei, basal forebrain cholinergic nuclei (Ch1-Ch4,
  mostly the nucleus basalis of Meynert), claustrum (0.6-voxel pre-blur so the 1-2 mm sheet
  does not mesh as lace), internal capsule. Structures MASSP shares with the model are not
  re-added; its hippocampal subfields stay deferred for the reasons above.
- HCP1065 tubes: the five cingulum segments (frontal-parietal, frontal-parahippocampal,
  parahippocampal, parahippocampal-parietal, parolfactory), the parietal aslant tract and the
  vertical occipital fasciculus. **Extreme capsule was left out on purpose**: HCP1065's EMC
  envelope and trunk run from the inferior frontal gyrus up to the superior parietal
  lobule (MNI z ~ 80), not along the classic fronto-temporal course, so a tube would teach
  the wrong path.
- Not added yet, only because OSF and Zenodo were unreachable from the sandbox this pass
  ran in: the SNc/SNr split and ventral pallidum (CIT168 labels) and BNST / zona incerta
  (Neudorfer labels). Both atlases are CC BY and already used here, so these are a few
  lines in `build_nuclei.py`'s label tables (or `build_extra.py`) once the files are local.

Observation, not changed: MASSP 2.0's lateral and medial geniculate nuclei sit ~18 mm
from the hand-placed geniculate bodies (section 1b of `build_with_nuclei.py`), mostly
because the atlas puts them ~15 mm more inferior, i.e. below rather than on the dorso-lateral
pulvinar. Worth revisiting if the geniculates are ever re-placed from an atlas.

When merging atlas labels into a functional group, union the label masks first and
march the **single** combined mask, so each group is one watertight solid rather
than several overlapping shells.

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

When merging atlas labels into a functional group, union the label masks first and
march the **single** combined mask, so each group is one watertight solid rather
than several overlapping shells.

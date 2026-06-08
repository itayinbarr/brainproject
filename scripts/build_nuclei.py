"""Pass 2 of the nuclei pipeline (plain Python, needs nibabel/numpy/scipy/skimage).

Registers two openly-licensed MNI atlases to the model's mesh space and produces:
  - per-vertex partition labels for globus pallidus (GPe/GPi, from CIT168) and
    thalamus (7 nuclei groups, from Najdenovska),
  - new meshes for structures the model lacks entirely (subthalamic nucleus,
    substantia nigra, red nucleus, nucleus accumbens), marching-cubed from CIT168
    and transformed into mesh space.

Registration is an anchored least-squares affine (MNI -> mesh world) fitted on
homologous subcortical centroids. Fidelity is educational/approximate; see README.

Atlases (downloaded into scripts/atlas_data, not redistributed raw):
  - CIT168 (Pauli et al. 2018, Scientific Data, CC BY 4.0)
  - Najdenovska et al. 2018 (Scientific Data, CC BY-SA 4.0)

Run:  python scripts/build_nuclei.py
Output: scripts/atlas_data/nuclei_artifacts.json
"""
import json, os, numpy as np, nibabel as nib
from skimage import measure
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "atlas_data")
CIT_PROB = os.path.join(DATA, "CIT168toMNI152-2009c_prob.nii.gz")   # 4D, 16 labels
CIT_DET  = os.path.join(DATA, "CIT168toMNI152-2009c_det.nii.gz")    # 3D, labels 1..16
THAL_SPAM = os.path.join(DATA, "Thalamus_Nuclei-HCP-4DSPAMs.nii.gz")  # 4D, 14 maps
THAL_MAX  = os.path.join(DATA, "Thalamus_Nuclei-HCP-MaxProb.nii.gz")  # 3D, labels 1..14
AMYG = os.path.join(DATA, "amyg_iAmyNuc_1mm_MNI.nii.gz")              # CIT168 amygdala, labels 1..9 (bilateral)
HYP  = os.path.join(DATA, "hypothal_labels_MNI152b_0.5mm.nii.gz")     # Neudorfer, hemisphere-explicit labels
REG_IN = os.path.join(DATA, "registration_input.json")
OUT = os.path.join(DATA, "nuclei_artifacts.json")

AMY_SRC = "CIT168 amygdala (Tyszka 2016)"
HYP_SRC = "Neudorfer 2020"
# CIT168 amygdala (9 subnuclei, bilateral) -> 4 merged functional groups.
AMY_GROUPS = {"Lateral nucleus": [1], "Basolateral complex": [2, 3, 6],
              "Central nucleus": [4], "Corticomedial group": [5, 7, 8, 9]}
# Neudorfer hypothalamus: true hypothalamic nuclei only (right-hemisphere label ids;
# left = id+1). Context structures (commissures, fornix, mammillary, STN/SN/RN, BNST,
# nucleus basalis, zona incerta, etc.) are excluded - several already in the model.
# Merged into the classic zones.
HYP_GROUPS = {"Preoptic hypothalamus": [19],
              "Anterior hypothalamus": [53, 21, 45, 47, 31, 23],
              "Tuberal hypothalamus": [29, 27, 37, 49],
              "Lateral hypothalamus": [25],
              "Posterior hypothalamus": [51]}

# CIT168 label -> 1-based index (verified against MNI centroids).
CIT = {"putamen":1, "caudate":2, "accumbens":3, "gpe":5, "gpi":6,
       "snc":7, "rn":8, "snr":9, "hypothalamus":14, "mammillary":15, "stn":16}

# Najdenovska seven thalamic groups (left labels 1..7; right 8..14) -> display name.
THAL_NAMES = ["Pulvinar", "Anterior nuclei of thalamus", "Mediodorsal nucleus",
              "Ventral laterodorsal nucleus",
              "Intralaminar and lateral posterior nuclei",
              "Ventral anterior nucleus", "Ventral lateroventral nucleus"]


def mm_grid(affine, shape):
    """World (mm) coordinate of every voxel center; returns x,y,z arrays."""
    i, j, k = np.indices(shape[:3])
    x = affine[0, 0]*i + affine[0, 1]*j + affine[0, 2]*k + affine[0, 3]
    y = affine[1, 0]*i + affine[1, 1]*j + affine[1, 2]*k + affine[1, 3]
    z = affine[2, 0]*i + affine[2, 1]*j + affine[2, 2]*k + affine[2, 3]
    return x, y, z


def label_centroid(det, affine, lab, side=None):
    """MNI centroid of an integer label, optionally restricted to a hemisphere."""
    mask = det == lab
    if side is not None:
        x, _, _ = mm_grid(affine, det.shape)
        mask &= (x < 0) if side == "left" else (x > 0)
    ijk = np.argwhere(mask)
    return nib.affines.apply_affine(affine, ijk).mean(0)


def union_centroid(det, affine, labs, side):
    x, _, _ = mm_grid(affine, det.shape)
    mask = np.isin(det, labs) & ((x < 0) if side == "left" else (x > 0))
    ijk = np.argwhere(mask)
    return nib.affines.apply_affine(affine, ijk).mean(0)


# ---------------------------------------------------------------------------
# 1. Load atlases + extracted mesh landmarks
# ---------------------------------------------------------------------------
cit_prob_img = nib.load(CIT_PROB); cit_prob = np.asanyarray(cit_prob_img.dataobj)
cit_aff = cit_prob_img.affine
cit_det = np.asanyarray(nib.load(CIT_DET).dataobj).astype(int)
thal_spam_img = nib.load(THAL_SPAM); thal_spam = np.asanyarray(thal_spam_img.dataobj)
thal_aff = thal_spam_img.affine
thal_max = np.asanyarray(nib.load(THAL_MAX).dataobj).astype(int)
amyg_img = nib.load(AMYG); amyg = np.asanyarray(amyg_img.dataobj).astype(int); amyg_aff = amyg_img.affine
hyp_img = nib.load(HYP); hyp = np.asanyarray(hyp_img.dataobj).astype(int); hyp_aff = hyp_img.affine

reg = json.load(open(REG_IN))
mesh_c = reg["centroids"]

# ---------------------------------------------------------------------------
# 2. Build paired landmark centroids (mesh world <-> MNI) and solve affine
# ---------------------------------------------------------------------------
pairs = []  # (name, mesh_xyz, mni_xyz)


def add(name, mesh_key, mni_xyz):
    if mesh_key in mesh_c:
        pairs.append((name, np.array(mesh_c[mesh_key]), np.array(mni_xyz)))


for side, suf in (("left", ".l"), ("right", ".r")):
    add(f"caudate{suf}", f"Caudate nucleus{suf}", label_centroid(cit_det, cit_aff, CIT["caudate"], side))
    add(f"putamen{suf}", f"Putamen{suf}", label_centroid(cit_det, cit_aff, CIT["putamen"], side))
    add(f"gp{suf}", f"Globus pallidus{suf}", union_centroid(cit_det, cit_aff, [CIT["gpe"], CIT["gpi"]], side))
    add(f"mammillary{suf}", f"Mamillary body{suf}", label_centroid(cit_det, cit_aff, CIT["mammillary"], side))
    add(f"thalamus{suf}", f"Thalamus{suf}",
        union_centroid(thal_max, thal_aff, list(range(1, 8)) if side == "left" else list(range(8, 15)), side))
    add(f"amygdala{suf}", f"Amygdaloid body{suf}",
        union_centroid(amyg, amyg_aff, list(range(1, 10)), side))   # anchor medial temporal
# hypothalamus is a single midline mesh object
add("hypothalamus", "Hypothalamus", label_centroid(cit_det, cit_aff, CIT["hypothalamus"]))

mni = np.array([p[2] for p in pairs])
mesh = np.array([p[1] for p in pairs])
X = np.hstack([mni, np.ones((len(mni), 1))])          # (N,4)
coef, *_ = np.linalg.lstsq(X, mesh, rcond=None)        # (4,3): mesh = X @ coef
T = np.eye(4); T[:3, :4] = coef.T                       # MNI -> mesh (homogeneous)
Tinv = np.linalg.inv(T)                                 # mesh -> MNI

pred = X @ coef
res = np.linalg.norm(pred - mesh, axis=1)
# model scale = mesh units per mm (linear block of the fit); residual mm = res/scale
scale = np.mean(np.linalg.norm(coef[:3, :], axis=0))
print(f"[register] {len(pairs)} landmarks | mean residual "
      f"{res.mean()/scale:.2f} mm (max {res.max()/scale:.2f} mm)")
for (name, *_), r in zip(pairs, res):
    print(f"    {name:16s} {r/scale:5.2f} mm")


def mni_to_mesh(p):
    return (T @ np.append(p, 1.0))[:3]


def mesh_to_mni(p):
    return (Tinv @ np.append(p, 1.0))[:3]


def sample(vol, affine, xyz_mm):
    """Nearest-neighbour sample of a 3D volume at an MNI mm point (0 if outside)."""
    ijk = np.rint(nib.affines.apply_affine(np.linalg.inv(affine), xyz_mm)).astype(int)
    if np.any(ijk < 0) or np.any(ijk >= np.array(vol.shape)):
        return 0.0
    return float(vol[tuple(ijk)])


artifacts = {"residual_mm": float(res.mean()/scale), "meshes": {}}

# ---------------------------------------------------------------------------
# 3. Generate every nucleus as a CLOSED solid by marching-cubes on its atlas map,
#    then transform into mesh space. (Earlier versions sliced the parent's outer
#    shell into open patches; those rendered hollow / inside-out. Closed solids
#    render correctly from all sides and give each nucleus a real 3D shape.)
# ---------------------------------------------------------------------------
CIT_SRC = "CIT168 (Pauli 2018)"
NAJ_SRC = "Najdenovska 2018"
cit_x, _, _ = mm_grid(cit_aff, cit_prob.shape[:3])    # MNI x per voxel (L/R split)


def solid(vol, affine, level_seq, side=None, x_grid=None):
    """Marching-cubes a probability volume into a closed, smoothed mesh in mesh
    space. `side` (with x_grid) restricts a bilateral volume to one hemisphere."""
    v = vol
    if side is not None:
        v = vol * ((x_grid < 0) if side == "left" else (x_grid > 0))
    for level in level_seq:
        if v.max() <= level:
            continue
        try:
            verts, faces, *_ = measure.marching_cubes(v, level=level)
        except (RuntimeError, ValueError):
            continue
        if len(verts) < 8 or len(faces) < 8:
            continue
        m = trimesh.Trimesh(nib.affines.apply_affine(affine, verts), faces, process=True)
        trimesh.smoothing.filter_taubin(m, iterations=12)
        if len(m.faces) > 1000:
            m = m.simplify_quadric_decimation(face_count=1000)
        m.fix_normals()                                # consistent outward winding
        return np.array([mni_to_mesh(p) for p in m.vertices]).tolist(), m.faces.tolist()
    return None


LEVELS = (0.5, 0.35, 0.25, 0.15, 0.1)
# (label, [cit label idxs] or None, region, parent, source, najd_vol_base)
# Bilateral CIT volumes are split by hemisphere; Najdenovska SPAMs are already
# per-hemisphere (left vols 0-6, right vols 7-13).
plan = []
plan.append(("Globus pallidus external", [CIT["gpe"]], "Telencephalon", "Globus pallidus", CIT_SRC, None))
plan.append(("Globus pallidus internal", [CIT["gpi"]], "Telencephalon", "Globus pallidus", CIT_SRC, None))
plan.append(("Subthalamic nucleus", [CIT["stn"]], "Diencephalon", None, CIT_SRC, None))
plan.append(("Substantia nigra", [CIT["snc"], CIT["snr"]], "Mesencephalon", None, CIT_SRC, None))
plan.append(("Nucleus accumbens", [CIT["accumbens"]], "Telencephalon", None, CIT_SRC, None))
for i, nm in enumerate(THAL_NAMES):
    plan.append((nm, None, "Diencephalon", "Thalamus", NAJ_SRC, i))

for label, cit_labs, region, parent, source, naj_base in plan:
    for side, suf in (("left", ".l"), ("right", ".r")):
        if cit_labs is not None:                       # bilateral CIT volume
            vol = sum(cit_prob[..., l-1] for l in cit_labs)
            out = solid(vol, cit_aff, LEVELS, side=side, x_grid=cit_x)
        else:                                          # per-hemisphere Najdenovska SPAM
            vidx = naj_base + (0 if side == "left" else 7)
            out = solid(thal_spam[..., vidx], thal_aff, LEVELS)
        if out is None:
            print(f"[gen] {label}{suf}: EMPTY (skipped)")
            continue
        verts, faces = out
        node = {"verts": verts, "faces": faces, "label": label, "side": side,
                "region": region, "category": "deep_grey", "source": source}
        if parent:
            node["parent"] = parent
            node["category"] = "diencephalon" if parent == "Thalamus" else "deep_grey"
        artifacts["meshes"][f"{label}{suf}"] = node
        print(f"[gen] {label}{suf}: {len(verts)} v, {len(faces)} f  ({source})")


def add_group(label, suf, side, out, region, category, parent, source):
    if out is None:
        print(f"[gen] {label}{suf}: EMPTY (skipped)")
        return
    verts, faces = out
    artifacts["meshes"][f"{label}{suf}"] = {
        "verts": verts, "faces": faces, "label": label, "side": side,
        "region": region, "category": category, "source": source, "parent": parent}
    print(f"[gen] {label}{suf}: {len(verts)} v, {len(faces)} f  ({source})")


# Amygdala: deterministic bilateral atlas -> binary mask per group, split by x.
amyg_x, _, _ = mm_grid(amyg_aff, amyg.shape)
for label, ids in AMY_GROUPS.items():
    mask = np.isin(amyg, ids).astype(float)
    for side, suf in (("left", ".l"), ("right", ".r")):
        out = solid(mask, amyg_aff, [0.5], side=side, x_grid=amyg_x)
        add_group(label, suf, side, out, "Telencephalon", "deep_grey", "Amygdaloid body", AMY_SRC)

# Hypothalamus: hemisphere-explicit labels (right=odd id, left=id+1) -> binary mask.
for label, rids in HYP_GROUPS.items():
    for side, suf in (("left", ".l"), ("right", ".r")):
        ids = [r + 1 for r in rids] if side == "left" else rids
        mask = np.isin(hyp, ids).astype(float)
        out = solid(mask, hyp_aff, [0.5]) if mask.max() > 0 else None
        add_group(label, suf, side, out, "Diencephalon", "diencephalon", "Hypothalamus", HYP_SRC)

with open(OUT, "w") as fh:
    json.dump(artifacts, fh)
print(f"[done] wrote {OUT}")

# Persist the registration so future work (more nuclei, fMRI/MNI overlays) can map
# MNI mm <-> mesh space without re-fitting. See docs/registration.md.
AFFINE = os.path.join(DATA, "registration_affine.json")
with open(AFFINE, "w") as fh:
    json.dump({
        "note": "Row-vector convention: mesh_xyz1 = T @ mni_xyz1; mni_xyz1 = Tinv @ mesh_xyz1.",
        "space_from": "MNI152 mm (RAS)", "space_to": "Z-Anatomy mesh world (Blender, metres)",
        "mni_to_mesh": T.tolist(), "mesh_to_mni": Tinv.tolist(),
        "mesh_units_per_mm": float(scale),
        "landmarks": [p[0] for p in pairs],
        "residual_mm_mean": float(res.mean()/scale),
        "residual_mm_max": float(res.max()/scale),
    }, fh, indent=1)
print(f"[done] wrote {AFFINE}")

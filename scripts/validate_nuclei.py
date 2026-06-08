"""Validation / control for the nuclei registration (plain Python).

Independent checks that the MNI atlases line up with the model's mesh dimensions,
beyond the in-sample fit residual reported by build_nuclei.py:

  1. Leave-one-out cross-validation: refit the affine without each landmark and
     predict it. Mean LOO error estimates how well the fit generalises.
  2. Held-out control: Red nucleus ships with Z-Anatomy (brainstem) and exists in
     CIT168 but is NOT a landmark, so the gap between its atlas-predicted position
     and its true mesh position is a fully out-of-sample accuracy measure.
  3. Scale / anisotropy: singular values of the affine's linear block show whether
     the model's brain proportions match the MNI template (near-isotropic = good).

Run:  python scripts/validate_nuclei.py
"""
import json, os, numpy as np, nibabel as nib

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "atlas_data")
cit_det = np.asanyarray(nib.load(os.path.join(DATA, "CIT168toMNI152-2009c_det.nii.gz")).dataobj).astype(int)
cit_aff = nib.load(os.path.join(DATA, "CIT168toMNI152-2009c_det.nii.gz")).affine
thal_max_img = nib.load(os.path.join(DATA, "Thalamus_Nuclei-HCP-MaxProb.nii.gz"))
thal_max = np.asanyarray(thal_max_img.dataobj).astype(int)
thal_aff = thal_max_img.affine
reg = json.load(open(os.path.join(DATA, "registration_input.json")))

CIT = {"putamen":1, "caudate":2, "gpe":5, "gpi":6, "rn":8, "hypothalamus":14, "mammillary":15}


def mm_grid_x(affine, shape):
    i, j, k = np.indices(shape)
    return affine[0, 0]*i + affine[0, 1]*j + affine[0, 2]*k + affine[0, 3]


def centroid(det, affine, labs, side=None):
    mask = np.isin(det, labs)
    if side is not None:
        x = mm_grid_x(affine, det.shape)
        mask &= (x < 0) if side == "left" else (x > 0)
    return nib.affines.apply_affine(affine, np.argwhere(mask)).mean(0)


# Paired landmarks (same set build_nuclei.py fits on)
mesh_c = reg["centroids"]
pairs = []
for side, suf in (("left", ".l"), ("right", ".r")):
    pairs.append((f"caudate{suf}", mesh_c[f"Caudate nucleus{suf}"], centroid(cit_det, cit_aff, CIT["caudate"], side)))
    pairs.append((f"putamen{suf}", mesh_c[f"Putamen{suf}"], centroid(cit_det, cit_aff, CIT["putamen"], side)))
    pairs.append((f"gp{suf}", mesh_c[f"Globus pallidus{suf}"], centroid(cit_det, cit_aff, [CIT["gpe"], CIT["gpi"]], side)))
    pairs.append((f"mammillary{suf}", mesh_c[f"Mamillary body{suf}"], centroid(cit_det, cit_aff, CIT["mammillary"], side)))
    rng = list(range(1, 8)) if side == "left" else list(range(8, 15))
    pairs.append((f"thalamus{suf}", mesh_c[f"Thalamus{suf}"], centroid(thal_max, thal_aff, rng, side)))
pairs.append(("hypothalamus", mesh_c["Hypothalamus"], centroid(cit_det, cit_aff, CIT["hypothalamus"])))

names = [p[0] for p in pairs]
mesh = np.array([p[1] for p in pairs])
mni = np.array([p[2] for p in pairs])


def fit(mni_pts, mesh_pts):
    X = np.hstack([mni_pts, np.ones((len(mni_pts), 1))])
    coef, *_ = np.linalg.lstsq(X, mesh_pts, rcond=None)
    return coef


def predict(coef, p):
    return np.append(p, 1.0) @ coef


coef_all = fit(mni, mesh)
scale = np.mean(np.linalg.norm(coef_all[:3, :], axis=0))   # mesh units per mm


def mm(v):   # mesh-unit distance -> mm
    return v / scale


# 1. in-sample residual
res = np.linalg.norm((np.hstack([mni, np.ones((len(mni), 1))]) @ coef_all) - mesh, axis=1)
print(f"[in-sample]  mean {mm(res.mean()):.2f} mm  max {mm(res.max()):.2f} mm  (n={len(pairs)})")

# 2. leave-one-out cross-validation
loo = []
for i in range(len(pairs)):
    m = np.delete(mni, i, 0); s = np.delete(mesh, i, 0)
    p = predict(fit(m, s), mni[i])
    loo.append(np.linalg.norm(p - mesh[i]))
loo = np.array(loo)
print(f"[leave-1-out] mean {mm(loo.mean()):.2f} mm  max {mm(loo.max()):.2f} mm")
worst = np.argsort(loo)[::-1][:3]
for i in worst:
    print(f"    worst LOO: {names[i]:16s} {mm(loo[i]):5.2f} mm")

# 3. held-out control: Red nucleus (never a landmark)
print("[control: Red nucleus]  atlas-predicted vs true mesh position")
for side, suf in (("left", ".l"), ("right", ".r")):
    true = np.array(reg["controls"][f"Red nucleus{suf}"])
    pred = predict(coef_all, centroid(cit_det, cit_aff, CIT["rn"], side))
    print(f"    {suf}: {mm(np.linalg.norm(pred - true)):.2f} mm")

# 4. scale / anisotropy of the model vs MNI template
sv = np.linalg.svd(coef_all[:3, :], compute_uv=False)   # mesh units per mm per axis
print(f"[scale] {scale*1000:.3f} mesh-units/mm "
      f"| per-axis stretch {np.round(sv/sv.mean(), 3)} (1.0 = isotropic match)")
print(f"        anisotropy {(sv.max()/sv.min()-1)*100:.1f}% "
      f"(how much the model brain departs from MNI proportions)")

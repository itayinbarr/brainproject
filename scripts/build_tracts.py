"""Tract pass 1 (plain Python: nibabel/numpy/scipy/scikit-image).

Turns the HCP1065 population-averaged white-matter tracts (Yeh 2022, CC BY-SA 4.0,
ICBM 2009a / MNI152 space) into centerline polylines in the model's mesh space, so the
Blender pass can sweep each one into a tube. Reuses the registration affine already
fitted for the deep nuclei (scripts/atlas_data/registration_affine.json) - it is NOT
refitted here; the same MNI->mesh transform that places the nuclei places the tracts.

Each averaged tract is a binary envelope of the whole bundle. We:
  1. skeletonise the envelope (skimage) to a 1-voxel-wide medial axis,
  2. take the longest geodesic path through it (the main trunk; fans/branches drop out),
  3. smooth that path with a spline and resample it,
  4. map the points MNI mm -> mesh world with the affine.

Only real named pathways are emitted. Tracts the base model already owns as structures
(corpus callosum, anterior commissure, fornix) and the cranial nerves (already tubes in
the model) are skipped. The small brainstem tracts that no open in-vivo atlas resolves
(rubrospinal, vestibulospinal, tectospinal, spinothalamic, lateral lemniscus, MLF,
central tegmental) are simply absent from the source and so are not produced.

Atlas (downloaded into scripts/atlas_data/tracts, not redistributed raw):
  HCP1065 averaged tracts - Yeh (2022) Nat Commun; CC BY-SA 4.0
  github.com/frankyeh/data-atlas (release hcp1065, hcp1065_avg_tracts_nifti.zip)

Run:  python scripts/build_tracts.py
Output: scripts/atlas_data/tract_artifacts.json
"""
import json, os, glob, numpy as np, nibabel as nib
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from scipy.interpolate import splprep, splev
from scipy import ndimage
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "atlas_data")
TRACTS_DIR = os.path.join(DATA, "tracts")               # unzipped hcp1065 nifti/<category>/<ABBR>.nii.gz
AFFINE = os.path.join(DATA, "registration_affine.json")
SHELL = os.path.join(DATA, "brain_shell.npz")           # parenchyma hull (scripts/export_shell.py)
CENTROIDS = os.path.join(DATA, "mesh_centroids.json")   # per-structure centroids (validation)
OUT = os.path.join(DATA, "tract_artifacts.json")

SRC = "HCP1065 (Yeh 2022, CC BY-SA 4.0)"
N_RESAMPLE = 60                 # points per centerline after smoothing
RADIUS_MM = 1.1                 # tube radius (mesh-space radius = RADIUS_MM * mesh_units_per_mm)
MIN_SKELETON = 40               # voxels; skip anything thinner (degenerate)

# Reuse the MNI->mesh affine fitted in build_nuclei.py. Do not refit.
R = json.load(open(AFFINE))
T = np.array(R["mni_to_mesh"])
SCALE = float(R["mesh_units_per_mm"])

# Tract config keyed by file abbreviation stem (without _L/_R). Each entry:
#   (display label, region, decussation note). Side comes from the filename suffix.
# Region drives the manifest "region" tag; decussation is authored anatomy (where the
# pathway crosses the midline), surfaced as metadata + Learn text.
TRACTS = {
    # --- projection / brainstem ------------------------------------------------
    "CST":   ("Corticospinal tract", "Brainstem",
              "Pyramidal decussation in the caudal medulla; ~85-90% of fibres cross to form the lateral corticospinal tract, the rest descend as the anterior corticospinal tract and cross segmentally."),
    "CBT":   ("Corticobulbar tract", "Brainstem",
              "Bilateral: fibres cross near each brainstem motor nucleus, so most cranial-nerve motor nuclei receive both hemispheres (lower face and tongue are mainly contralateral)."),
    "CPT_F": ("Corticopontine tract (frontal)", "Brainstem",
              "Descends ipsilaterally to the pontine nuclei; the relayed pontocerebellar fibres then cross the midline in the middle cerebellar peduncle."),
    "CPT_P": ("Corticopontine tract (parietal)", "Brainstem",
              "Descends ipsilaterally to the pontine nuclei; relayed pontocerebellar fibres cross in the middle cerebellar peduncle."),
    "CPT_O": ("Corticopontine tract (occipital)", "Brainstem",
              "Descends ipsilaterally to the pontine nuclei; relayed pontocerebellar fibres cross in the middle cerebellar peduncle."),
    "ML":    ("Medial lemniscus", "Brainstem",
              "Carries already-crossed fibres: the sensory (internal arcuate) decussation is in the caudal medulla, so the lemniscus is contralateral to its dorsal-column origin."),
    "RST":   ("Reticulospinal tract", "Brainstem",
              "Medial (pontine) reticulospinal fibres descend largely uncrossed; the lateral (medullary) component projects bilaterally."),
    "DRTT":  ("Dentatorubrothalamic tract", "Brainstem",
              "Crosses at the decussation of the superior cerebellar peduncle (caudal midbrain) to reach the contralateral red nucleus and thalamus - the principal cerebellar output to the cortex."),
    "OR":    ("Optic radiation", "Occipital lobe",
              "Post-chiasmal: the hemidecussation is at the optic chiasm, upstream of this tract, so each radiation carries the contralateral visual hemifield."),
    "AR":    ("Acoustic radiation", "Temporal lobe",
              "Ipsilateral thalamocortical leg (medial geniculate to Heschl's gyrus); the auditory pathway is already bilaterally distributed in the brainstem."),
    "TR_A":  ("Anterior thalamic radiation", "Diencephalon",
              "Ipsilateral thalamocortical projection; does not cross the midline."),
    "TR_S":  ("Superior thalamic radiation", "Diencephalon",
              "Ipsilateral thalamocortical projection (carries somatosensory fibres to S1); does not cross the midline."),
    "TR_P":  ("Posterior thalamic radiation", "Diencephalon",
              "Ipsilateral thalamocortical projection; does not cross the midline."),
    "CS_A":  ("Corticostriatal tract (anterior)", "Telencephalon",
              "Ipsilateral corticostriatal projection; does not cross the midline."),
    "CS_S":  ("Corticostriatal tract (superior)", "Telencephalon",
              "Ipsilateral corticostriatal projection; does not cross the midline."),
    "CS_P":  ("Corticostriatal tract (posterior)", "Telencephalon",
              "Ipsilateral corticostriatal projection; does not cross the midline."),
    # --- cerebellar peduncles --------------------------------------------------
    "SCP":   ("Superior cerebellar peduncle", "Cerebellum",
              "Its efferent fibres cross at the decussation of the superior cerebellar peduncle in the caudal midbrain."),
    "MCP":   ("Middle cerebellar peduncle", "Cerebellum",
              "Carries pontocerebellar fibres that have already crossed the midline in the pons, linking each pontine nucleus to the contralateral cerebellar hemisphere."),
    "ICP":   ("Inferior cerebellar peduncle", "Cerebellum",
              "Mixed: olivocerebellar fibres are crossed, while the posterior spinocerebellar input is largely uncrossed."),
    # --- association (intrahemispheric) ---------------------------------------
    "AF":    ("Arcuate fasciculus", None,
              "Intrahemispheric association tract (arching from temporal to frontal cortex); does not cross the midline."),
    "SLF1":  ("Superior longitudinal fasciculus I", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "SLF2":  ("Superior longitudinal fasciculus II", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "SLF3":  ("Superior longitudinal fasciculus III", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "IFOF":  ("Inferior fronto-occipital fasciculus", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "ILF":   ("Inferior longitudinal fasciculus", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "MdLF":  ("Middle longitudinal fasciculus", None,
              "Intrahemispheric association tract; does not cross the midline."),
    "UF":    ("Uncinate fasciculus", None,
              "Intrahemispheric association tract (hooking frontal to anterior temporal); does not cross the midline."),
    "FAT":   ("Frontal aslant tract", None,
              "Intrahemispheric association tract; does not cross the midline."),
}

# Region depends on hemisphere for association tracts (no fixed lobe in TRACTS).
ASSOC_REGION = {"left": "Left cerebral hemisphere", "right": "Right cerebral hemisphere",
                "median": "Telencephalon"}


def stem_and_side(fname):
    """'CST_L' -> ('CST','left'); 'MCP' -> ('MCP','median')."""
    base = fname[:-len(".nii.gz")]
    if base.endswith("_L"):
        return base[:-2], "left"
    if base.endswith("_R"):
        return base[:-2], "right"
    return base, "median"


def centerline_mm(img):
    """Longest-geodesic medial-axis polyline of a binary tract envelope, in MNI mm.
    Returns None if the skeleton is degenerate."""
    vol = np.asanyarray(img.dataobj)
    mask = vol > (0.5 * vol.max()) if vol.max() > 1 else vol > 0
    sk = skeletonize(mask)
    pts = np.argwhere(sk)
    if len(pts) < MIN_SKELETON:
        return None
    # 26-connectivity graph over skeleton voxels
    pairs = cKDTree(pts).query_pairs(r=np.sqrt(3) + 1e-6, output_type="ndarray")
    if len(pairs) == 0:
        return None
    w = np.linalg.norm((pts[pairs[:, 0]] - pts[pairs[:, 1]]).astype(float), axis=1)
    n = len(pts)
    M = csr_matrix((np.r_[w, w], (np.r_[pairs[:, 0], pairs[:, 1]],
                                  np.r_[pairs[:, 1], pairs[:, 0]])), shape=(n, n))
    # work within the largest connected component
    _, lab = connected_components(M, directed=False)
    nodes = np.where(lab == np.bincount(lab).argmax())[0]
    sub = M[nodes][:, nodes]
    # double sweep -> the two farthest-apart endpoints (graph "diameter")
    d0 = dijkstra(sub, indices=0)
    a = int(np.argmax(np.where(np.isinf(d0), -1, d0)))
    da, pred = dijkstra(sub, indices=a, return_predecessors=True)
    b = int(np.argmax(np.where(np.isinf(da), -1, da)))
    path = []
    cur = b
    while cur >= 0:
        path.append(cur)
        if cur == a:
            break
        cur = pred[cur]
    path = nodes[path[::-1]]
    return nib.affines.apply_affine(img.affine, pts[path])    # voxel -> MNI mm


def smooth_resample(mm, n=N_RESAMPLE):
    """Spline-smooth a noisy voxel polyline and resample to n points (MNI mm)."""
    if len(mm) < 4:
        return mm
    # drop duplicate consecutive points (splprep requires strictly increasing param)
    keep = np.r_[True, np.any(np.diff(mm, axis=0) != 0, axis=1)]
    mm = mm[keep]
    if len(mm) < 4:
        return mm
    k = min(3, len(mm) - 1)
    # smoothing factor scaled to path length so we follow the trunk, not the voxel jitter
    s = len(mm) * 2.0
    (tck, _) = splprep(mm.T, k=k, s=s)
    u = np.linspace(0, 1, n)
    return np.array(splev(u, tck)).T


class Clipper:
    """Keeps a tract centerline inside the brain. The deep-grey-anchored affine stretches
    laterally (~1.26x in x), so cortical tract ends overshoot the narrower BodyParts3D
    cortex and the tubes poke out the side. We voxelise the parenchyma into a solid mask
    and snap any out-of-brain point inward to the nearest point that is >=1 voxel inside,
    so the tube hugs the surface instead of piercing it."""

    def __init__(self, pitch_mm=1.2):
        d = np.load(SHELL)
        shell = trimesh.Trimesh(d["verts"], d["faces"], process=False)
        self.vox = shell.voxelized(pitch=pitch_mm * SCALE).fill()
        self.M = self.vox.matrix
        self.Tinv = np.linalg.inv(self.vox.transform)
        eroded = ndimage.binary_erosion(self.M, iterations=1)        # >=1 voxel inside
        centers = trimesh.transform_points(np.argwhere(eroded).astype(float), self.vox.transform)
        self.snap = cKDTree(centers)

    def inside(self, pts):
        idx = np.round(trimesh.transform_points(np.atleast_2d(pts), self.Tinv)).astype(int)
        ok = np.all((idx >= 0) & (idx < np.array(self.M.shape)), axis=1)
        r = np.zeros(len(idx), bool)
        r[ok] = self.M[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
        return r

    def clip(self, pts):
        """Snap outside points in, lightly smooth the kinks that introduces, snap again."""
        pts = np.asarray(pts, float)
        n_out = 0
        for _ in range(2):
            out = ~self.inside(pts)
            n_out = max(n_out, int(out.sum()))
            if out.any():
                _, j = self.snap.query(pts[out])
                pts[out] = self.snap.data[j]
            # gentle 3-point moving average on interior points (keeps the ends put)
            sm = pts.copy()
            sm[1:-1] = (pts[:-2] + pts[1:-1] + pts[2:]) / 3.0
            pts = sm
        out = ~self.inside(pts)                                       # final guarantee
        if out.any():
            _, j = self.snap.query(pts[out])
            pts[out] = self.snap.data[j]
        return pts, n_out


def load_centroid_tree():
    cen = json.load(open(CENTROIDS))
    names = list(cen.keys())
    coords = np.array([cen[k] for k in names])
    return names, coords, cKDTree(coords)


def main():
    files = sorted(glob.glob(os.path.join(TRACTS_DIR, "*", "*.nii.gz")))
    if not files:
        raise SystemExit(f"no tract NIfTI under {TRACTS_DIR} - unzip hcp1065_avg_tracts_nifti.zip there")
    clipper = Clipper() if os.path.exists(SHELL) else None
    if clipper is None:
        print("[warn] no brain_shell.npz - skipping clip/validation (run scripts/export_shell.py)")
    cen_names, cen_coords, cen_tree = (load_centroid_tree() if os.path.exists(CENTROIDS)
                                       else (None, None, None))

    def nearest_structure(pt):
        d, i = cen_tree.query(pt)
        return cen_names[i], d / SCALE

    artifacts = {"source": SRC, "space": "ICBM152 / MNI152", "tracts": {}}
    made = skipped = 0
    report = []
    for f in files:
        stem, sd = stem_and_side(os.path.basename(f))
        if stem not in TRACTS:
            continue                                  # duplicates (CC/AC/F), cranial nerves, region bundles
        label, region, decuss = TRACTS[stem]
        if region is None:
            region = ASSOC_REGION[sd]
        mm = centerline_mm(nib.load(f))
        if mm is None:
            print(f"[skip] {stem}{'' if sd=='median' else '_'+sd[0].upper()}: degenerate skeleton")
            skipped += 1
            continue
        mm = smooth_resample(mm)
        mesh_pts = nib.affines.apply_affine(T, mm)            # MNI mm -> mesh world
        n_out = 0
        if clipper is not None:
            mesh_pts, n_out = clipper.clip(mesh_pts)
        suf = {"left": ".l", "right": ".r", "median": ""}[sd]
        name = f"{label}{suf}"
        artifacts["tracts"][name] = {
            "points": mesh_pts.tolist(),
            "radius": RADIUS_MM * SCALE,
            "label": label, "side": sd, "region": region,
            "source": SRC, "decussation": decuss,
        }
        length_mm = np.linalg.norm(np.diff(mesh_pts, axis=0), axis=1).sum() / SCALE
        print(f"[tract] {name:42s} {len(mesh_pts)} pts, {length_mm:5.0f} mm, clipped {n_out:2d}")
        if cen_tree is not None:
            a_lbl, a_d = nearest_structure(mesh_pts[0])
            b_lbl, b_d = nearest_structure(mesh_pts[-1])
            report.append((name, a_lbl, a_d, b_lbl, b_d, n_out))
        made += 1

    with open(OUT, "w") as fh:
        json.dump(artifacts, fh)
    print(f"[done] {made} tracts ({skipped} skipped) -> {OUT}")

    # Endpoint validation: each tract should start/end near a sensible structure.
    if report:
        print("\n[validate] nearest structure at each endpoint (mm to its centroid):")
        print(f"  {'tract':42s} {'endpoint A':28s} {'endpoint B':28s} clip")
        for name, a_lbl, a_d, b_lbl, b_d, n_out in sorted(report):
            print(f"  {name:42s} {a_lbl[:22]:22s} {a_d:4.0f}  {b_lbl[:22]:22s} {b_d:4.0f}  {n_out:3d}")


if __name__ == "__main__":
    main()

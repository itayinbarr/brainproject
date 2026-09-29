"""Extra registered structures, built straight onto brain.glb (no Blender needed).

Same method as build_nuclei.py / build_tracts.py - one global MNI -> mesh affine,
marching-cubed solids for nuclei, spline centerlines swept into tubes for tracts - but
it works in the GLB's own (glTF, Y-up) frame, using the affine recovered from the
shipped model by recover_affine.py. Nothing already in the model is modified.

Sources (MNI152NLin2009cAsym / ICBM152, downloaded into scripts/atlas_data, gitignored):
  - MASSP 2.0 subcortical parcellation - Alkemade, Bazin et al. (AHEAD 7T data),
    CC BY 4.0. TemplateFlow tpl-MNI152NLin2009cAsym_res-01_atlas-MASSP20_dseg.nii.gz
  - HCP1065 averaged tracts - Yeh 2022, CC BY-SA 4.0 (the file build_tracts.py uses)

Every candidate is scored before it is kept:
  - placement agreement: MASSP vs the structures the model already registered from
    CIT168/Najdenovska (printed by --check; ~0.4-3.4 mm),
  - containment: % of the solid's volume inside the brain parenchyma, and for brainstem
    nuclei inside the Z-Anatomy brainstem,
  - collisions: % of the solid's volume buried inside existing structures,
  - tracts: endpoint sanity (nearest named structure) and how much was clipped.

Run:  node scripts/glb_io.mjs dump brain-atlas/models/brain.glb scripts/atlas_data/glb_dump.json
      python scripts/recover_affine.py
      python scripts/build_extra.py            # -> scripts/atlas_data/extra_artifacts.json
      node scripts/glb_io.mjs merge brain-atlas/models/brain.glb scripts/atlas_data/extra_artifacts.json \
           brain-atlas/models/manifest.json brain-atlas/models/brain.glb
      python scripts/gen_data.py
"""
import json, os, re, sys, numpy as np, nibabel as nib, trimesh
from skimage import measure
from scipy import ndimage
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recover_affine import load_glb_meshes           # noqa: E402
import build_tracts as bt                             # centerline + spline code, unchanged  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "atlas_data")
MASSP = os.path.join(DATA, "tpl-MNI152NLin2009cAsym_res-01_atlas-MASSP20_dseg.nii.gz")
TRACTS_DIR = os.path.join(DATA, "tracts", "nifti")
OUT = os.path.join(DATA, "extra_artifacts.json")

R = json.load(open(os.path.join(DATA, "registration_affine_glb.json")))
T = np.array(R["mni_to_mesh"])
SCALE = float(R["mesh_units_per_mm"])

MASSP_SRC = "MASSP 2.0 (Alkemade & Bazin, CC BY 4.0)"
HCP_SRC = "HCP1065 (Yeh 2022, CC BY-SA 4.0)"

# MASSP 2.0 label ids (TemplateFlow dseg.tsv). (label, {side: [ids]}, category, region, parent)
# Structures the model already has (striatum, GP, STN, SN, RN, thalamus, amygdala,
# colliculi, habenula, geniculates, ventricles, fornix, commissures) are not re-added;
# hippocampal subfields stay deferred (see docs/registration.md section 6).
NUCLEI = [
    ("Ventral tegmental area", {"left": [23], "right": [24]}, "deep_grey", "Mesencephalon", None),
    ("Periaqueductal grey", {"median": [26, 27]}, "brainstem", "Brainstem", None),
    ("Pedunculopontine nucleus", {"left": [28], "right": [29]}, "brainstem", "Brainstem", None),
    ("Dorsal raphe nucleus", {"median": [58]}, "brainstem", "Brainstem", "Raphe nuclei"),
    ("Median raphe nucleus", {"median": [59]}, "brainstem", "Brainstem", "Raphe nuclei"),
    ("Basal forebrain cholinergic nuclei", {"left": [56], "right": [57]}, "deep_grey", "Telencephalon", None),
    ("Claustrum", {"left": [30], "right": [31]}, "deep_grey", "Telencephalon", None),
    ("Internal capsule", {"left": [21], "right": [22]}, "white_matter", "Telencephalon", None),
]

# The claustrum is a 1-2 mm sheet: meshed straight from the 1 mm labels it comes out
# perforated (genus ~23). A 0.6-voxel blur + 0.4 threshold closes most holes (genus ~5)
# for a +9% volume.
BLUR = {"Claustrum": 0.6}

# HCP1065 bundles that build_tracts.py did not emit. (label, region, crossing note)
ASSOC = "Intrahemispheric association tract; does not cross the midline."
TRACTS = {
    "C_FP":  ("Cingulum (frontal-parietal)", None,
              "Intrahemispheric limbic association bundle running inside the cingulate gyrus; does not cross the midline."),
    "C_FPH": ("Cingulum (frontal-parahippocampal)", None,
              "Intrahemispheric limbic association bundle arching from the frontal lobe round the splenium to the parahippocampal gyrus; does not cross the midline."),
    "C_PH":  ("Cingulum (parahippocampal)", None,
              "Intrahemispheric limbic association bundle (the temporal limb of the cingulum); does not cross the midline."),
    "C_PHP": ("Cingulum (parahippocampal-parietal)", None,
              "Intrahemispheric limbic association bundle linking the parahippocampal gyrus with the precuneus; does not cross the midline."),
    "C_PO":  ("Cingulum (parolfactory)", None,
              "Intrahemispheric limbic association bundle from the subcallosal/parolfactory area; does not cross the midline."),
    # EMC (extreme capsule) is deliberately NOT emitted: HCP1065's envelope and its trunk
    # run from the inferior frontal gyrus up to the superior parietal lobule (MNI z ~ 80),
    # not along the classic fronto-temporal course, so the tube would teach the wrong path.
    "PAT":   ("Parietal aslant tract", None, ASSOC),
    "VOF":   ("Vertical occipital fasciculus", None,
              "Short intrahemispheric association tract linking dorsal and ventral visual cortex; does not cross the midline."),
}

TUBE_SIDES = 8
PARENCHYMA = {"cortex", "white_matter", "deep_grey", "diencephalon", "brainstem", "cerebellum"}
BRAINSTEM_HOSTS = re.compile(r"^(Midbrain|Pons|Medulla oblongata|Base of peduncle)(\.[lr])?$")
PITCH_MM = 0.6
# The GLB's cortex is a set of gyrus/sulcus surface patches with sub-voxel gaps between
# them, so a plain hole-fill leaks and would clip far too much. Closing by 2 voxels
# (2.4 mm) seals them; with it the regenerated tubes of the *existing* tracts land on the
# shipped ones (see docs/registration.md 5d).
SHELL_CLOSE = 2
# For scoring "is this solid inside the brain" seal harder: at 2 voxels a few gaps
# remain and the score flips between hemispheres with the surface sampling.
CONTAIN_CLOSE = 3


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def mni_to_mesh(p):
    return nib.affines.apply_affine(T, p)


def solid(mask, affine, blur=0.0):
    """build_nuclei.solid() for a binary mask: marching cubes -> Taubin -> <=1000 faces,
    outward normals, then MNI -> mesh. Returns (mesh-space trimesh, MNI trimesh).
    `blur` (voxels) pre-smooths very thin sheets so the 1 mm labels do not mesh as lace."""
    vol = mask.astype(float)
    level = 0.5
    if blur:
        vol, level = ndimage.gaussian_filter(vol, blur), 0.4
    verts, faces, *_ = measure.marching_cubes(vol, level=level)
    m = trimesh.Trimesh(nib.affines.apply_affine(affine, verts), faces, process=True)
    trimesh.smoothing.filter_taubin(m, iterations=12)
    if len(m.faces) > 1000:
        m = m.simplify_quadric_decimation(face_count=1000)
    m.fix_normals()
    out = trimesh.Trimesh(mni_to_mesh(m.vertices), m.faces.copy(), process=False)
    if np.linalg.det(T[:3, :3]) < 0:        # a mirroring affine would turn the solid inside out
        out.invert()
    return out, m


def flat(m):
    """Unshared vertices + face normals: the faceted look of the other registered nuclei."""
    v = m.vertices[m.faces].reshape(-1, 3)
    n = np.repeat(m.face_normals, 3, axis=0)
    return v.tolist(), n.tolist(), np.arange(len(v)).reshape(-1, 3).tolist()


def tube(points, radius, sides=TUBE_SIDES):
    """Sweep a round tube with end caps along a polyline (parallel-transport frames),
    matching the 8-sided bevel the Blender pass bakes for tracts and nerves."""
    P = np.asarray(points, float)
    keep = np.r_[True, np.linalg.norm(np.diff(P, axis=0), axis=1) > 1e-9]   # snapping can repeat a point
    P = P[keep]
    t = np.gradient(P, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    a = np.array([0, 0, 1.0]) if abs(t[0, 2]) < 0.9 else np.array([1.0, 0, 0])
    n = np.cross(t[0], a); n /= np.linalg.norm(n)
    frames = []
    for i in range(len(P)):
        if i:
            n = n - t[i] * np.dot(n, t[i]); n /= np.linalg.norm(n)
        frames.append((n, np.cross(t[i], n)))
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    verts, norms, faces = [], [], []
    for (nn, bb), p in zip(frames, P):
        for a_ in ang:
            d = np.cos(a_) * nn + np.sin(a_) * bb
            verts.append(p + radius * d); norms.append(d)
    for i in range(len(P) - 1):
        for k in range(sides):
            a0, a1 = i * sides + k, i * sides + (k + 1) % sides
            b0, b1 = a0 + sides, a1 + sides
            faces += [[a0, b0, b1], [a0, b1, a1]]
    for end, sgn in ((0, -1), (len(P) - 1, 1)):          # flat caps, own verts for crisp normals
        base = len(verts)
        c = P[end]
        verts.append(c); norms.append(sgn * t[end])
        for k in range(sides):
            verts.append(verts[end * sides + k]); norms.append(sgn * t[end])
        for k in range(sides):
            i0, i1 = base + 1 + k, base + 1 + (k + 1) % sides
            faces.append([base, i0, i1] if sgn > 0 else [base, i1, i0])
    V = np.array(verts)
    F = np.array(faces)
    # outward winding check on the side wall
    tm = trimesh.Trimesh(V, F, process=False)
    if tm.volume < 0:
        F = F[:, ::-1]
    return V.tolist(), np.array(norms).tolist(), F.tolist()


def voxel_fill(meshes, pitch, close_iter=0):
    """Solid voxel mask of a set of closed-ish surfaces: densely sample the triangles,
    mark the voxels they touch, fill enclosed cavities. (trimesh's voxelized() subdivides
    the whole mesh and runs out of memory on the full cortex.) Returns (mask, voxel->mesh)."""
    m = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
    n = int(min(2e7, max(2e4, m.area / (0.35 * pitch) ** 2)))
    pts = np.vstack([trimesh.sample.sample_surface(m, n, seed=0)[0], m.vertices])
    pad = 2 + close_iter
    lo = pts.min(0) - pad * pitch
    ijk = np.floor((pts - lo) / pitch).astype(int)
    M = np.zeros(ijk.max(0) + pad + 1, bool)
    M[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
    if close_iter:                          # seal sub-voxel gaps between surface patches
        M = ndimage.binary_closing(M, iterations=close_iter)
    M = ndimage.binary_fill_holes(M)
    tf = np.eye(4); tf[:3, :3] *= pitch; tf[:3, 3] = lo + pitch / 2   # voxel index -> centre
    return M, tf


class Occupancy:
    """Filled voxel masks of existing meshes, for containment / collision scoring. Each
    mesh is filled on its own and the results OR-ed: filling a union leaks through the
    ventricles/aqueduct and the open midline cuts of the half-structures."""

    def __init__(self, G):
        self.G = G
        self.cache = {}

    def _one(self, name):
        if name not in self.cache:
            m = trimesh.Trimesh(*self.G[name][:2], process=False)
            M, tf = voxel_fill([m], PITCH_MM * SCALE)
            tf[:3, 3] -= PITCH_MM * SCALE / 2                                # index of containing voxel
            self.cache[name] = (M, np.linalg.inv(tf), m.bounds)
        return self.cache[name]

    def inside(self, pts, names):
        r = np.zeros(len(pts), bool)
        for n in names:
            lo, hi = self.G[n][0].min(0), self.G[n][0].max(0)
            sel = np.all((pts >= lo) & (pts <= hi), axis=1) & ~r
            if not sel.any():
                continue
            m = trimesh.Trimesh(*self.G[n][:2], process=True)
            if m.is_watertight:                               # exact ray-parity test
                hit = m.contains(pts[sel])
            else:
                M, Tinv, _ = self._one(n)
                idx = np.floor(trimesh.transform_points(pts[sel], Tinv)).astype(int)
                ok = np.all((idx >= 0) & (idx < np.array(M.shape)), axis=1)
                hit = np.zeros(sel.sum(), bool)
                hit[ok] = M[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
            r[np.where(sel)[0][hit]] = True
        return r

    def frac_inside(self, pts, names):
        return self.inside(pts, names).mean()

    def group_inside(self, pts, names, close_iter=2, pitch_mm=PITCH_MM):
        """Fill several meshes JOINTLY (e.g. the Z-Anatomy half-structures, open at the
        midline, only close up together) and test points against the result."""
        key = ("group", tuple(sorted(names)), close_iter, pitch_mm)
        if key not in self.cache:
            meshes = [trimesh.Trimesh(*self.G[n][:2], process=False) for n in names]
            M, tf = voxel_fill(meshes, pitch_mm * SCALE, close_iter)
            tf[:3, 3] -= pitch_mm * SCALE / 2
            self.cache[key] = (M, np.linalg.inv(tf))
        M, Tinv = self.cache[key]
        idx = np.floor(trimesh.transform_points(pts, Tinv)).astype(int)
        ok = np.all((idx >= 0) & (idx < np.array(M.shape)), axis=1)
        r = np.zeros(len(pts), bool)
        r[ok] = M[idx[ok, 0], idx[ok, 1], idx[ok, 2]]
        return r.mean()


def interior_points(m_mesh):
    """Voxel-centre samples filling a closed mesh (mesh space)."""
    M, tf = voxel_fill([m_mesh], 0.5 * SCALE)
    pts = trimesh.transform_points(np.argwhere(M).astype(float), tf)
    return pts[m_mesh.contains(pts)] if m_mesh.is_watertight else pts


class GlbClipper(bt.Clipper):
    """build_tracts.Clipper with the lighter voxel_fill (same 1.2 mm pitch, same snapping)."""

    def __init__(self, shell, pitch_mm=1.2, close_iter=SHELL_CLOSE):
        M, tf = voxel_fill([shell], pitch_mm * SCALE, close_iter)
        self.M, self.Tinv = M, np.linalg.inv(tf)            # inside() rounds to the nearest centre
        eroded = ndimage.binary_erosion(M, iterations=1)
        self.snap = cKDTree(trimesh.transform_points(np.argwhere(eroded).astype(float), tf))


# ---------------------------------------------------------------------------
def main():
    G = load_glb_meshes()
    occ = Occupancy(G)
    parenchyma = [n for n, (_, _, ex) in G.items()
                  if ex.get("bx_cat") in PARENCHYMA and ex.get("bx_cat") != "tracts"]
    parenchyma_shell = [n for n in parenchyma
                        if not re.search(r"ventricle|choroid plexus|septum pellucidum", n, re.I)]
    brainstem = [n for n in G if BRAINSTEM_HOSTS.match(n)]
    solids = {n: trimesh.Trimesh(*G[n][:2], process=True) for n in G
              if G[n][2].get("bx_cat") in ("deep_grey", "diencephalon", "brainstem", "white_matter",
                                           "ventricles", "cortex", "cerebellum")}
    boxes = {n: m.bounds for n, m in solids.items()}

    img = nib.load(MASSP)
    lab = np.asanyarray(img.dataobj).astype(int)
    art = {"space": "brain.glb world (glTF Y-up)", "affine_residual_mm": R["residual_mm_max"],
           "meshes": {}, "report": {}}

    print(f"{'structure':44s} {'mm3':>6s} {'brain%':>6s} {'host%':>6s}  largest overlaps with existing meshes")
    for label, sides, cat, region, parent in NUCLEI:
        for sd, ids in sides.items():
            mask = np.isin(lab, ids)
            m, m_mni = solid(mask, img.affine, BLUR.get(label, 0.0))
            suf = {"left": ".l", "right": ".r", "median": ""}[sd]
            name = f"{label}{suf}"
            pts = interior_points(m)
            brain_pct = 100 * occ.group_inside(pts, parenchyma_shell, CONTAIN_CLOSE, 1.2)
            host_pct = (100 * occ.group_inside(pts, brainstem)
                        if cat == "brainstem" or label == "Ventral tegmental area" else float("nan"))
            lo, hi = m.bounds
            hits = []
            for n, (blo, bhi) in boxes.items():
                if n in brainstem or n.startswith("White matter of telencephalon"):
                    continue
                if np.all(bhi >= lo) and np.all(blo <= hi):
                    f = occ.frac_inside(pts, [n])
                    if f > 0.02:
                        hits.append((f, n))
            hits.sort(reverse=True)
            ov = ", ".join(f"{n} {100*f:.0f}%" for f, n in hits[:4])
            print(f"{name:44s} {abs(m_mni.volume):6.0f} {brain_pct:6.0f} {host_pct:6.0f}  {ov}")
            v, nrm, f = flat(m)
            art["meshes"][name] = {"verts": v, "normals": nrm, "faces": f, "label": label,
                                   "side": sd, "category": cat, "region": region,
                                   "core": True, "source": MASSP_SRC}
            if parent:
                art["meshes"][name]["parent"] = parent
            art["report"][name] = {"volume_mm3": abs(m_mni.volume), "in_brain_pct": brain_pct,
                                   "in_brainstem_pct": None if np.isnan(host_pct) else host_pct,
                                   "overlaps": [[n, f] for f, n in hits[:6]]}

    # --- anatomical relation checks (MNI mm, via the inverse affine) ---
    Tinv = np.linalg.inv(T)

    def c_mni(verts):
        return nib.affines.apply_affine(Tinv, np.asarray(verts, float).mean(0))
    M = art["meshes"]
    pag, aq = c_mni(M["Periaqueductal grey"]["verts"]), c_mni(G["Aqueduct of midbrain"][0])
    print(f"\n[relation] PAG centroid <-> Z-Anatomy aqueduct centroid: {np.linalg.norm(pag - aq):.1f} mm "
          f"(d = {np.round(pag - aq, 1)}; the PAG should surround the aqueduct)")
    for sd, suf in (("left", ".l"), ("right", ".r")):
        vta = c_mni(M["Ventral tegmental area" + suf]["verts"])
        sn = c_mni(G["Substantia nigra" + suf][0])
        rn = c_mni(G["Red nucleus" + suf][0])
        print(f"[relation] {sd:5s} |x| VTA {abs(vta[0]):4.1f} < SN {abs(sn[0]):4.1f} mm (VTA medial to SN: "
              f"{abs(vta[0]) < abs(sn[0])}); VTA-RN {np.linalg.norm(vta - rn):.1f} mm")
    art["report"]["_relations"] = {"pag_to_aqueduct_mm": float(np.linalg.norm(pag - aq))}

    # --- tracts: exactly build_tracts.py's centerline + clip, then our own tube sweep ---
    bt.T, bt.SCALE = T, SCALE
    shell = trimesh.util.concatenate([trimesh.Trimesh(*G[n][:2], process=False) for n in parenchyma_shell])
    bt.SHELL = os.path.join(DATA, "brain_shell_glb.npz")
    np.savez_compressed(bt.SHELL, verts=shell.vertices, faces=shell.faces)
    clipper = GlbClipper(shell)
    cen_names = [n for n in G if G[n][2].get("bx_cat") not in ("tracts", "arteries", "veins_sinuses",
                                                               "cranial_nerves", "meninges_dura")]
    cen = np.array([G[n][0].mean(0) for n in cen_names])
    tree = cKDTree(cen)
    print(f"\n{'tract':44s} {'pts':>3s} {'mm':>5s} clip  endpoint A / endpoint B (nearest structure centroid, mm)")
    for stem, (label, region, note) in TRACTS.items():
        for sd, suf, fs in (("left", ".l", "_L"), ("right", ".r", "_R")):
            f = os.path.join(TRACTS_DIR, "association", f"{stem}{fs}.nii.gz")
            mm = bt.centerline_mm(nib.load(f))
            if mm is None:
                print(f"[skip] {stem}{fs}: degenerate skeleton"); continue
            mm = bt.smooth_resample(mm)
            pts, n_out = clipper.clip(mni_to_mesh(mm))
            length = np.linalg.norm(np.diff(pts, axis=0), axis=1).sum() / SCALE
            da, ia = tree.query(pts[0]); db, ib = tree.query(pts[-1])
            name = f"{label}{suf}"
            print(f"{name:44s} {len(pts):3d} {length:5.0f} {n_out:4d}  "
                  f"{cen_names[ia][:30]} {da/SCALE:3.0f} / {cen_names[ib][:30]} {db/SCALE:3.0f}")
            v, nrm, fc = tube(pts, bt.RADIUS_MM * SCALE)
            art["meshes"][name] = {"verts": v, "normals": nrm, "faces": fc, "label": label, "side": sd,
                                   "category": "tracts",
                                   "region": region or bt.ASSOC_REGION[sd], "core": False,
                                   "source": HCP_SRC, "decussation": note}
            art["report"][name] = {"length_mm": length, "clipped_pts": n_out,
                                   "end_a": [cen_names[ia], da / SCALE], "end_b": [cen_names[ib], db / SCALE]}

    json.dump(art, open(OUT, "w"))
    print(f"\n[done] {len(art['meshes'])} meshes -> {OUT}")


if __name__ == "__main__":
    main()

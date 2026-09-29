// Read / extend brain.glb without Blender.
//
//   node scripts/glb_io.mjs dump  <in.glb> <out.json>
//       Decode (Draco) and write every node's name, extras, world-space POSITION and
//       indices as JSON for the Python passes (recover_affine.py, build_extra.py).
//       export_brain.py bakes world transforms into the vertices, so local == world.
//
//   node scripts/glb_io.mjs merge <in.glb> <extra_artifacts.json> <manifest.json> <out.glb>
//       Append the meshes from build_extra.py as new nodes carrying the same bx_* extras
//       the Blender exporter writes, append matching manifest nodes (ids continue after
//       the current maximum), then Draco-encode like the README pipeline. Existing meshes are
//       left untouched (no re-weld), only re-encoded.
//       Re-running is idempotent: nodes whose name is already in the GLB are replaced
//       in place and keep their bx_id, so shared links stay valid.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';

const [mode, ...args] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

if (mode === 'dump') {
  const [inGlb, outJson] = args;
  const doc = await io.read(inGlb);
  const out = doc.getRoot().listNodes().map((n) => {
    const p = n.getMesh().listPrimitives()[0];
    const idx = p.getIndices();
    return { name: n.getName(), extras: n.getExtras(),
             pos: Array.from(p.getAttribute('POSITION').getArray()),
             idx: idx ? Array.from(idx.getArray()) : null };
  });
  fs.writeFileSync(outJson, JSON.stringify(out));
  console.log(`[dump] ${out.length} nodes -> ${outJson}`);
} else if (mode === 'merge') {
  const [inGlb, artJson, maniJson, outGlb] = args;
  const doc = await io.read(inGlb);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const buffer = root.listBuffers()[0];
  const art = JSON.parse(fs.readFileSync(artJson, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(maniJson, 'utf8'));

  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  let nextId = Math.max(...manifest.nodes.map((n) => n.id)) + 1;
  let added = 0, replaced = 0;
  for (const [name, m] of Object.entries(art.meshes)) {
    const prior = byName.get(name);
    const id = prior ? prior.getExtras().bx_id : nextId++;
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.verts.flat())).setBuffer(buffer);
    const nor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.normals.flat())).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.faces.flat())).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setIndices(idx);
    const mesh = doc.createMesh(name).addPrimitive(prim);
    const extras = { bx_id: id, bx_cat: m.category, bx_label: m.label, bx_side: m.side,
                     bx_region: m.region, bx_core: m.core ? 1 : 0, bx_source: m.source };
    if (m.parent) extras.bx_parent = m.parent;
    if (m.decussation) extras.bx_decussation = m.decussation;
    if (prior) {
      const old = prior.getMesh();
      prior.setMesh(mesh).setExtras(extras);
      old.listPrimitives().forEach((p) => p.dispose());
      old.dispose();
      replaced++;
    } else {
      scene.addChild(doc.createNode(name).setMesh(mesh).setExtras(extras));
      added++;
    }
    const node = { id, name, label: m.label, category: m.category, side: m.side,
                   region: m.region, core: !!m.core, ta2: m.ta2 || [], source: m.source };
    if (m.parent) node.parent = m.parent;
    if (m.decussation) node.decussation = m.decussation;
    const at = manifest.nodes.findIndex((n) => n.id === id);
    if (at >= 0) manifest.nodes[at] = node; else manifest.nodes.push(node);
  }
  // category counts
  const counts = {};
  for (const n of manifest.nodes) counts[n.category] = (counts[n.category] || 0) + 1;
  for (const [c, k] of Object.entries(counts)) {
    manifest.categories[c] = { ...(manifest.categories[c] || { label: c }), count: k };
  }
  // No dedup/weld here: re-welding would touch the existing (already optimised) meshes
  // and drop their degenerate triangles. The new meshes are written compact already.
  doc.createExtension(KHRDracoMeshCompression).setRequired(true)
    .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });
  await io.write(outGlb, doc);
  fs.writeFileSync(maniJson, JSON.stringify(manifest, null, 1));
  console.log(`[merge] +${added} new, ${replaced} replaced -> ${outGlb} ` +
              `(${(fs.statSync(outGlb).size / 1e6).toFixed(2)} MB); manifest ${manifest.nodes.length} nodes`);
} else {
  console.error('usage: glb_io.mjs dump <in.glb> <out.json> | merge <in.glb> <art.json> <manifest.json> <out.glb>');
  process.exit(1);
}

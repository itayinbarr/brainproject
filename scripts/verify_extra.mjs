// Headless check + screenshots for the structures added by build_extra.py.
//   node scripts/verify_extra.mjs [outDir]
// Serves brain-atlas/, asserts the app boots without errors and that every new node is
// in window.BRAIN (with a description) and has a mesh in the scene, then drives the real
// viewer through window.__BA (the scene API the UI uses): isolate each group of new
// structures with existing neighbours, tint them per structure + a legend (screenshot
// only; the app keeps its subsystem palette), orbit, and save a PNG per view.
//
// Env: CHROMIUM_PATH - use a pre-installed Chromium instead of Playwright's pinned build.
//      CDN_MIRROR    - dir holding node_modules/{three,react,react-dom,@babel/standalone}
//                      at the pinned versions; unpkg requests are served from it and
//                      other third-party hosts (analytics, fonts) are dropped. For
//                      sandboxes without CDN access.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || '/tmp/brain_extra_shots');
const ROOT = path.resolve('brain-atlas');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
await mkdir(OUT, { recursive: true });

const NEW_TRACTS = ['Cingulum (frontal-parietal)', 'Cingulum (frontal-parahippocampal)', 'Cingulum (parahippocampal)',
  'Cingulum (parahippocampal-parietal)', 'Cingulum (parolfactory)', 'Parietal aslant tract', 'Vertical occipital fasciculus'];
const NEW_LABELS = ['Ventral tegmental area', 'Periaqueductal grey', 'Pedunculopontine nucleus', 'Dorsal raphe nucleus',
  'Median raphe nucleus', 'Basal forebrain cholinergic nuclei', 'Claustrum', 'Internal capsule', ...NEW_TRACTS];
const THAL = ['Pulvinar', 'Anterior nuclei of thalamus', 'Mediodorsal nucleus', 'Ventral laterodorsal nucleus',
  'Intralaminar and lateral posterior nuclei', 'Ventral anterior nucleus', 'Ventral lateroventral nucleus'];

// label -> screenshot tint. New structures are saturated, existing context is muted.
const C = {
  'Ventral tegmental area': '#d10a3c', 'Periaqueductal grey': '#009e8f', 'Pedunculopontine nucleus': '#d98c00',
  'Dorsal raphe nucleus': '#1f4fe0', 'Median raphe nucleus': '#8a2be2',
  'Substantia nigra': '#4a3a30', 'Subthalamic nucleus': '#6b5d3f', 'Red nucleus': '#8a3a2a', 'Aqueduct of midbrain': '#6fa3c8',
  'Basal forebrain cholinergic nuclei': '#d10a3c', 'Claustrum': '#009e8f', 'Internal capsule': '#b8bcc4',
  'Caudate nucleus': '#5a3f7a', 'Putamen': '#a0527e', 'Globus pallidus external': '#2f5f9a', 'Globus pallidus internal': '#1f3f78',
  'Nucleus accumbens': '#8a5a2a',
  'Cingulum (frontal-parietal)': '#d10a3c', 'Cingulum (frontal-parahippocampal)': '#d98c00', 'Cingulum (parahippocampal)': '#009e8f',
  'Cingulum (parahippocampal-parietal)': '#1f4fe0', 'Cingulum (parolfactory)': '#8a2be2',
  'Parietal aslant tract': '#ffe600', 'Vertical occipital fasciculus': '#00a050',
  'Arcuate fasciculus': '#6f8fa0', 'Superior longitudinal fasciculus III': '#a3b1bb',
};
THAL.forEach((t) => { C[t] = '#3c5a3c'; });

// theta/phi: absolute orbit angles (scene.js default view is theta 0.5, phi PI/2.25);
// theta -PI/2 looks at the left hemisphere from the left (lateral), +PI/2 from the right.
// zoom: extra model scale for close-ups (the orbit clamps its radius at 2.6).
const VIEWS = [
  { file: '1_midbrain_nuclei.png', title: 'Midbrain nuclei - anterolateral view (midbrain + pons ghosted)',
    show: ['Ventral tegmental area', 'Periaqueductal grey', 'Dorsal raphe nucleus', 'Median raphe nucleus',
           'Pedunculopontine nucleus', 'Substantia nigra', 'Subthalamic nucleus', 'Red nucleus', 'Aqueduct of midbrain'],
    ghost: ['Midbrain', 'Pons'], frame: ['Periaqueductal grey', 'Ventral tegmental area', 'Pedunculopontine nucleus', 'Median raphe nucleus'],
    theta: 1.0, phi: 1.5, zoom: 3.2, pad: 3.2, hemi: 'both' },
  { file: '2_midbrain_posterior.png', title: 'Midbrain nuclei - posterosuperior view: PAG around the aqueduct, raphe in the midline',
    show: ['Ventral tegmental area', 'Periaqueductal grey', 'Dorsal raphe nucleus', 'Median raphe nucleus',
           'Pedunculopontine nucleus', 'Substantia nigra', 'Red nucleus', 'Aqueduct of midbrain'],
    ghost: ['Midbrain'], frame: ['Periaqueductal grey', 'Ventral tegmental area', 'Pedunculopontine nucleus'],
    theta: 3.4, phi: 0.95, zoom: 3.2, pad: 3.2, hemi: 'both' },
  { file: '3_forebrain_nuclei.png', title: 'Claustrum, internal capsule, basal forebrain - lateral view (left)',
    show: ['Claustrum', 'Internal capsule', 'Basal forebrain cholinergic nuclei', 'Caudate nucleus', 'Putamen',
           'Globus pallidus external', 'Globus pallidus internal', 'Nucleus accumbens'],
    ghost: [], frame: ['Claustrum', 'Internal capsule', 'Basal forebrain cholinergic nuclei'],
    theta: -1.5708, phi: 1.55, zoom: 2.0, pad: 3.0, hemi: 'left' },
  { file: '4_internal_capsule_top.png', title: 'Internal capsule between caudate/thalamus and lentiform nucleus - superior view',
    show: ['Internal capsule', 'Caudate nucleus', 'Putamen', 'Globus pallidus external', 'Globus pallidus internal', 'Claustrum', ...THAL],
    ghost: [], frame: ['Internal capsule', 'Claustrum'], theta: 0.0, phi: 0.2, zoom: 1.8, pad: 3.0, hemi: 'both' },
  { file: '5_cingulum_medial.png', title: 'New tracts - medial view of the left hemisphere (cingulate cortex ghosted)',
    show: NEW_TRACTS, ghost: ['Corpus callosum', 'Cingulate gyrus and sulcus (Middle anterior part)',
      'Cingulate gyrus and sulcus (Middle posterior part)', 'Cingulate gyrus and sulcus (Posterior dorsal part)',
      'Cingulate gyrus (Posteroventral part)', 'Precuneus', 'Medial occipitotemporal gyrus (Parahippocampal)', 'Hippocampus'],
    frame: NEW_TRACTS, theta: 1.5708, phi: 1.5, zoom: 1.0, pad: 2.2, hemi: 'left' },
  { file: '6_lateral_tracts.png', title: 'Parietal aslant + vertical occipital fasciculus - lateral view (left)',
    show: ['Parietal aslant tract', 'Vertical occipital fasciculus', 'Arcuate fasciculus', 'Superior longitudinal fasciculus III'],
    ghost: ['__cortex__'], frame: ['Parietal aslant tract', 'Vertical occipital fasciculus', 'Arcuate fasciculus'],
    theta: -1.5708, phi: 1.45, zoom: 1.0, pad: 2.2, hemi: 'left' },
];

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (process.env.CDN_MIRROR && /Failed to load resource/.test(m.text())) return;   // dropped third-party hosts
  errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
if (process.env.CDN_MIRROR) {
  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'unpkg.com') {
      const rel = u.pathname.replace(/^\/(@[^/]+\/)?([^@/]+)@[^/]+/, (m, scope, name) => `/${scope || ''}${name}`);
      try {
        return route.fulfill({ body: await readFile(path.join(process.env.CDN_MIRROR, 'node_modules', rel)),
                               contentType: 'text/javascript' });
      } catch (e) { /* fall through */ }
    }
    return route.abort();
  });
}

async function boot(url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BA && window.__BA.scene && window.BRAIN, { timeout: 60000 });
  await page.waitForTimeout(4000);
  for (const t of ['Decline', 'No thanks', 'Reject']) {
    const b = page.getByRole('button', { name: t });
    if (await b.count()) await b.first().click().catch(() => {});
  }
}
const base = `http://localhost:${server.address().port}/`;
await boot(base);

const check = await page.evaluate(([labels]) => {
  const nodes = window.BRAIN.nodes.filter((n) => labels.includes(n.label));
  const inScene = new Set();
  window.__BA.scene.traverse((o) => { if (o.isMesh && o.userData.nodeId != null) inScene.add(o.userData.nodeId); });
  return { total: window.BRAIN.nodes.length, added: nodes.length,
           missing: nodes.filter((n) => !inScene.has(n.id)).map((n) => n.label + ':' + n.side),
           noDescription: [...new Set(nodes.map((n) => n.label))].filter((l) => !window.BRAIN.descriptions[l]) };
}, [NEW_LABELS]);

// 1. In-app view through the real UI: search, click the result, show the selection card.
await page.locator('input').first().fill('tegmental');
await page.waitForTimeout(800);
await page.getByText('Ventral tegmental area', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Focus/ }).first().click().catch(() => {});
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(OUT, '0_in_app_vta_selected.png') });
console.log('[shot] 0_in_app_vta_selected.png - search "tegmental", click the result, Focus');
await boot(base);

// 2. Close-ups driven through the scene API.
let angles = { theta: 0.5, phi: Math.PI / 2.25 };
async function orbitTo(theta, phi) {                       // scene.js: dtheta = -dx*0.006, dphi = -dy*0.006
  const dx = -(theta - angles.theta) / 0.006, dy = -(phi - angles.phi) / 0.006;
  const cx = 900, cy = 450;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(cx + (dx * i) / 30, cy + (dy * i) / 30);
  await page.mouse.up();
  angles = { theta, phi: Math.max(0.18, Math.min(Math.PI - 0.18, phi)) };
  await page.mouse.move(5, 895);
}
await page.addStyleTag({ content: '.glass{visibility:hidden !important}' });
for (const v of VIEWS) {
  await page.evaluate(([v, C, NEW, THAL]) => {
    const BA = window.__BA;
    const nodes = window.BRAIN.nodes;
    const ids = (labels) => nodes.filter((n) => labels.includes(n.label)).map((n) => n.id);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const meshes = [];
    BA.scene.traverse((o) => { if (o.isMesh && o.userData.nodeId != null) meshes.push(o); });
    const model = meshes[0].parent.parent;                 // group holding the centred gltf scene
    if (!model.userData.zoom0) model.userData.zoom0 = model.scale.clone();
    model.scale.copy(model.userData.zoom0).multiplyScalar(v.zoom || 1);
    const all = {};
    Object.keys(BA.cats).forEach((c) => { all[c] = { visible: true, opacity: 1 }; });
    BA.setLayers(all);
    BA.setAutoRotate(false);
    BA.setExposure(0.55);                                 // keep the tints legible under ACES
    BA.clearSelect();
    const ghostIds = v.ghost.includes('__cortex__')
      ? nodes.filter((n) => n.category === 'cortex').map((n) => n.id) : ids(v.ghost);
    BA.setHemisphere(v.hemi);
    BA.isolate([...ids(v.show), ...ghostIds]);
    const g = new Set(ghostIds);
    meshes.forEach((m) => {
      m.userData.maxOpacity = g.has(m.userData.nodeId) ? 0.14 : null;
      if (!m.userData.tint0) m.userData.tint0 = m.userData.baseColor.clone();
      m.userData.baseColor.copy(m.userData.tint0);
      const col = C[byId[m.userData.nodeId].label];
      if (col && !g.has(m.userData.nodeId)) m.userData.baseColor.set(col);
    });
    model.updateMatrixWorld(true);                        // frame against the rescaled model
    BA.frameNodes(ids(v.frame), v.pad);
    let el = document.getElementById('shot-legend');
    if (!el) { el = document.createElement('div'); el.id = 'shot-legend'; document.body.appendChild(el); }
    el.style.cssText = 'position:fixed;left:24px;top:24px;z-index:99;font:600 15px system-ui;color:#e8edf5;' +
      'background:rgba(8,11,18,.72);padding:14px 18px;border-radius:12px;max-width:560px;line-height:1.6';
    const labels = [];
    v.show.forEach((l) => { const k = THAL.includes(l) ? 'Thalamic nuclei (7)' : l; if (!labels.includes(k)) labels.push(k); });
    const row = (l) => `<div><span style="display:inline-block;width:12px;height:12px;border-radius:3px;` +
      `background:${C[l] || C.Pulvinar};margin-right:8px"></span>${l}${NEW.includes(l) ? ' <b style="color:#ffd84d">NEW</b>' : ''}</div>`;
    el.innerHTML = `<div style="font-size:16px;margin-bottom:8px">${v.title}</div>${labels.map(row).join('')}` +
      (v.ghost.length ? '<div style="opacity:.7;margin-top:6px">translucent context: ' +
        (v.ghost.includes('__cortex__') ? 'cortex' : v.ghost.slice(0, 3).join(', ') + (v.ghost.length > 3 ? ', ...' : '')) + '</div>' : '');
  }, [v, C, NEW_LABELS, THAL]);
  await orbitTo(v.theta, v.phi);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, v.file) });
  console.log('[shot]', v.file, '-', v.title);
}

await browser.close();
server.close();
console.log(JSON.stringify({ errors, check }, null, 2));
const ok = errors.length === 0 && check.missing.length === 0 && check.noDescription.length === 0;
console.log(ok ? 'ALL CHECKS PASSED' : 'CHECKS FAILED');
process.exit(ok ? 0 : 1);

/* ============================================================
   Brain Project - REAL specimen scene (Three.js r137 global)
   Loads the 344-structure Z-Anatomy brain.glb and exposes the
   exact same window.BrainScene API the procedural mock used -    but every mesh carries its real bx_id, so picking, selection,
   isolate and focus are per-structure, not per-category.
   ============================================================ */
(function () {
  const T = window.THREE;

  const PAL = (window.BRAIN && window.BRAIN.palette) || {};
  const col = (c, fb) => new T.Color(PAL[c] || fb || '#cccccc');
  // per-subsystem self-illumination so hues stay vivid on the dark stage
  const CAT_EMISS = {
    cortex: 0.05, white_matter: 0.16, deep_grey: 0.44, diencephalon: 0.42, brainstem: 0.22,
    cerebellum: 0.12, ventricles: 0.54, arteries: 0.6, veins_sinuses: 0.5, cranial_nerves: 0.54, meninges_dura: 0.06,
    tracts: 0.5,
  };
  // structures kept translucent even at full layer opacity (you see through them)
  const MAX_OPACITY = { meninges_dura: 0.34, ventricles: 0.9 };
  const VESSEL = new Set(['arteries', 'veins_sinuses', 'cranial_nerves', 'tracts']);
  // tone down the very light masses so the cortex doesn't read as neon-white on the dark stage
  const CAT_SHADE = { cortex: 0.62, white_matter: 0.8 };
  function shade(cat, hex) { const c = new T.Color(hex || '#cccccc'); if (CAT_SHADE[cat]) c.multiplyScalar(CAT_SHADE[cat]); return c; }

  function extras(o) {
    if (o.userData && o.userData.bx_cat != null) return o.userData;
    if (o.parent && o.parent.userData && o.parent.userData.bx_cat != null) return o.parent.userData;
    return o.userData || {};
  }

  /* ============================================================ */
  function create(canvas, opts) {
    opts = opts || {};
    const URL = opts.url || './models/brain.glb';
    const DRACO = opts.dracoPath || './vendor/draco/';

    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.LinearToneMapping;
    renderer.toneMappingExposure = opts.exposure || 0.95;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 1, 0.01, 200);

    // lights - soft clinical key + cool/warm rims for the "designed" stage
    scene.add(new T.HemisphereLight(0xc6d2ff, 0x14171f, 0.5));
    const key = new T.DirectionalLight(0xffffff, 1.05); key.position.set(4, 6.5, 7); scene.add(key);
    const fill = new T.DirectionalLight(0xaebfff, 0.34); fill.position.set(-6, 1, 3); scene.add(fill);
    const rim = new T.DirectionalLight(0x8ee0ff, 0.8); rim.position.set(-3, 3, -8); scene.add(rim);
    const rim2 = new T.DirectionalLight(0xff9bb6, 0.3); rim2.position.set(5, -2, -6); scene.add(rim2);

    const root = new T.Group(); root.rotation.y = -0.25; scene.add(root);
    const model = new T.Group(); root.add(model);   // holds the centered/scaled gltf

    // logical category registry (we never reparent gltf meshes - keep transforms)
    const cats = {};                       // cat -> { want, targetOpacity, meshes[] }
    function C(cat) { if (!cats[cat]) cats[cat] = { want: true, targetOpacity: 1, meshes: [] }; return cats[cat]; }
    const allMeshes = [];
    const meshById = new Map();             // nodeId -> [meshes]
    let loaded = false;

    // state requested before the GLB finished loading - applied on load
    const req = { layers: null, hemisphere: 'both', isolate: null, selected: null, subset: null };

    /* ---------------- load the real specimen ---------------- */
    const draco = new T.DRACOLoader().setDecoderPath(DRACO);
    const loader = new T.GLTFLoader(); loader.setDRACOLoader(draco);
    loader.load(URL, (gltf) => {
      model.add(gltf.scene);

      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const ex = extras(o);
        const cat = ex.bx_cat || 'other';
        const id = ex.bx_id != null ? ex.bx_id : null;
        const side = ex.bx_side || 'median';
        const base = shade(cat, PAL[cat]);
        const be = CAT_EMISS[cat] != null ? CAT_EMISS[cat] : 0.06;
        const mat = new T.MeshStandardMaterial({
          color: base.clone(),
          roughness: VESSEL.has(cat) ? 0.5 : 0.82,
          metalness: 0.0,
          transparent: true, opacity: 1,
          emissive: base.clone().multiplyScalar(be),
          side: cat === 'meninges_dura' ? T.DoubleSide : T.FrontSide,
          depthWrite: true,
        });
        o.material = mat;
        o.userData = { cat, side, nodeId: id, baseColor: base.clone(), baseEmiss: be,
                       maxOpacity: MAX_OPACITY[cat] != null ? MAX_OPACITY[cat] : 1 };
        C(cat).meshes.push(o); allMeshes.push(o);
        if (id != null) { if (!meshById.has(id)) meshById.set(id, []); meshById.get(id).push(o); }
      });

      // center on the CORE brain (ignore descending nerves/vessels) + scale to stage
      const core = new T.Box3();
      let anyCore = false;
      for (const m of allMeshes) {
        const ex = extras(m);
        if (ex.bx_core === 1 || ex.bx_core === true) { core.expandByObject(m); anyCore = true; }
      }
      if (!anyCore) core.setFromObject(gltf.scene);
      const center = core.getCenter(new T.Vector3());
      gltf.scene.position.sub(center);                 // core center -> model origin
      const r = core.getBoundingSphere(new T.Sphere()).radius || 1;
      model.scale.setScalar(1.7 / r);                  // fit the design camera framing
      // anatomical upright: Z-Anatomy exports anterior toward +Z; face the camera
      model.rotation.y = Math.PI;

      loaded = true;
      // apply whatever the React app already asked for, then settle instantly
      if (req.layers) setLayers(req.layers);
      setHemisphere(req.hemisphere);
      isolate(req.isolate);
      setSubset(req.subset);
      if (req.selected != null) selectNode(req.selected); else clearSelect();
      snap();
      if (opts.onReady) opts.onReady();
    }, undefined, (err) => { console.error('[BrainScene] GLB load failed:', err); });

    /* ---------------- camera / orbit (unchanged feel) ---------------- */
    const target = new T.Vector3(0, -0.05, 0);
    const sph = new T.Spherical(7.6, Math.PI / 2.25, 0.5);
    const sphGoal = sph.clone();
    const tgtGoal = target.clone();
    let autoRot = opts.autorotate !== false;
    let idleTimer = 0;

    function applyCamera() {
      const off = new T.Vector3().setFromSpherical(sph);
      camera.position.copy(target).add(off);
      camera.lookAt(target);
    }

    let dragging = false, panning = false, lastX = 0, lastY = 0, moved = 0;
    const dom = renderer.domElement;
    function down(e) {
      dragging = true; moved = 0;
      panning = e.button === 2 || e.metaKey || e.ctrlKey;      // ⌘/Ctrl = pan/drift
      lastX = e.clientX; lastY = e.clientY; idleTimer = 0;
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
    }
    function move(e) {
      hover(e);
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (panning) {
        const s = sph.radius * 0.0016;
        const right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
        tgtGoal.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else {
        sphGoal.theta -= dx * 0.006;
        sphGoal.phi = Math.max(0.18, Math.min(Math.PI - 0.18, sphGoal.phi - dy * 0.006));
      }
      idleTimer = 0;
    }
    function up(e) { if (dragging && moved < 6) click(e); dragging = false; panning = false; }
    function wheel(e) {
      e.preventDefault();
      sphGoal.radius = Math.max(2.6, Math.min(16, sphGoal.radius * (1 + e.deltaY * 0.0009)));
      idleTimer = 0;
    }
    // stepped zoom for on-screen +/- buttons (pinch-zoom is unreliable on mobile);
    // the loop eases sph.radius toward the goal, so each tap glides in/out smoothly
    function zoom(dir) {
      sphGoal.radius = Math.max(2.6, Math.min(16, sphGoal.radius * (1 + dir * 0.22)));
      idleTimer = 0;
    }
    // keyboard modifier toggles pan even mid-drag
    window.addEventListener('keydown', (e) => { if ((e.key === 'Meta' || e.key === 'Control') && dragging) panning = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'Meta' || e.key === 'Control') panning = false; });
    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    dom.addEventListener('wheel', wheel, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());

    /* ---------------- picking / hover (per-structure) ---------------- */
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    let hovered = null, selectedIds = new Set();

    // ---- functional-system highlight mode (Systems / Learn) ----
    // when on, the loop ignores the per-category layer state and instead
    // glows the active pathway structures, dims the already-seen ones, and
    // keeps cortex/cerebellum/brainstem as a faint ghost for spatial context.
    let hiOn = false;
    let hiActive = new Set();   // nodeIds glowing now
    let hiSeen = new Set();     // nodeIds lit earlier in the pathway
    const GHOST_CATS = new Set(['cortex', 'cerebellum', 'brainstem']);
    function pickAt(e) {
      const r = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const cand = allMeshes.filter(m => m.visible && m.material.opacity > 0.14);
      const hits = ray.intersectObjects(cand, false);
      return hits.length ? hits[0].object : null;
    }
    function hover(e) {
      if (dragging) return;
      const m = pickAt(e);
      if (m !== hovered) {
        hovered = m;
        dom.style.cursor = m ? 'pointer' : 'grab';
        if (opts.onHover) opts.onHover(m ? m.userData.nodeId : null);
      }
    }
    function click(e) {
      const m = pickAt(e);
      if (opts.onPick) opts.onPick(m ? m.userData.nodeId : null, m);
    }

    /* ---------------- public state API ---------------- */
    function setLayer(cat, st) {
      req.layers = req.layers || {}; req.layers[cat] = Object.assign(req.layers[cat] || {}, st);
      const c = cats[cat]; if (!c) return;
      if (st.visible != null) c.want = st.visible !== false;
      if (st.opacity != null) c.targetOpacity = st.opacity;
      if (st.visible === false) c.targetOpacity = 0;
      else if (st.opacity == null && st.visible === true) c.targetOpacity = 1;
    }
    function setLayers(map) { Object.keys(map).forEach(c => setLayer(c, map[c])); }

    function setHemisphere(side) {
      req.hemisphere = side;
      allMeshes.forEach(m => {
        const sd = m.userData.side;
        m.userData.hemiHidden = !(side === 'both' || sd === 'median' || sd === side);
      });
    }

    function frameBox(box, padScale) {
      if (!box || box.isEmpty()) return;
      const c = box.getCenter(new T.Vector3());
      const r = box.getBoundingSphere(new T.Sphere()).radius;
      tgtGoal.copy(c);
      sphGoal.radius = Math.max(2.6, Math.min(16, r * (padScale || 3.0) + 0.4));
      autoRot = false; idleTimer = 0;
    }
    function boxOfMeshes(ms) {
      const b = new T.Box3();
      ms.forEach(m => { if (m.geometry) b.expandByObject(m); });
      return b;
    }
    function focusCategory(cat) { const c = cats[cat]; if (c) frameBox(boxOfMeshes(c.meshes), 2.6); }
    function focusNode(id) {
      const ms = meshById.get(id);
      if (ms && ms.length) frameBox(boxOfMeshes(ms), 4.0);
      else { const n = window.BRAIN.nodes.find(x => x.id === id); if (n) focusCategory(n.category); }
    }

    function selectNode(id) {
      req.selected = id;
      selectedIds = new Set();
      const ms = meshById.get(id);
      if (ms) ms.forEach(m => selectedIds.add(m));
      else { selectedIds = new Set(); }
    }
    function clearSelect() { req.selected = null; selectedIds = new Set(); }

    function isolate(ids) {
      req.isolate = ids;
      const set = ids ? new Set(ids) : null;
      allMeshes.forEach(m => { m.userData.isoHidden = set ? !set.has(m.userData.nodeId) : false; });
    }

    // restrict given categories to a set of node ids (e.g. only the circle-of-Willis
    // arteries) without touching any other layer - map: { cat: Set(ids) } or null.
    function setSubset(map) {
      req.subset = map;
      allMeshes.forEach(m => {
        const s = map && map[m.userData.cat];
        m.userData.subsetHidden = s ? !s.has(m.userData.nodeId) : false;
      });
    }

    // ---- functional-system highlight (drives Systems & Learn) ----
    function setHighlight(activeIds, seenIds) {
      hiOn = true;
      hiActive = new Set(activeIds || []);
      hiSeen = new Set(seenIds || []);
    }
    function clearHighlight() { hiOn = false; hiActive = new Set(); hiSeen = new Set(); }
    // frame a set of nodeIds (only the meshes currently shown by hemisphere)
    function frameNodes(ids, padScale) {
      const b = new T.Box3();
      let any = false;
      (ids || []).forEach(id => {
        const ms = meshById.get(id);
        if (ms) ms.forEach(m => { if (m.geometry && !m.userData.hemiHidden) { b.expandByObject(m); any = true; } });
      });
      if (!any) { (ids || []).forEach(id => { const ms = meshById.get(id); if (ms) ms.forEach(m => { if (m.geometry) { b.expandByObject(m); any = true; } }); }); }
      if (any) frameBox(b, padScale || 3.2);
    }

    function reset() {
      tgtGoal.set(0, -0.05, 0);
      sphGoal.set(7.6, Math.PI / 2.25, 0.5);
      autoRot = opts.autorotate !== false; idleTimer = 0;
    }

    function snap() {
      allMeshes.forEach(m => {
        const c = cats[m.userData.cat];
        const want = c && c.want && !m.userData.hemiHidden && !m.userData.isoHidden && !m.userData.subsetHidden;
        const cap = m.userData.maxOpacity != null ? m.userData.maxOpacity : 1;
        m.material.opacity = want ? Math.min(cap, c.targetOpacity) : 0;
        // only solid meshes write depth - a translucent ghost (e.g. faded cortex)
        // must not occlude the structures behind it
        m.material.depthWrite = m.material.opacity >= 0.98;
        m.visible = m.material.opacity > 0.012;
      });
    }

    function setAutoRotate(v) { autoRot = v; }
    function setExposure(v) { renderer.toneMappingExposure = v; }
    function setBackground() {}
    function frameSphere(center, radius, dist) {
      tgtGoal.copy(center);
      sphGoal.radius = Math.max(2.6, Math.min(16, dist || radius * 3));
      autoRot = false; idleTimer = 0;
    }

    /* ============================================================
       VR (WebXR) — beta. Drops the specimen into a floor-anchored
       hologram you can physically walk around (room-scale), spin and
       resize with the thumbsticks, and pick apart by pointing a
       controller and pulling the trigger. Same meshes, same picking
       as the desktop view - just presented in immersive space.
       ============================================================ */
    renderer.xr.enabled = true;
    let inVR = false, vrHovered = null;
    const VR_DIST = -0.7, VR_HEIGHT = 1.4, VR_SCALE = 0.24;   // a graspable ~0.8 m brain at eye level
    const savedRoot = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1 };
    let vrGrid = null;
    const controllers = [];
    // gesture state - works for hand-tracking pinches AND controller triggers, since
    // WebXR maps a hand pinch to the same 'select' action a trigger fires.
    const pinched = [false, false];
    const pinchStart = [new T.Vector3(), new T.Vector3()];
    const pinchMoved = [0, 0];
    const pinchHit = [null, null];
    const TAP = 0.045;                     // hand travel (m) below which a pinch is a tap (select) not a grab
    const grab = { mode: 0, hand: null, pair: null, offset: new T.Matrix4() };   // 0 none · 1 one-hand · 2 two-hand
    const xrRay = new T.Raycaster();
    const tmpMat = new T.Matrix4(), frameM = new T.Matrix4();
    const headPos = new T.Vector3();
    const pA = new T.Vector3(), pB = new T.Vector3(), midV = new T.Vector3(), scV = new T.Vector3();
    const tmpQ = new T.Quaternion();
    const vUp = new T.Vector3(0, 1, 0), vRight = new T.Vector3(), vDir = new T.Vector3(), vFwd = new T.Vector3();

    /* ============================================================
       In-scene UI - interactive canvas panels visible in the headset.
       Each panel carries hit-test "regions"; a pinch (tap) on a region
       fires its action via opts.onVRAction, so the web UI's controls work
       in VR. Panels (all anchored relative to the brain):
         · info      - selected structure + Related buttons   (brain's right, top)
         · side      - how-to + Exit VR                        (brain's right, under info)
         · controls  - hemisphere / layers / views            (brain's left)
         · narration - Systems/Learn step card                 (below the brain)
       ============================================================ */
    const FS = 'sans-serif';
    let vrUI = null;
    const panels = {};            // key -> panel
    const ipanels = [];           // panels in hit-test order
    let vrInfo = null, vrControls = null, vrNarration = null;
    const pinchUI = [null, null]; // region/'bg'/null that each pinch began on
    const grabHand = [false, false];
    const act = (type, val) => { if (opts.onVRAction) opts.onVRAction(type, val); };

    function makePanel(key, wMeters, pxW, pxH) {
      const canvas = document.createElement('canvas'); canvas.width = pxW; canvas.height = pxH;
      const ctx = canvas.getContext('2d');
      const tex = new T.CanvasTexture(canvas); tex.anisotropy = 4;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthTest: false });
      const mesh = new T.Mesh(new T.PlaneGeometry(wMeters, wMeters * pxH / pxW), mat);
      mesh.renderOrder = 10;
      const p = { key, mesh, canvas, ctx, tex, w: pxW, h: pxH, regions: [] };
      panels[key] = p; ipanels.push(p);
      return p;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function wrap(ctx, text, maxW) {
      const words = (text || '').split(/\s+/); const lines = []; let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line); return lines;
    }
    function clearPanel(p, alpha) {
      const { ctx, canvas } = p; ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(10,14,24,' + (alpha == null ? 0.92 : alpha) + ')'; roundRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 26); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
      p.regions = [];
    }
    // draw a button + register its hit region; o: {bg,fg,border,dot,font,r,center,action}
    function chip(p, x, y, w, h, label, o) {
      o = o || {}; const ctx = p.ctx;
      ctx.fillStyle = o.bg || 'rgba(255,255,255,0.06)'; roundRect(ctx, x, y, w, h, o.r != null ? o.r : 12); ctx.fill();
      if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 2; ctx.stroke(); }
      if (o.dot) { ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(x + 20, y + h / 2, 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = o.fg || '#E9EDF6'; ctx.font = o.font || '600 24px ' + FS;
      ctx.textBaseline = 'middle'; ctx.textAlign = o.center ? 'center' : 'left';
      ctx.fillText(label, o.center ? x + w / 2 : x + (o.dot ? 38 : 16), y + h / 2 + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (o.action) p.regions.push({ x, y, w, h, action: o.action });
    }

    function drawInfo() {
      const p = panels.info; if (!p) return;
      const info = vrInfo; p.mesh.visible = !!info;
      if (!info) { p.regions = []; return; }
      const { ctx } = p; const W = p.w, pad = 38;
      clearPanel(p, 0.92);
      ctx.fillStyle = info.color || '#3A66FF'; ctx.beginPath(); ctx.arc(pad + 12, 54, 13, 0, Math.PI * 2); ctx.fill();
      if (info.side) {
        ctx.font = '600 24px ' + FS; const sw = ctx.measureText(info.side).width;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(ctx, W - pad - sw - 30, 34, sw + 30, 40, 20); ctx.fill();
        ctx.fillStyle = 'rgba(233,237,246,0.85)'; ctx.fillText(info.side, W - pad - sw - 15, 62);
      }
      ctx.fillStyle = '#E9EDF6'; ctx.font = '800 40px ' + FS;
      const tl = wrap(ctx, info.title || '', W - pad * 2 - 40).slice(0, 2);
      tl.forEach((l, i) => ctx.fillText(l, pad + 40, 66 + i * 46));
      let y = 66 + tl.length * 46 + 22;
      ctx.fillStyle = 'rgba(180,190,210,0.92)'; ctx.font = '400 27px ' + FS;
      wrap(ctx, info.body || '', W - pad * 2).slice(0, 6).forEach(l => { ctx.fillText(l, pad, y); y += 36; });
      if (info.related && info.related.length) {
        y += 10; ctx.fillStyle = 'rgba(150,160,180,0.9)'; ctx.font = '700 20px ' + FS;
        ctx.fillText('RELATED STRUCTURES', pad, y); y += 26;
        let x = pad; const ch = 46;
        info.related.forEach(r => {
          const lbl = r.label + (r.side && r.side !== 'median' ? '  ' + (r.side === 'left' ? 'L' : 'R') : '');
          ctx.font = '600 22px ' + FS; const w = Math.min(W - pad * 2, ctx.measureText(lbl).width + 28);
          if (x + w > W - pad) { x = pad; y += ch + 12; }
          chip(p, x, y, w, ch, lbl, { bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.14)', font: '600 22px ' + FS, action: () => act('select', r.id) });
          x += w + 12;
        });
      }
      p.tex.needsUpdate = true;
    }
    function drawSide() {
      const p = panels.side; if (!p) return;
      clearPanel(p, 0.88);
      const { ctx } = p; const W = p.w, pad = 30;
      ctx.fillStyle = '#8ee0ff'; ctx.font = '700 22px ' + FS; ctx.fillText('HOW TO', pad, 42);
      const rows = [['Pinch', 'select · press a button'], ['Pinch + move', 'grab & move the brain'], ['Two hands', 'pull apart to resize']];
      let y = 80;
      rows.forEach(r => {
        ctx.fillStyle = '#cfe8ff'; ctx.font = '700 23px ' + FS; ctx.fillText(r[0], pad, y);
        ctx.fillStyle = 'rgba(200,208,222,0.8)'; ctx.font = '400 21px ' + FS; ctx.fillText(r[1], pad + 200, y);
        y += 36;
      });
      const bh = 60, bw = W - pad * 2;
      chip(p, pad, p.h - bh - 24, bw, bh, '✕  Exit VR', { bg: 'rgba(200,60,84,0.92)', border: 'rgba(255,255,255,0.25)', fg: '#fff', font: '800 30px ' + FS, r: bh / 2, center: true, action: () => endSession() });
      p.tex.needsUpdate = true;
    }
    function drawControls() {
      const p = panels.controls; if (!p) return;
      const c = vrControls; p.mesh.visible = !!c;
      if (!c) { p.regions = []; return; }
      clearPanel(p, 0.92);
      const { ctx } = p; const W = p.w, pad = 28; let y = 40;
      ctx.fillStyle = '#E9EDF6'; ctx.font = '800 32px ' + FS; ctx.fillText('Controls', pad, y); y += 30;
      ctx.fillStyle = 'rgba(150,160,180,0.9)'; ctx.font = '700 18px ' + FS; ctx.fillText('HEMISPHERE', pad, y); y += 16;
      const segW = (W - pad * 2 - 16) / 3;
      [['left', 'Left'], ['both', 'Both'], ['right', 'Right']].forEach((o, i) => {
        const on = c.hemisphere === o[0];
        chip(p, pad + i * (segW + 8), y, segW, 52, o[1], { bg: on ? '#3A66FF' : 'rgba(255,255,255,0.06)', fg: on ? '#fff' : '#cdd5e4', font: '700 22px ' + FS, center: true, action: () => act('hemisphere', o[0]) });
      });
      y += 52 + 26;
      ctx.fillStyle = 'rgba(150,160,180,0.9)'; ctx.font = '700 18px ' + FS; ctx.fillText('LAYERS', pad, y); y += 16;
      (c.layers || []).forEach(L => {
        const h = 48;
        chip(p, pad, y, W - pad * 2, h, L.label, { bg: L.on ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.035)', dot: L.color, fg: L.on ? '#E9EDF6' : 'rgba(160,168,184,0.8)', font: '600 22px ' + FS, action: () => act('toggleLayer', L.cat) });
        // on/off check at the right edge
        ctx.fillStyle = L.on ? '#5fd08a' : 'rgba(255,255,255,0.16)';
        roundRect(ctx, pad + (W - pad * 2) - 40, y + h / 2 - 12, 24, 24, 7); ctx.fill();
        y += h + 8;
      });
      y += 8;
      const bw = (W - pad * 2 - 16) / 3;
      [['showAll', 'Show all'], ['hideAll', 'Hide all'], ['reset', 'Reset']].forEach((o, i) => {
        chip(p, pad + i * (bw + 8), y, bw, 50, o[1], { bg: 'rgba(255,255,255,0.06)', fg: '#cdd5e4', font: '600 20px ' + FS, center: true, action: () => act(o[0]) });
      });
      y += 50 + 26;
      ctx.fillStyle = 'rgba(150,160,180,0.9)'; ctx.font = '700 18px ' + FS; ctx.fillText('VIEWS', pad, y); y += 16;
      let x = pad;
      (c.presets || []).forEach(pr => {
        ctx.font = '600 20px ' + FS; const w = ctx.measureText(pr.label).width + 28;
        if (x + w > W - pad) { x = pad; y += 48; }
        chip(p, x, y, w, 42, pr.label, { bg: pr.active ? '#3A66FF' : 'rgba(255,255,255,0.06)', fg: pr.active ? '#fff' : '#cdd5e4', font: '600 20px ' + FS, action: () => act('preset', pr.id) });
        x += w + 10;
      });
      p.tex.needsUpdate = true;
    }
    function drawNarration() {
      const p = panels.narration; if (!p) return;
      const n = vrNarration; p.mesh.visible = !!n;
      if (!n) { p.regions = []; return; }
      clearPanel(p, 0.92);
      const { ctx } = p; const W = p.w, pad = 34;
      ctx.fillStyle = '#8ee0ff'; ctx.font = '700 20px ' + FS;
      ctx.fillText((n.kind || 'Step').toUpperCase() + ' · ' + (n.step + 1) + ' / ' + n.total, pad, 40);
      ctx.fillStyle = '#E9EDF6'; ctx.font = '800 32px ' + FS;
      ctx.fillText(wrap(ctx, n.title || '', W - pad * 2)[0] || '', pad, 80);
      ctx.fillStyle = 'rgba(190,200,216,0.9)'; ctx.font = '400 24px ' + FS;
      wrap(ctx, n.body || '', W - pad * 2).slice(0, 4).forEach((l, i) => ctx.fillText(l, pad, 120 + i * 32));
      const bh = 56, by = p.h - bh - 22, bw = 170;
      chip(p, pad, by, bw, bh, '‹ Prev', { fg: '#cdd5e4', font: '700 24px ' + FS, center: true, action: () => act('narrPrev') });
      chip(p, pad + bw + 12, by, bw, bh, n.last ? (n.isLesson ? 'To quiz ›' : 'Done') : 'Next ›', { bg: '#3A66FF', fg: '#fff', font: '700 24px ' + FS, center: true, action: () => act('narrNext') });
      chip(p, W - pad - 160, by, 160, bh, '✕ Close', { fg: '#cdd5e4', font: '700 24px ' + FS, center: true, action: () => act('narrClose') });
      p.tex.needsUpdate = true;
    }
    function setVRInfo(info) { vrInfo = info || null; if (panels.info) drawInfo(); }
    function setVRControls(c) { vrControls = c || null; if (panels.controls) drawControls(); }
    function setVRNarration(n) { vrNarration = n || null; if (panels.narration) drawNarration(); }

    function buildVRUI() {
      if (vrUI) return;
      vrUI = new T.Group(); scene.add(vrUI);
      makePanel('info', 0.44, 800, 660); panels.info.mesh.visible = false;
      makePanel('side', 0.44, 800, 300);
      makePanel('controls', 0.34, 640, 1180);
      makePanel('narration', 0.6, 1100, 360); panels.narration.mesh.visible = false;
      Object.values(panels).forEach(p => vrUI.add(p.mesh));
      drawSide(); drawInfo(); drawControls(); drawNarration();
    }

    function buildControllers() {
      if (controllers.length) return;
      const rayGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 0, -1)]);
      for (let i = 0; i < 2; i++) {
        const c = renderer.xr.getController(i);
        c.userData.idx = i;
        c.addEventListener('selectstart', () => onPinchStart(c));
        c.addEventListener('selectend', () => onPinchEnd(c));
        const line = new T.Line(rayGeo, new T.LineBasicMaterial({ color: 0x8ee0ff, transparent: true, opacity: 0.9 }));
        line.scale.z = 5; line.name = 'ray';
        c.add(line);
        const tip = new T.Mesh(new T.SphereGeometry(0.012, 12, 12), new T.MeshBasicMaterial({ color: 0x8ee0ff }));
        tip.name = 'tip'; c.add(tip);
        scene.add(c);
        controllers.push(c);
      }
    }

    function setRay(c) {
      tmpMat.identity().extractRotation(c.matrixWorld);
      xrRay.ray.origin.setFromMatrixPosition(c.matrixWorld);
      xrRay.ray.direction.set(0, 0, -1).applyMatrix4(tmpMat).normalize();
    }
    function controllerHit(c) {
      setRay(c);
      const cand = allMeshes.filter(m => m.visible && m.material.opacity > 0.14);
      const hits = xrRay.intersectObjects(cand, false);
      return hits.length ? hits[0] : null;
    }
    // which UI region (if any) does this hand point at? returns region | 'bg' | null
    function regionAt(c) {
      setRay(c);
      for (const p of ipanels) {
        if (!p.mesh.visible) continue;
        const h = xrRay.intersectObject(p.mesh, false);
        if (h.length && h[0].uv) {
          const u = h[0].uv, px = u.x * p.w, py = (1 - u.y) * p.h;
          const r = p.regions.find(rg => px >= rg.x && px <= rg.x + rg.w && py >= rg.y && py <= rg.y + rg.h);
          return r || 'bg';
        }
      }
      return null;
    }
    function endSession() { const s = renderer.xr.getSession(); if (s) s.end(); }

    // ---- grab math: drive the brain from a "grab frame" (one hand = its pose;
    // two hands = a handlebar whose length scales the brain) ----
    function frameFor(out, mode, a, b) {
      if (mode === 2) {
        pA.setFromMatrixPosition(a.matrixWorld); pB.setFromMatrixPosition(b.matrixWorld);
        midV.addVectors(pA, pB).multiplyScalar(0.5);
        const dist = Math.max(0.0001, pA.distanceTo(pB));
        const angle = Math.atan2(pB.x - pA.x, pB.z - pA.z);
        tmpQ.setFromAxisAngle(vUp, angle);
        return out.compose(midV, tmpQ, scV.set(dist, dist, dist));   // the handlebar length carries the resize
      }
      return out.copy(a.matrixWorld);                                 // one hand: pose only, size unchanged
    }
    function beginGrab(mode, a, b) {
      grab.mode = mode; grab.hand = mode === 1 ? a : null; grab.pair = mode === 2 ? [a, b] : null;
      frameFor(frameM, mode, a, b);
      grab.offset.copy(frameM).invert().multiply(root.matrixWorld);   // root pose relative to the grab frame
    }
    function applyGrab() {
      if (!grab.mode) return;
      const a = grab.mode === 2 ? grab.pair[0] : grab.hand;
      const b = grab.mode === 2 ? grab.pair[1] : null;
      frameFor(frameM, grab.mode, a, b);
      tmpMat.multiplyMatrices(frameM, grab.offset);
      tmpMat.decompose(root.position, root.quaternion, root.scale);
      if (root.scale.x < 0.05 || root.scale.x > 1.4) root.scale.setScalar(Math.max(0.05, Math.min(1.4, root.scale.x)));
    }

    // ---- gesture handlers: pinch a panel = press a button; pinch a structure = select;
    // pinch-drag empty = grab/move; two free pinches = resize/rotate ----
    function onPinchStart(c) {
      const i = c.userData.idx;
      pinched[i] = true; pinchMoved[i] = 0;
      pinchStart[i].setFromMatrixPosition(c.matrixWorld);
      const ui = regionAt(c); pinchUI[i] = ui;
      pinchHit[i] = ui ? null : controllerHit(c);   // only target a structure when not on a panel
    }
    function onPinchEnd(c) {
      const i = c.userData.idx;
      pinched[i] = false;
      const ui = pinchUI[i]; pinchUI[i] = null;
      if (ui) { if (ui !== 'bg' && pinchMoved[i] < TAP && ui.action) ui.action(); }   // button press
      else if (!grabHand[i] && pinchMoved[i] < TAP) {                                  // tap on a structure = select
        const hit = pinchHit[i];
        if (opts.onPick) opts.onPick(hit ? hit.object.userData.nodeId : null, hit ? hit.object : null);
      }
    }

    function layoutVRUI() {
      if (!vrUI) return;
      const xrCam = renderer.xr.getCamera(camera);
      xrCam.getWorldPosition(headPos);
      const center = root.position;                          // model is centered on root's origin
      const radius = root.scale.x * 1.7;
      vDir.subVectors(center, headPos); vDir.y = 0; if (vDir.lengthSq() < 1e-5) vDir.set(0, 0, -1); vDir.normalize();
      vRight.crossVectors(vUp, vDir).normalize();            // unit vector to the brain's right (from the viewer)
      const rx = radius + 0.30;
      // right column: description on top, how-to + Exit beneath it (fixed offsets so the
      // how-to stays put even when nothing is selected and the description is hidden)
      panels.info.mesh.position.copy(center).addScaledVector(vRight, -rx).setY(center.y + 0.18);
      panels.side.mesh.position.copy(center).addScaledVector(vRight, -rx).setY(center.y - 0.16);
      // left column: the control panel
      panels.controls.mesh.position.copy(center).addScaledVector(vRight, radius + 0.34).setY(center.y);
      // below: the Systems/Learn narration card
      panels.narration.mesh.position.copy(center).setY(center.y - (radius + 0.30));
      Object.values(panels).forEach(p => { if (p.mesh.visible) p.mesh.lookAt(headPos); });
    }

    function pollVR(dt) {
      const session = renderer.xr.getSession(); if (!session) return;
      // measure pinch travel for grab/tap discrimination (panel pinches never grab)
      controllers.forEach(c => {
        const i = c.userData.idx;
        if (pinched[i] && !pinchUI[i]) { pA.setFromMatrixPosition(c.matrixWorld); pinchMoved[i] = Math.max(pinchMoved[i], pA.distanceTo(pinchStart[i])); }
      });
      const gh = controllers.filter(c => pinched[c.userData.idx] && !pinchUI[c.userData.idx]);
      if (gh.length >= 2) { if (grab.mode !== 2) beginGrab(2, gh[0], gh[1]); }
      else if (gh.length === 1) { const i = gh[0].userData.idx; if (grab.mode === 2) beginGrab(1, gh[0]); else if (grab.mode === 0 && pinchMoved[i] >= TAP) beginGrab(1, gh[0]); }
      else { grab.mode = 0; grab.hand = null; grab.pair = null; }
      grabHand[0] = grabHand[1] = false;
      if (grab.mode === 1 && grab.hand) grabHand[grab.hand.userData.idx] = true;
      if (grab.mode === 2 && grab.pair) { grabHand[grab.pair[0].userData.idx] = true; grabHand[grab.pair[1].userData.idx] = true; }
      applyGrab();

      // thumbsticks (controllers only - hands have no gamepad). Disabled while grabbing.
      if (!grab.mode) {
        let yaw = 0, scaleDelta = 0, slideZ = 0, slideX = 0;
        for (const src of session.inputSources) {
          const gp = src.gamepad; if (!gp || !gp.axes) continue;
          const ax = gp.axes;
          let sx = ax.length >= 4 ? ax[2] : ax[0];
          let sy = ax.length >= 4 ? ax[3] : ax[1];
          if (Math.abs(sx) < 0.18) sx = 0;
          if (Math.abs(sy) < 0.18) sy = 0;
          if (src.handedness === 'left') { slideX += sx; slideZ += sy; } else { yaw += sx; scaleDelta += sy; }
        }
        if (yaw) root.rotation.y -= yaw * dt * 2.4;
        if (slideZ) root.position.z = Math.max(-3, Math.min(-0.2, root.position.z + slideZ * dt * 1.3));
        if (slideX) root.position.x = Math.max(-1.6, Math.min(1.6, root.position.x + slideX * dt * 1.3));
        if (scaleDelta) root.scale.setScalar(Math.max(0.05, Math.min(1.3, root.scale.x * (1 - scaleDelta * dt * 1.3))));
      }
      // hover glow + ray length from whichever hand/controller is closest to a structure
      let best = null;
      controllers.forEach(c => {
        const h = controllerHit(c);
        const ray = c.getObjectByName('ray');
        if (ray) { ray.scale.z = h ? h.distance : 5; ray.material.color.setHex(h ? 0xffffff : 0x8ee0ff); }
        if (h && (!best || h.distance < best.distance)) best = h;
      });
      vrHovered = best ? best.object : null;
      hovered = vrHovered;   // reuse the desktop emissive-boost path for the pointed-at mesh
      layoutVRUI();
    }

    function enterVRRig() {
      inVR = true;
      savedRoot.px = root.position.x; savedRoot.py = root.position.y; savedRoot.pz = root.position.z;
      savedRoot.rx = root.rotation.x; savedRoot.ry = root.rotation.y; savedRoot.rz = root.rotation.z;
      savedRoot.s = root.scale.x;
      root.position.set(0, VR_HEIGHT, VR_DIST);
      root.scale.setScalar(VR_SCALE);
      scene.background = new T.Color(0x05070d);
      if (!vrGrid) { vrGrid = new T.GridHelper(12, 24, 0x2a3550, 0x161c2c); vrGrid.material.transparent = true; vrGrid.material.opacity = 0.45; }
      scene.add(vrGrid);
      buildControllers();
      buildVRUI();
      vrUI.visible = true;
      setVRInfo(vrInfo);
      autoRot = false;
      if (opts.onVR) opts.onVR(true);
    }

    function exitVRRig() {
      inVR = false;
      grab.mode = 0; grab.hand = null; grab.pair = null;
      pinched[0] = pinched[1] = false; pinchHit[0] = pinchHit[1] = null; pinchUI[0] = pinchUI[1] = null;
      grabHand[0] = grabHand[1] = false;
      root.position.set(savedRoot.px, savedRoot.py, savedRoot.pz);
      root.rotation.set(savedRoot.rx, savedRoot.ry, savedRoot.rz);
      root.scale.setScalar(savedRoot.s);
      scene.background = null;
      if (vrGrid) scene.remove(vrGrid);
      if (vrUI) vrUI.visible = false;
      hovered = null; vrHovered = null;
      autoRot = opts.autorotate !== false;
      if (opts.onVR) opts.onVR(false);
    }

    renderer.xr.addEventListener('sessionstart', enterVRRig);
    renderer.xr.addEventListener('sessionend', exitVRRig);

    const vr = {
      supported() {
        if (!navigator.xr || !navigator.xr.isSessionSupported) return Promise.resolve(false);
        return navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
      },
      enter() {
        if (!navigator.xr) return Promise.reject(new Error('WebXR unavailable'));
        return navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })
          .then(session => { renderer.xr.setReferenceSpaceType('local-floor'); return renderer.xr.setSession(session); });
      },
      exit() { const s = renderer.xr.getSession(); if (s) return s.end(); },
      isActive() { return inVR; },
      // test hook: build the panels + draw sample data outside a session and report the
      // number of clickable regions per panel (validates the in-VR UI without a headset).
      _test(payload) {
        buildVRUI(); vrUI.visible = false;
        payload = payload || {};
        setVRInfo(payload.info || null);
        setVRControls(payload.controls || null);
        setVRNarration(payload.narration || null);
        const count = k => (panels[k] && panels[k].mesh.visible ? panels[k].regions.length : (panels[k] ? panels[k].regions.length : -1));
        return { info: count('info'), side: count('side'), controls: count('controls'), narration: count('narration') };
      },
    };

    /* ---------------- resize + loop ---------------- */
    function resize() {
      const r = dom.getBoundingClientRect();
      const w = Math.max(2, r.width), h = Math.max(2, r.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize); ro.observe(dom.parentElement || dom);
    resize();

    let t0 = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      idleTimer += dt;
      if (inVR) pollVR(dt);
      if (autoRot && !dragging && idleTimer > 1.2) sphGoal.theta += dt * 0.11;
      const k = 1 - Math.pow(0.0016, dt);
      sph.radius += (sphGoal.radius - sph.radius) * k;
      sph.phi += (sphGoal.phi - sph.phi) * k;
      sph.theta += (sphGoal.theta - sph.theta) * k;
      target.lerp(tgtGoal, k);
      if (!renderer.xr.isPresenting) applyCamera();   // in VR the headset pose drives the camera

      if (loaded && hiOn) {
        // ---- functional-system highlight pass ----
        const fade = 1 - Math.pow(0.0022, dt);
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);   // gentle breathing glow
        allMeshes.forEach(m => {
          const ud = m.userData;
          const hemiOk = !ud.hemiHidden;
          const cap = ud.maxOpacity != null ? ud.maxOpacity : 1;
          const isActive = hemiOk && hiActive.has(ud.nodeId);
          const isSeen = hemiOk && !isActive && hiSeen.has(ud.nodeId);
          let tgt;
          if (isActive) tgt = Math.min(cap, 1);
          else if (isSeen) tgt = Math.min(cap, 0.62);
          else if (hemiOk && GHOST_CATS.has(ud.cat)) tgt = 0.05;   // faint context
          else tgt = 0;
          m.material.opacity += (tgt - m.material.opacity) * (isActive ? 1 : fade);
          m.material.depthWrite = m.material.opacity >= 0.98;
          m.visible = m.material.opacity > 0.012;
          m.material.color.copy(ud.baseColor);
          if (isActive) {
            m.material.emissive.copy(ud.baseColor).multiplyScalar(Math.min(1.1, ud.baseEmiss * 2.4 + 0.30 + pulse * 0.22));
            m.renderOrder = 3;
          } else if (isSeen) {
            m.material.emissive.copy(ud.baseColor).multiplyScalar(ud.baseEmiss + 0.05);
            m.renderOrder = 1;
          } else {
            m.material.emissive.copy(ud.baseColor).multiplyScalar(ud.baseEmiss * 0.4);
            m.renderOrder = 0;
          }
        });
      } else if (loaded) {
        const fade = 1 - Math.pow(0.0022, dt);
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);   // gentle breathing glow for VR feedback
        allMeshes.forEach(m => {
          const c = cats[m.userData.cat];
          const want = c && c.want && !m.userData.hemiHidden && !m.userData.isoHidden && !m.userData.subsetHidden;
          const cap = m.userData.maxOpacity != null ? m.userData.maxOpacity : 1;
          const isSel = selectedIds.has(m);
          // a selected structure is forced fully opaque (even under a faded cortex) and glows
          const tgt = isSel ? 1 : (want ? Math.min(cap, c.targetOpacity) : 0);
          m.material.opacity += (tgt - m.material.opacity) * (isSel ? 1 : fade);
          // translucent meshes must not write depth, or they cull what's behind them
          m.material.depthWrite = m.material.opacity >= 0.98;
          m.visible = m.material.opacity > 0.012;
          if (isSel && inVR) {
            // in VR (dark stage, no HTML card) a darker shade reads as "vanished" -
            // so the selection BRIGHTENS and breathes to clearly stand out instead
            m.material.color.copy(m.userData.baseColor);
            m.material.emissive.copy(m.userData.baseColor).multiplyScalar(Math.min(1.2, m.userData.baseEmiss * 2.2 + 0.5 + pulse * 0.25));
          } else if (isSel) {
            // selected: render as a noticeably DARKER shade of its own colour
            m.material.color.copy(m.userData.baseColor).multiplyScalar(0.38);
            m.material.emissive.copy(m.userData.baseColor).multiplyScalar(m.userData.baseEmiss * 0.5);
          } else {
            m.material.color.copy(m.userData.baseColor);
            let e = m.userData.baseEmiss + (m === hovered ? (inVR ? 0.35 : 0.2) : 0);
            m.material.emissive.copy(m.userData.baseColor).multiplyScalar(e);
          }
          m.renderOrder = isSel ? 2 : 0;
        });
      }
      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(loop);   // setAnimationLoop (not rAF) so WebXR can drive the frame loop in VR

    /* ---------------- live re-palette ---------------- */
    function setPalette(map) {
      allMeshes.forEach(m => {
        const hex = map[m.userData.cat]; if (!hex) return;
        const c = shade(m.userData.cat, hex);
        m.userData.baseColor = c.clone();
        m.material.color.copy(c);           // emissive is recomputed each frame from baseColor
      });
    }

    /* ---------------- high-definition poster ---------------- */
    function capturePoster(W, H, meta) {
      meta = meta || {};
      const SS = 1.5;                                   // supersample for clean edges
      const rw = Math.round(W * SS), rh = Math.round(H * SS);
      const rt = new T.WebGLRenderTarget(rw, rh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat });
      const oldA = camera.aspect;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
      const buf = new Uint8Array(rw * rh * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, rw, rh, buf);
      renderer.setRenderTarget(null);
      camera.aspect = oldA; camera.updateProjectionMatrix(); rt.dispose();

      const tmp = document.createElement('canvas'); tmp.width = rw; tmp.height = rh;
      tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf), rw, rh), 0, 0);

      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const cs = getComputedStyle(document.documentElement);
      const gv = (n, f) => (cs.getPropertyValue(n) || f).trim();
      const s1 = gv('--stage-1', '#1a2236'), s2 = gv('--stage-2', '#0c1018'), s3 = gv('--stage-3', '#06080d');
      const onc = gv('--on-stage', '#E9EDF6'), ons = gv('--on-stage-soft', '#9aa6bd');
      const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.72);
      g.addColorStop(0, s1); g.addColorStop(0.5, s2); g.addColorStop(1, s3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tmp, 0, 0, W, H); ctx.restore();

      // top wordmark
      ctx.textBaseline = 'alphabetic';
      ctx.font = '600 26px "JetBrains Mono", monospace'; ctx.fillStyle = ons; ctx.globalAlpha = 0.85;
      ctx.fillText('BRAIN PROJECT', 64, 86); ctx.globalAlpha = 1;
      // bottom scrim
      const sg = ctx.createLinearGradient(0, H - 380, 0, H);
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = sg; ctx.fillRect(0, H - 380, W, 380);
      // accent dot + title
      const accent = meta.color || '#3A66FF';
      ctx.beginPath(); ctx.arc(64 + 13, H - 150, 13, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      ctx.font = '800 78px "Hanken Grotesk", sans-serif'; ctx.fillStyle = onc;
      ctx.fillText(meta.title || 'Whole brain', 64 + 44, H - 124);
      ctx.font = '500 28px "Hanken Grotesk", sans-serif'; ctx.fillStyle = ons;
      let sub = (meta.subtitle || '');
      while (sub && ctx.measureText(sub).width > W - 128) sub = sub.slice(0, -2);
      if (sub !== (meta.subtitle || '')) sub = sub.replace(/\s+\S*$/, '') + ' …';
      ctx.fillText(sub, 64 + 44, H - 80);
      return cv.toDataURL('image/png');
    }

    return {
      THREE: T, scene, camera, renderer, cats,
      setLayer, setLayers, setHemisphere, focusCategory, focusNode,
      selectNode, clearSelect, reset, frameSphere, snap, isolate, setSubset, zoom,
      setHighlight, clearHighlight, frameNodes,
      setAutoRotate, setExposure, setBackground, setPalette, capturePoster, vr, setVRInfo, setVRControls, setVRNarration,
      dispose() { try { const s = renderer.xr.getSession(); if (s) s.end(); } catch (e) {} renderer.setAnimationLoop(null); ro.disconnect(); renderer.dispose(); },
    };
  }

  window.BrainScene = { create };
})();

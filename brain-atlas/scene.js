/* ============================================================
   Brain Atlas - REAL specimen scene (Three.js r137 global)
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
  };
  // structures kept translucent even at full layer opacity (you see through them)
  const MAX_OPACITY = { meninges_dura: 0.34, ventricles: 0.9 };
  const VESSEL = new Set(['arteries', 'veins_sinuses', 'cranial_nerves']);
  // tone down the very light masses so the cortex doesn't read as neon-white on the dark stage
  const CAT_SHADE = { cortex: 0.62, white_matter: 0.8 };
  function shade(cat, hex) { const c = new T.Color(hex || '#cccccc'); if (CAT_SHADE[cat]) c.multiplyScalar(CAT_SHADE[cat]); return c; }

  function extras(o) {
    if (o.userData && o.userData.bx_cat != null) return o.userData;
    if (o.parent && o.parent.userData && o.parent.userData.bx_cat != null) return o.parent.userData;
    return o.userData || {};
  }

  // The right hemisphere in the Z-Anatomy source is a negative-scale mirror of the
  // left; the export bakes that mirror straight into the vertices, which leaves the
  // right cortex shells wound inside-out. With front-face culling that renders only
  // their inner surface ("corrupt"-looking) while the left renders normally. Reverse
  // the triangle winding and flip the normals so the right cortex matches the left.
  function flipInsideOut(geo) {
    const idx = geo.index;
    if (idx) { const a = idx.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } idx.needsUpdate = true; }
    const nrm = geo.attributes.normal;
    if (nrm) { const a = nrm.array; for (let i = 0; i < a.length; i++) a[i] = -a[i]; nrm.needsUpdate = true; }
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
        if (cat === 'cortex' && side === 'right') flipInsideOut(o.geometry);
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

    let raf = 0, t0 = performance.now();
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      idleTimer += dt;
      if (autoRot && !dragging && idleTimer > 1.2) sphGoal.theta += dt * 0.11;
      const k = 1 - Math.pow(0.0016, dt);
      sph.radius += (sphGoal.radius - sph.radius) * k;
      sph.phi += (sphGoal.phi - sph.phi) * k;
      sph.theta += (sphGoal.theta - sph.theta) * k;
      target.lerp(tgtGoal, k);
      applyCamera();

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
          if (isSel) {
            // selected: render as a noticeably DARKER shade of its own colour
            m.material.color.copy(m.userData.baseColor).multiplyScalar(0.38);
            m.material.emissive.copy(m.userData.baseColor).multiplyScalar(m.userData.baseEmiss * 0.5);
          } else {
            m.material.color.copy(m.userData.baseColor);
            let e = m.userData.baseEmiss + (m === hovered ? 0.2 : 0);
            m.material.emissive.copy(m.userData.baseColor).multiplyScalar(e);
          }
          m.renderOrder = isSel ? 2 : 0;
        });
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

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
      ctx.fillText('BRAIN ATLAS', 64, 86); ctx.globalAlpha = 1;
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
      setAutoRotate, setExposure, setBackground, setPalette, capturePoster,
      dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
    };
  }

  window.BrainScene = { create };
})();

/* Brain Atlas — app composition, state & scene wiring */

const CAT_ORDER = window.BRAIN.depth; // outer -> inner peel order
const SHORT = {
  meninges_dura: 'Dura & falx', veins_sinuses: 'Sinuses', arteries: 'Arteries', cortex: 'Cortex',
  white_matter: 'White matter', deep_grey: 'Deep grey', diencephalon: 'Diencephalon',
  ventricles: 'Ventricles', brainstem: 'Brainstem', cerebellum: 'Cerebellum', cranial_nerves: 'Nerves',
};

const PRESETS = [
  { id: 'whole',  label: 'Whole brain',     color: 'var(--c-cortex)',         on: ['cortex','cerebellum','brainstem'], cortex: 1,    focus: null },
  { id: 'vasc',   label: 'Vasculature',      color: 'var(--c-arteries)',       on: ['arteries','veins_sinuses'],        cortex: 0.12, focus: 'arteries' },
  { id: 'willis', label: 'Circle of Willis', color: 'var(--c-arteries)',       on: ['arteries'],                        cortex: 0.08, focus: 'arteries' },
  { id: 'vent',   label: 'Ventricles',       color: 'var(--c-ventricles)',     on: ['ventricles'],                      cortex: 0.10, focus: 'ventricles' },
  { id: 'limbic', label: 'Limbic system',    color: 'var(--c-deep_grey)',      on: ['deep_grey','white_matter','diencephalon'], cortex: 0.12, focus: 'deep_grey' },
  { id: 'deep',   label: 'Deep grey',        color: 'var(--c-deep_grey)',      on: ['deep_grey','diencephalon','ventricles'],   cortex: 0.12, focus: 'deep_grey' },
  { id: 'nerves', label: 'Cranial nerves',   color: 'var(--c-cranial_nerves)', on: ['cranial_nerves','brainstem'],      cortex: 0.12, focus: 'cranial_nerves' },
  { id: 'dura',   label: 'Meninges & dura',  color: 'var(--c-meninges_dura)',  on: ['meninges_dura','veins_sinuses'],   cortex: 0.30, focus: null },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3A66FF",
  "stage": "deep blue",
  "surface": "frosted",
  "autorotate": true,
  "glow": 1.06
}/*EDITMODE-END*/;

const STAGES = {
  'deep blue':  ['#1a2236', '#0c1018', '#06080d', '#E9EDF6', '#9aa6bd'],
  'charcoal':   ['#26262b', '#141417', '#08080a', '#ECECEE', '#9b9ba3'],
  'clinical':   ['#dfe6f0', '#c4cedd', '#aebccf', '#1a2030', '#5a667a'],
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const nodes = window.BRAIN.nodes;
  const cats = window.BRAIN.categories;
  const PAL = window.BRAIN.palette;
  const DESC = window.BRAIN.descriptions;

  // ---- build grouped tree (memo) ----
  const groups = React.useMemo(() => {
    return CAT_ORDER.map(cat => {
      const ns = nodes.filter(n => n.category === cat);
      const byRegion = {};
      ns.forEach(n => { (byRegion[n.region] = byRegion[n.region] || []).push({ id: n.id, label: n.label, side: n.side }); });
      const regions = Object.keys(byRegion).sort().map(region => ({
        region, items: byRegion[region].sort((a, b) => a.label.localeCompare(b.label) || a.side.localeCompare(b.side)),
      }));
      return { cat, label: cats[cat].label, count: ns.length, color: PAL[cat], regions };
    });
  }, []);
  const nodeById = React.useMemo(() => { const m = {}; nodes.forEach(n => m[n.id] = n); return m; }, []);

  // ---- state ----
  const [search, setSearch] = React.useState('');
  const [hemisphere, setHemisphere] = React.useState('both');
  const [cortexOpacity, setCortexOpacity] = React.useState(1);
  const [layerOn, setLayerOn] = React.useState(() => { const o = {}; CAT_ORDER.forEach(c => o[c] = ['cortex', 'cerebellum', 'brainstem'].includes(c)); return o; });
  const [expanded, setExpanded] = React.useState(() => new Set());
  const [selectedId, setSelectedId] = React.useState(null);
  const [isolatedIds, setIsolatedIds] = React.useState(null);
  const [activePreset, setActivePreset] = React.useState('whole');
  const [depthStop, setDepthStop] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState(false);
  const [railExpanded, setRailExpanded] = React.useState(false);
  const [pos, setPos] = React.useState(() => { try { return JSON.parse(localStorage.getItem('ba_pos')) || { x: 16, y: 16 }; } catch (e) { return { x: 16, y: 16 }; } });
  const [hover, setHover] = React.useState(null); // {id, x, y}
  const [hint, setHint] = React.useState(true);

  React.useEffect(() => { try { localStorage.setItem('ba_pos', JSON.stringify(pos)); } catch (e) {} }, [pos]);

  const sceneRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  // ---- search matching ----
  const q = search.trim();
  const matchedIds = React.useMemo(() => {
    const s = new Set();
    if (!q) return s;
    const lq = q.toLowerCase();
    nodes.forEach(n => {
      if (n.label.toLowerCase().includes(lq) || n.region.toLowerCase().includes(lq) ||
          (n.crumb || []).some(c => c.toLowerCase().includes(lq)) || n.category.includes(lq)) s.add(n.id);
    });
    return s;
  }, [q]);
  const matchedCats = React.useMemo(() => { const c = new Set(); matchedIds.forEach(id => c.add(nodeById[id].category)); return c; }, [matchedIds]);

  // auto-expand categories with matches
  React.useEffect(() => {
    if (q) setExpanded(new Set(matchedCats));
  }, [q]);

  // ---- scene init ----
  React.useEffect(() => {
    const s = window.BrainScene.create(canvasRef.current, {
      autorotate: t.autorotate,
      onPick: (id) => { if (id != null) { setSelectedId(id); setHint(false); } else setSelectedId(null); },
      onHover: (id) => setHover(h => id != null ? { id } : null),
    });
    sceneRef.current = s; window.__BA = s;
    return () => s.dispose();
  }, []);

  // ---- compose & push to scene ----
  const firstCompose = React.useRef(true);
  React.useEffect(() => {
    const s = sceneRef.current; if (!s) return;
    const map = {};
    const isoCats = isolatedIds ? new Set([...isolatedIds].map(id => nodeById[id].category)) : null;
    CAT_ORDER.forEach(cat => {
      let visible = layerOn[cat];
      let opacity = cat === 'cortex' ? cortexOpacity : 1;
      if (q && !matchedCats.has(cat)) opacity *= 0.12;
      if (isoCats && !isoCats.has(cat)) visible = false;
      map[cat] = { visible, opacity };
    });
    s.setLayers(map);
    s.setHemisphere(hemisphere);
    s.isolate(isolatedIds ? [...isolatedIds] : null);
    if (selectedId != null) s.selectNode(selectedId); else s.clearSelect();
    if (firstCompose.current) { s.snap(); firstCompose.current = false; }
  }, [layerOn, cortexOpacity, hemisphere, q, matchedCats, isolatedIds, selectedId]);

  React.useEffect(() => { sceneRef.current && sceneRef.current.setAutoRotate(t.autorotate); }, [t.autorotate]);
  React.useEffect(() => { sceneRef.current && sceneRef.current.setExposure(t.glow); }, [t.glow]);

  // ---- tweaks -> CSS vars ----
  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-soft', t.accent + '1f');
    r.setProperty('--accent-ring', t.accent + '66');
    const sg = STAGES[t.stage] || STAGES['deep blue'];
    r.setProperty('--stage-1', sg[0]); r.setProperty('--stage-2', sg[1]); r.setProperty('--stage-3', sg[2]);
    r.setProperty('--on-stage', sg[3]); r.setProperty('--on-stage-soft', sg[4]);
    if (t.surface === 'solid') { r.setProperty('--glass', 'var(--glass-solid)'); }
    else { r.setProperty('--glass', 'rgba(249,250,252,0.74)'); }
  }, [t.accent, t.stage, t.surface]);

  // ---- actions ----
  const toggleLayer = (cat) => { setActivePreset(null); setLayerOn(o => ({ ...o, [cat]: !o[cat] })); };
  const onExpand = (cat) => setExpanded(s => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  const showAll = () => { setActivePreset(null); setLayerOn(() => { const o = {}; CAT_ORDER.forEach(c => o[c] = true); return o; }); setDepthStop(0); };
  const hideAll = () => { setActivePreset(null); setLayerOn(() => { const o = {}; CAT_ORDER.forEach(c => o[c] = false); return o; }); };
  const selectNode = (id) => { setSelectedId(id); setHint(false); };
  const focusNode = (id) => { sceneRef.current && sceneRef.current.focusNode(id); setSelectedId(id); setHint(false); };
  const focusCat = (cat) => sceneRef.current && sceneRef.current.focusCategory(cat);
  const reset = () => {
    setActivePreset('whole'); applyPreset(PRESETS[0], false);
    setHemisphere('both'); setIsolatedIds(null); setSearch(''); setSelectedId(null); setDepthStop(0);
    sceneRef.current && sceneRef.current.reset();
  };

  const applyPreset = (p, doFocus = true) => {
    setActivePreset(p.id);
    setIsolatedIds(null); setSearch('');
    const o = {}; CAT_ORDER.forEach(c => o[c] = p.on.includes(c) || (c === 'cortex' && p.cortex > 0));
    setLayerOn(o); setCortexOpacity(p.cortex);
    setDepthStop(0);
    if (doFocus && p.focus) setTimeout(() => sceneRef.current && sceneRef.current.focusCategory(p.focus), 60);
    else if (doFocus) sceneRef.current && sceneRef.current.reset();
  };

  const setStop = (stop) => {
    setActivePreset(null); setDepthStop(stop);
    setLayerOn(() => { const o = {}; CAT_ORDER.forEach((c, i) => o[c] = i >= stop); return o; });
  };

  const isolateMatches = () => { if (matchedIds.size) setIsolatedIds(new Set(matchedIds)); };
  const isolateNode = (id) => {
    const n = nodeById[id];
    const ids = nodes.filter(x => x.category === n.category).map(x => x.id);
    setIsolatedIds(new Set(ids));
    setTimeout(() => sceneRef.current && sceneRef.current.focusCategory(n.category), 60);
  };
  const clearIsolate = () => setIsolatedIds(null);

  // ---- selection derived ----
  const selNode = selectedId != null ? nodeById[selectedId] : null;
  const related = React.useMemo(() => {
    if (!selNode) return [];
    return nodes.filter(n => n.id !== selNode.id && n.category === selNode.category && n.region === selNode.region)
      .slice(0, 5).map(n => ({ id: n.id, label: n.label, side: n.side }));
  }, [selectedId]);
  const description = selNode ? (DESC[selNode.label] || ('A structure of the ' + cats[selNode.category].label.toLowerCase() + ', located in the ' + selNode.region.replace(/_/g, ' ') + '.')) : '';

  // ---- keyboard ----
  React.useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === '/') { e.preventDefault(); const i = document.querySelector('.glass input'); i && i.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setStop(Math.min(CAT_ORDER.length - 1, depthStop + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setStop(Math.max(0, depthStop - 1)); }
      else if (e.key === 'Escape') { if (isolatedIds) clearIsolate(); else setSelectedId(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [depthStop, isolatedIds]);

  const depthLayers = CAT_ORDER.map(c => ({ cat: c, color: PAL[c], short: SHORT[c] }));
  const hoverNode = hover ? nodeById[hover.id] : null;

  return (
    <React.Fragment>
      <div className="stage" />
      <canvas ref={canvasRef} className="three" />

      {/* corner brand / legend toggle */}
      <Legend groups={groups} layerOn={layerOn} />

      {hint && (
        <div className="pop" style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 12,
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99,
          background: 'rgba(8,11,18,0.55)', color: 'var(--on-stage)', fontSize: 12.5, fontWeight: 500, backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)' }}>
          <Icon name="crosshair" size={14} style={{ color: 'var(--on-stage-soft)' }} />
          Drag to rotate · scroll to zoom · click a structure to inspect
        </div>
      )}

      <ControlPanel
        totalCount={nodes.length}
        groups={groups} layerOn={layerOn} expanded={expanded}
        onToggleLayer={toggleLayer} onExpand={onExpand}
        onSelect={selectNode} onFocus={focusNode} onFocusCat={focusCat}
        selectedId={selectedId}
        search={search} setSearch={(v) => { setSearch(v); setActivePreset(null); }} matchedIds={matchedIds} matchCount={matchedIds.size}
        hemisphere={hemisphere} setHemisphere={(v) => { setHemisphere(v); }}
        cortexOpacity={cortexOpacity} setCortexOpacity={(v) => { setCortexOpacity(v); setActivePreset(null); }}
        presets={PRESETS} activePreset={activePreset} onPreset={(id) => applyPreset(PRESETS.find(p => p.id === id))}
        onReset={reset} onShowAll={showAll} onHideAll={hideAll}
        onIsolateMatches={isolateMatches} canIsolate={matchedIds.size > 0}
        isolated={!!isolatedIds} onClearIsolate={clearIsolate}
        pos={pos} setPos={setPos} collapsed={collapsed} setCollapsed={setCollapsed}
        q={q}
      />

      <DepthRail layers={depthLayers} stop={depthStop} setStop={setStop} expanded={railExpanded} setExpanded={setRailExpanded} />

      <SelectionCard node={selNode} color={selNode ? PAL[selNode.category] : null}
        catLabel={selNode ? cats[selNode.category].label : ''} description={description} related={related}
        onSelect={selectNode} onFocus={focusNode} onIsolate={isolateNode} onClose={() => setSelectedId(null)}
        isolated={!!isolatedIds} />

      {/* hover tooltip */}
      {hoverNode && !selNode && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 14,
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 99,
          background: 'rgba(8,11,18,0.6)', color: 'var(--on-stage)', fontSize: 12.5, fontWeight: 600, backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }}>
          <Dot color={PAL[hoverNode.category]} size={8} />{hoverNode.label}
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent} options={['#3A66FF', '#12B5C9', '#7C5CFF', '#F0556B', '#1F9E63']} onChange={v => setTweak('accent', v)} />
        <TweakRadio label="Stage" value={t.stage} options={['deep blue', 'charcoal', 'clinical']} onChange={v => setTweak('stage', v)} />
        <TweakRadio label="Panel surface" value={t.surface} options={['frosted', 'solid']} onChange={v => setTweak('surface', v)} />
        <TweakSection label="Specimen" />
        <TweakToggle label="Idle auto-rotate" value={t.autorotate} onChange={v => setTweak('autorotate', v)} />
        <TweakSlider label="Specimen glow" value={t.glow} min={0.8} max={1.4} step={0.02} unit="×" onChange={v => setTweak('glow', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

/* small bottom-left-of-stage legend that reflects visible subsystems */
function Legend({ groups, layerOn }) {
  const [open, setOpen] = React.useState(false);
  const visible = groups.filter(g => layerOn[g.cat]);
  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {open && (
        <div className="glass pop" style={{ padding: '12px 14px', width: 210 }}>
          <div className="eyebrow" style={{ marginBottom: 9 }}>Subsystem key</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {groups.map(g => (
              <div key={g.cat} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: layerOn[g.cat] ? 1 : 0.35 }}>
                <Dot color={g.color} size={10} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>{g.label.split(/[\u2013(]/)[0].trim()}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-ghost)' }}>{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="glass" style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 99, border: '1px solid var(--glass-edge)',
        color: 'var(--ink-soft)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}>
        <Icon name="info" size={14} /> Key
        <span style={{ display: 'flex', marginLeft: 2 }}>
          {visible.slice(0, 6).map((g, i) => <span key={g.cat} style={{ width: 9, height: 9, borderRadius: 99, background: g.color, marginLeft: i ? -3 : 0, boxShadow: '0 0 0 1.5px var(--glass)' }} />)}
        </span>
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

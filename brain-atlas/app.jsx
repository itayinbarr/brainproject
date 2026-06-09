/* Brain Atlas - app composition, state & scene wiring */

const CAT_ORDER = window.BRAIN.depth; // outer -> inner peel order
const SHORT = {
  meninges_dura: 'Dura & falx', veins_sinuses: 'Sinuses', arteries: 'Arteries', cortex: 'Cortex',
  white_matter: 'White matter', deep_grey: 'Deep grey', diencephalon: 'Diencephalon',
  ventricles: 'Ventricles', brainstem: 'Brainstem', cerebellum: 'Cerebellum', cranial_nerves: 'Nerves',
};

const PRESETS = [
  { id: 'whole',  label: 'Whole brain',     color: 'var(--c-cortex)',         on: ['cortex','cerebellum','brainstem'], cortex: 1,    focus: null },
  { id: 'vasc',   label: 'Vasculature',      color: 'var(--c-arteries)',       on: ['arteries','veins_sinuses'],        cortex: 0.12, focus: 'arteries' },
  { id: 'willis', label: 'Circle of Willis', color: 'var(--c-arteries)',       on: ['arteries'],                        cortex: 0.08, focus: 'arteries',
    subset: { arteries: ['Anterior cerebral artery', 'Anterior communicating artery', 'Internal carotid artery', 'Posterior communicating artery', 'Posterior cerebral artery', 'Basilar artery'] } },
  { id: 'vent',   label: 'Ventricles',       color: 'var(--c-ventricles)',     on: ['ventricles'],                      cortex: 0.10, focus: 'ventricles' },
  { id: 'limbic', label: 'Limbic system',    color: 'var(--c-deep_grey)',      on: ['deep_grey','white_matter','diencephalon'], cortex: 0.12, focus: 'deep_grey',
    // Only the true limbic structures - excludes corpus callosum, basal ganglia, thalamus, geniculate/optic relays, etc.
    subset: {
      deep_grey:    ['Lateral nucleus', 'Basolateral complex', 'Central nucleus', 'Corticomedial group', 'Septal nuclei'],
      white_matter: ['Fornix', 'Hippocampal commissure', 'Stria terminalis', 'Anterior commissure'],
      diencephalon: ['Mamillary body', 'Preoptic hypothalamus', 'Anterior hypothalamus', 'Tuberal hypothalamus', 'Lateral hypothalamus', 'Posterior hypothalamus', 'Habenula', 'Stria medullaris thalami'],
    } },
  { id: 'deep',   label: 'Deep grey',        color: 'var(--c-deep_grey)',      on: ['deep_grey','diencephalon'],   cortex: 0.12, focus: 'deep_grey' },
  { id: 'bgnuc',  label: 'Basal ganglia',    color: 'var(--c-deep_grey)',      on: ['deep_grey','brainstem'],           cortex: 0.10, focus: 'deep_grey',
    // Caudate/putamen/accumbens + the atlas-derived pallidal & subthalamic nuclei (GPe/GPi, STN, SN) and the brainstem red nucleus.
    subset: {
      deep_grey: ['Caudate nucleus', 'Putamen', 'Nucleus accumbens', 'Globus pallidus external', 'Globus pallidus internal', 'Subthalamic nucleus', 'Substantia nigra'],
      brainstem: ['Red nucleus'],
    } },
  { id: 'thalnuc', label: 'Thalamic nuclei', color: 'var(--c-diencephalon)',   on: ['diencephalon'],                    cortex: 0.10, focus: 'diencephalon',
    subset: { diencephalon: ['Pulvinar', 'Anterior nuclei of thalamus', 'Mediodorsal nucleus', 'Ventral laterodorsal nucleus', 'Ventral lateroventral nucleus', 'Ventral anterior nucleus', 'Intralaminar and lateral posterior nuclei', 'Lateral geniculate body', 'Medial geniculate body'] } },
  { id: 'nerves', label: 'Cranial nerves',   color: 'var(--c-cranial_nerves)', on: ['cranial_nerves','brainstem'],      cortex: 0.12, focus: 'cranial_nerves' },
  { id: 'dura',   label: 'Meninges & dura',  color: 'var(--c-meninges_dura)',  on: ['meninges_dura','veins_sinuses'],   cortex: 0.30, focus: null },
];

// Curated 11-subsystem palettes. Each keeps loose clinical conventions (arteries warm,
// veins/sinuses cool-blue, ventricles cyan/CSF, nerves yellow, cortex light-neutral) while
// staying internally harmonious - consistent chroma/value, hues spread around the wheel.
const PALETTES = [
  { name: 'Jewel',   colors: { cortex:'#E7DEC9', white_matter:'#D7DDE8', deep_grey:'#B57BE0', diencephalon:'#7E8CF2', brainstem:'#E8B24A', cerebellum:'#F0894E', ventricles:'#3FC8D6', arteries:'#F05068', veins_sinuses:'#5078E8', cranial_nerves:'#D9D24A', meninges_dura:'#CC63CC' } },
  { name: 'Candy',   colors: { cortex:'#F0DCC8', white_matter:'#E3DCEA', deep_grey:'#A86CF0', diencephalon:'#5C7CFF', brainstem:'#FFC23D', cerebellum:'#FF8A5C', ventricles:'#2BD9D9', arteries:'#FF5573', veins_sinuses:'#5A78FF', cranial_nerves:'#FFE04A', meninges_dura:'#E85CD0' } },
  { name: 'Aurora',  colors: { cortex:'#DCE3D8', white_matter:'#D2E0E6', deep_grey:'#7C8BE0', diencephalon:'#4FA0E0', brainstem:'#E8C24A', cerebellum:'#F09B5A', ventricles:'#34D6B0', arteries:'#F25C7A', veins_sinuses:'#4A7BE0', cranial_nerves:'#CFE04A', meninges_dura:'#B566D6' } },
  { name: 'Sunset',  colors: { cortex:'#ECD9C2', white_matter:'#E0D6DA', deep_grey:'#9D6BD6', diencephalon:'#6E7BE6', brainstem:'#F2A93C', cerebellum:'#F2734E', ventricles:'#39C2C8', arteries:'#F0455F', veins_sinuses:'#5C6FE0', cranial_nerves:'#F0C84A', meninges_dura:'#D85AA8' } },
  { name: 'Neon',    colors: { cortex:'#DDE6EE', white_matter:'#CCD6E2', deep_grey:'#9A7CF5', diencephalon:'#5B8DF5', brainstem:'#F5C24A', cerebellum:'#F58A4A', ventricles:'#33E0E0', arteries:'#FF4D6D', veins_sinuses:'#4D7AFF', cranial_nerves:'#E8E04A', meninges_dura:'#D24DD2' } },
  { name: 'Muted',   colors: { cortex:'#D8CBB6', white_matter:'#C9D0D8', deep_grey:'#9685C0', diencephalon:'#7C8AC0', brainstem:'#D4A94E', cerebellum:'#D88A5E', ventricles:'#5AB6BE', arteries:'#D85C70', veins_sinuses:'#6E80C8', cranial_nerves:'#C6BE5A', meninges_dura:'#B673B6' } },
  { name: 'Spectrum',colors: { cortex:'#E8DAC0', white_matter:'#D6DEE8', deep_grey:'#A35CE0', diencephalon:'#5C6CE8', brainstem:'#F0B23C', cerebellum:'#F07A3C', ventricles:'#2CC8C8', arteries:'#F0405C', veins_sinuses:'#3C6CE8', cranial_nerves:'#E0D43C', meninges_dura:'#D44CC4' } },
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

function useIsMobile(bp) {
  bp = bp || 640;
  const q = '(max-width: ' + bp + 'px)';
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const h = (e) => setM(e.matches);
    mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', h) : mq.removeListener(h); };
  }, []);
  return m;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const mobile = useIsMobile();
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
  }, [palVer]);
  const nodeById = React.useMemo(() => { const m = {}; nodes.forEach(n => m[n.id] = n); return m; }, []);

  // resolve a system stage to real nodeIds (active = this stage, seen = earlier stages)
  const resolveStage = React.useCallback((systemId, stageIndex) => {
    const sys = window.SYS.SYSTEMS.find(s => s.id === systemId);
    if (!sys || !sys.stages[stageIndex]) return { activeIds: [], seenIds: [] };
    const activeKeys = sys.stages[stageIndex].nodes;
    const seenKeys = new Set();
    for (let i = 0; i < stageIndex; i++) sys.stages[i].nodes.forEach(k => seenKeys.add(k));
    const activeIds = [];
    activeKeys.forEach(k => window.SYS.idsForKey(k).forEach(id => activeIds.push(id)));
    const activeSet = new Set(activeIds);
    const seenIds = [];
    seenKeys.forEach(k => { if (!activeKeys.includes(k)) window.SYS.idsForKey(k).forEach(id => { if (!activeSet.has(id)) seenIds.push(id); }); });
    return { activeIds, seenIds };
  }, []);

  // ---- state ----
  const [search, setSearch] = React.useState('');
  const [searchSide, setSearchSide] = React.useState('both');  // filter results to one side
  const [hemisphere, setHemisphere] = React.useState('left');
  const [cortexOpacity, setCortexOpacity] = React.useState(1);
  const [layerOn, setLayerOn] = React.useState(() => { const o = {}; CAT_ORDER.forEach(c => o[c] = ['cortex', 'cerebellum', 'brainstem'].includes(c)); return o; });
  const [expanded, setExpanded] = React.useState(() => new Set());
  const [selectedId, setSelectedId] = React.useState(null);
  const [isolatedIds, setIsolatedIds] = React.useState(null);
  const [activePreset, setActivePreset] = React.useState('whole');
  const [collapsed, setCollapsed] = React.useState(false);
  const [pos, setPos] = React.useState(() => { try { return JSON.parse(localStorage.getItem('ba_pos')) || { x: 16, y: 16 }; } catch (e) { return { x: 16, y: 16 }; } });
  const [hover, setHover] = React.useState(null); // {id, x, y}
  const [hint, setHint] = React.useState(true);
  const [posterBusy, setPosterBusy] = React.useState(false);
  const [palVer, setPalVer] = React.useState(0);  // bumps when the color palette changes
  const palIdxRef = React.useRef(0);
  const [focusedId, setFocusedId] = React.useState(null); // which node the camera is focused on

  // ---- modes: explore (structural) · systems (functional) · learn (lessons) ----
  const [mode, setMode] = React.useState('explore');
  const [sceneReady, setSceneReady] = React.useState(false);
  // systems
  const [activeSystem, setActiveSystem] = React.useState(null);
  const [sysStep, setSysStep] = React.useState(0);
  const [sysPlaying, setSysPlaying] = React.useState(false);
  // lessons
  const [openLessonId, setOpenLessonId] = React.useState(null);
  const [phase, setPhase] = React.useState(null);          // 'intro' | 'playing' | 'quiz' | 'done'
  const [lessonStep, setLessonStep] = React.useState(0);
  const [lessonPlaying, setLessonPlaying] = React.useState(false);
  const [qIdx, setQIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [completed, setCompleted] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ba_completed') || '[]')); } catch (e) { return new Set(); }
  });
  const [toast, setToast] = React.useState('');
  const flash = (m) => { setToast(m); clearTimeout(window.__tt); window.__tt = setTimeout(() => setToast(''), 2200); };
  const quizPickRef = React.useRef(null);     // LessonQuiz answer() for "find" questions
  const quizFindRef = React.useRef(null);     // { idToKey } while a find-question is live

  React.useEffect(() => { try { localStorage.setItem('ba_completed', JSON.stringify([...completed])); } catch (e) {} }, [completed]);

  const [consent, setConsent] = React.useState(() => (window.BrainAnalytics ? window.BrainAnalytics.consent() : 'denied'));
  const acceptCookies = () => { window.BrainAnalytics && window.BrainAnalytics.grant(); setConsent('granted'); };
  const declineCookies = () => { window.BrainAnalytics && window.BrainAnalytics.deny(); setConsent('denied'); };

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
      // side filter: midline structures have no L/R counterpart, so keep them on either side
      if (searchSide !== 'both' && n.side !== 'median' && n.side !== searchSide) return;
      if (n.label.toLowerCase().includes(lq) || n.region.toLowerCase().includes(lq) ||
          (n.crumb || []).some(c => c.toLowerCase().includes(lq)) || n.category.includes(lq)) s.add(n.id);
    });
    return s;
  }, [q, searchSide]);
  const matchedCats = React.useMemo(() => { const c = new Set(); matchedIds.forEach(id => c.add(nodeById[id].category)); return c; }, [matchedIds]);

  // auto-expand categories with matches
  React.useEffect(() => {
    if (q) setExpanded(new Set(matchedCats));
  }, [q]);

  // ---- scene init ----
  React.useEffect(() => {
    const s = window.BrainScene.create(canvasRef.current, {
      autorotate: t.autorotate,
      onReady: () => setSceneReady(true),
      onPick: (id) => {
        // during a lesson "find this structure" question, a click answers it
        if (id != null && quizFindRef.current) {
          const key = quizFindRef.current.idToKey[id];
          if (key && quizPickRef.current) quizPickRef.current(key);
          return;
        }
        if (id != null) { setSelectedId(id); setHint(false); } else setSelectedId(null);
      },
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
      if (isoCats) { if (!isoCats.has(cat)) visible = false; else opacity = 1; } // isolated layer fully opaque
      map[cat] = { visible, opacity };
    });
    s.setLayers(map);
    s.setHemisphere(hemisphere);
    s.isolate(isolatedIds ? [...isolatedIds] : null);
    // preset-defined sub-selection (e.g. Circle of Willis = only the ring arteries)
    const preset = PRESETS.find(p => p.id === activePreset);
    let subsetMap = null;
    if (preset && preset.subset) {
      subsetMap = {};
      Object.keys(preset.subset).forEach(cat => {
        const labels = new Set(preset.subset[cat]);
        subsetMap[cat] = new Set(nodes.filter(n => n.category === cat && labels.has(n.label)).map(n => n.id));
      });
    }
    s.setSubset(subsetMap);
    if (selectedId != null) s.selectNode(selectedId); else s.clearSelect();
    if (firstCompose.current) { s.snap(); firstCompose.current = false; }
  }, [layerOn, cortexOpacity, hemisphere, q, matchedCats, isolatedIds, selectedId, activePreset]);

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
  const focusNode = (id) => { sceneRef.current && sceneRef.current.focusNode(id); setSelectedId(id); setFocusedId(id); setHint(false); };
  // toggling focus for the selection card: a second press is its own undo (reset view)
  const toggleFocus = (id) => {
    if (focusedId === id) { sceneRef.current && sceneRef.current.reset(); setFocusedId(null); }
    else { sceneRef.current && sceneRef.current.focusNode(id); setFocusedId(id); }
  };
  const focusCat = (cat) => sceneRef.current && sceneRef.current.focusCategory(cat);
  const zoom = (dir) => sceneRef.current && sceneRef.current.zoom(dir);
  const reset = () => {
    setActivePreset('whole'); applyPreset(PRESETS[0], false);
    setHemisphere('left'); setIsolatedIds(null); setSearch(''); setSelectedId(null); setFocusedId(null);
    sceneRef.current && sceneRef.current.reset();
  };

  const applyPreset = (p, doFocus = true) => {
    setActivePreset(p.id);
    setIsolatedIds(null); setSearch(''); setSelectedId(null); setFocusedId(null);  // close any open selection card
    const o = {}; CAT_ORDER.forEach(c => o[c] = p.on.includes(c) || (c === 'cortex' && p.cortex > 0));
    setLayerOn(o); setCortexOpacity(p.cortex);
    if (doFocus && p.focus) setTimeout(() => sceneRef.current && sceneRef.current.focusCategory(p.focus), 60);
    else if (doFocus) sceneRef.current && sceneRef.current.reset();
  };

  // ============================================================
  //  Systems & Lessons
  // ============================================================
  const lesson = openLessonId ? window.SYS.LESSONS.find(l => l.id === openLessonId) : null;
  const lessonSysId = lesson ? lesson.system : null;

  // which pathway stage is currently on the stage (system free-stepping, or a playing lesson)
  let stageActive = null;
  if (lesson && (phase === 'intro' || phase === 'playing')) stageActive = { systemId: lessonSysId, stageIndex: phase === 'intro' ? 0 : lessonStep };
  else if (activeSystem) stageActive = { systemId: activeSystem, stageIndex: sysStep };

  // lesson "find this structure" challenge -> candidate keys glow on the brain
  let quizFind = null;
  if (lesson && phase === 'quiz' && lesson.quiz[qIdx] && lesson.quiz[qIdx].type === 'find' && answers[qIdx] === undefined) {
    quizFind = { keys: lesson.quiz[qIdx].options, answerKey: lesson.quiz[qIdx].answer };
  }
  const playerOpen = !!stageActive || (lesson && (phase === 'quiz' || phase === 'done'));

  const stageKey = stageActive ? stageActive.systemId + ':' + stageActive.stageIndex : 'none';
  const quizKey = quizFind ? openLessonId + ':q' + qIdx : 'none';

  // ---- drive the real 3D scene from the active pathway stage / quiz ----
  React.useEffect(() => {
    const s = sceneRef.current; if (!s) return;
    if (quizFind) {
      const ids = []; const idToKey = {};
      quizFind.keys.forEach(k => window.SYS.idsForKey(k).forEach(id => { ids.push(id); idToKey[id] = k; }));
      quizFindRef.current = { idToKey };
      s.setHighlight(ids, []);
      s.frameNodes(ids, 2.8);
    } else if (stageActive) {
      quizFindRef.current = null;
      const { activeIds, seenIds } = resolveStage(stageActive.systemId, stageActive.stageIndex);
      s.setHighlight(activeIds, seenIds);
      s.frameNodes(activeIds.length ? activeIds : seenIds, 3.0);
    } else {
      quizFindRef.current = null;
      s.clearHighlight();
    }
  }, [stageKey, quizKey, sceneReady]);

  // ---- system actions ----
  const startSystem = (id) => {
    if (activeSystem === id) { setActiveSystem(null); setSysPlaying(false); if (!mobile) setCollapsed(false); return; }
    setActiveSystem(id); setSysStep(0); setSysPlaying(false); setSelectedId(null);
    if (!mobile) setCollapsed(true);   // focus on the model + narration card
  };
  const closeSystem = () => { setActiveSystem(null); setSysPlaying(false); if (!mobile) setCollapsed(false); sceneRef.current && sceneRef.current.reset(); };

  // ---- lesson actions ----
  const openLesson = (id) => {
    if (!window.SYS.LESSONS.some(l => l.id === id)) return;
    setOpenLessonId(id); setPhase('intro'); setLessonStep(0); setLessonPlaying(false);
    setQIdx(0); setAnswers({}); setSelectedId(null); setActiveSystem(null); setMode('learn');
    if (!mobile) setCollapsed(true);
  };
  const beginLesson = () => { setPhase('playing'); setLessonStep(0); setLessonPlaying(true); };
  const finishStages = () => {
    if (lesson && lesson.quiz) { setPhase('quiz'); setQIdx(0); setAnswers({}); setLessonPlaying(false); }
    else completeLesson();
  };
  const completeLesson = () => {
    setLessonPlaying(false); setPhase('done');
    setCompleted(c => new Set([...c, openLessonId]));
  };
  const closeLesson = () => { setOpenLessonId(null); setPhase(null); setLessonPlaying(false); if (!mobile) setCollapsed(false); sceneRef.current && sceneRef.current.reset(); };
  const replayLesson = () => { setPhase('playing'); setLessonStep(0); setQIdx(0); setAnswers({}); setLessonPlaying(true); };

  // ---- mode switching (stop whatever the other modes were running) ----
  const switchMode = (m) => {
    setMode(m);
    if (m !== 'systems') { setActiveSystem(null); setSysPlaying(false); }
    if (m !== 'learn') { setOpenLessonId(null); setPhase(null); setLessonPlaying(false); }
    if (m === 'explore') { setSelectedId(null); }
  };

  const applyPalette = (pal) => {
    Object.assign(window.BRAIN.palette, pal);                       // mutate in place so PAL ref sees it
    const r = document.documentElement.style;
    Object.keys(pal).forEach(k => r.setProperty('--c-' + k, pal[k]));
    sceneRef.current && sceneRef.current.setPalette(pal);
    setPalVer(v => v + 1);                                          // re-render dots/legend/tree
  };
  const randomizePalette = () => {
    let j; do { j = Math.floor(Math.random() * PALETTES.length); } while (j === palIdxRef.current && PALETTES.length > 1);
    palIdxRef.current = j;
    applyPalette(PALETTES[j].colors);
  };

  const isolateMatches = () => { if (matchedIds.size) setIsolatedIds(new Set(matchedIds)); };
  const isolateNode = (id) => {
    // isolate exactly the clicked structure (both sides if it is one of a pair)
    const n = nodeById[id];
    const ids = nodes.filter(x => x.label === n.label && x.category === n.category).map(x => x.id);
    setIsolatedIds(new Set(ids.length ? ids : [id]));
    setTimeout(() => sceneRef.current && sceneRef.current.focusNode(id), 60);
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

  // ---- high-definition poster export (features the selection if any) ----
  const savePoster = async () => {
    const s = sceneRef.current; if (!s || posterBusy) return;
    setPosterBusy(true);
    try {
      if (selectedId != null) { s.focusNode(selectedId); await new Promise(r => setTimeout(r, 750)); }
      const title = selNode ? selNode.label : 'Whole brain';
      const sub = selNode
        ? ((selNode.crumb && selNode.crumb.length ? selNode.crumb.join('  ·  ') : cats[selNode.category].label)
           + (selNode.side !== 'median' ? '  ·  ' + (selNode.side === 'left' ? 'Left' : 'Right') : ''))
        : 'Interactive 3D brain atlas';
      const url = s.capturePoster(2400, 1500, { title, subtitle: sub, color: selNode ? PAL[selNode.category] : t.accent });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brain-atlas-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.error('poster failed', e); }
    setPosterBusy(false);
  };

  // ---- shareable deep link (GitHub Pages friendly: plain query params) ----
  const buildShareUrl = () => {
    const p = new URLSearchParams();
    p.set('mode', mode);
    if (mode === 'systems' && activeSystem) { p.set('sys', activeSystem); p.set('step', String(sysStep)); }
    else if (mode === 'learn' && openLessonId) { p.set('lesson', openLessonId); }
    else {
      if (activePreset && activePreset !== 'whole') p.set('preset', activePreset);
      if (hemisphere !== 'left') p.set('hemi', hemisphere);
      if (selectedId != null) {
        p.set('sel', String(selectedId));
        if (focusedId === selectedId) p.set('focus', '1');   // shared from focused mode -> reopen focused
      }
    }
    return location.origin + location.pathname + '?' + p.toString();
  };
  const copyShareLink = async () => {
    const url = buildShareUrl();
    try { await navigator.clipboard.writeText(url); flash('Link copied to clipboard'); }
    catch (e) { window.prompt('Copy this link', url); }
  };

  // restore state from a shared link (once, on mount). The deep-linked structure is
  // applied later, once the specimen has loaded, since the camera can't frame a mesh
  // before then - see the sceneReady effect below.
  const didRestore = React.useRef(false);
  const pendingDeep = React.useRef(null);   // { id, focus } parsed from the link
  React.useEffect(() => {
    if (didRestore.current) return; didRestore.current = true;
    let p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    if (![...p.keys()].length) return;
    if (p.get('sys')) {
      const id = p.get('sys');
      if (window.SYS.SYSTEMS.some(s => s.id === id)) {
        setMode('systems'); setActiveSystem(id); if (!mobile) setCollapsed(true);
        const st = parseInt(p.get('step') || '0', 10); if (!isNaN(st)) setSysStep(st);
      }
    } else if (p.get('lesson')) {
      openLesson(p.get('lesson'));
    } else {
      if (p.get('mode')) setMode(p.get('mode'));
      if (p.get('preset')) { const pr = PRESETS.find(x => x.id === p.get('preset')); if (pr) applyPreset(pr); }
      if (p.get('hemi')) setHemisphere(p.get('hemi'));
      if (p.get('sel')) { const id = parseInt(p.get('sel'), 10); if (!isNaN(id) && nodeById[id]) pendingDeep.current = { id, focus: p.get('focus') === '1' }; }
    }
  }, []);

  // apply the deep-linked structure once the specimen is loaded: if the link was shared
  // from focused mode, focus it (camera + select + active focus toggle); otherwise just
  // select it, exactly as a click would.
  React.useEffect(() => {
    if (!sceneReady || !pendingDeep.current) return;
    const { id, focus } = pendingDeep.current; pendingDeep.current = null;
    if (focus) focusNode(id); else selectNode(id);
  }, [sceneReady]);

  // ---- keyboard ----
  React.useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === '/') { e.preventDefault(); const i = document.querySelector('.glass input'); i && i.focus(); }
      else if (e.key === 'Escape') { if (isolatedIds) clearIsolate(); else setSelectedId(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isolatedIds]);

  const hoverNode = hover ? nodeById[hover.id] : null;

  return (
    <React.Fragment>
      <div className="stage" />
      <canvas ref={canvasRef} className="three" />

      {/* corner toolbar: save poster · credits · shuffle palette · subsystem key */}
      <Legend groups={groups} layerOn={layerOn} onPoster={savePoster} posterBusy={posterBusy} onCopyLink={copyShareLink} onRandomPalette={randomizePalette} onZoom={zoom} mobile={mobile} />

      {hint && consent && !mobile && (
        <div className="pop" style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 12,
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99,
          background: 'rgba(8,11,18,0.55)', color: 'var(--on-stage)', fontSize: 12.5, fontWeight: 500, backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)' }}>
          <Icon name="crosshair" size={14} style={{ color: 'var(--on-stage-soft)' }} />
          Drag to rotate · scroll to zoom · click a structure to inspect
        </div>
      )}

      <ControlPanel
        mode={mode} setMode={switchMode}
        activeSystem={activeSystem} onStartSystem={startSystem}
        completedSet={completed} onOpenLesson={openLesson}
        totalCount={nodes.length}
        groups={groups} layerOn={layerOn} expanded={expanded}
        onToggleLayer={toggleLayer} onExpand={onExpand}
        onSelect={selectNode} onFocus={focusNode} onFocusCat={focusCat}
        selectedId={selectedId}
        search={search} setSearch={(v) => { setSearch(v); setActivePreset(null); }} matchedIds={matchedIds} matchCount={matchedIds.size}
        searchSide={searchSide} setSearchSide={setSearchSide}
        hemisphere={hemisphere} setHemisphere={(v) => { setHemisphere(v); }}
        cortexOpacity={cortexOpacity} setCortexOpacity={(v) => { setCortexOpacity(v); setActivePreset(null); }}
        presets={PRESETS} activePreset={activePreset} onPreset={(id) => applyPreset(PRESETS.find(p => p.id === id))}
        onReset={reset} onShowAll={showAll} onHideAll={hideAll}
        onIsolateMatches={isolateMatches} canIsolate={matchedIds.size > 0}
        isolated={!!isolatedIds} onClearIsolate={clearIsolate}
        pos={pos} setPos={setPos} collapsed={collapsed} setCollapsed={setCollapsed}
        q={q} mobile={mobile}
      />

      {!consent && <ConsentBanner onAccept={acceptCookies} onDecline={declineCookies} />}

      <SelectionCard node={selNode} color={selNode ? PAL[selNode.category] : null}
        catLabel={selNode ? cats[selNode.category].label : ''} description={description} related={related}
        lessons={selNode ? window.SYS.lessonsForLabel(selNode.label) : []}
        onOpenLesson={(id) => { setSelectedId(null); openLesson(id); }}
        onSelect={selectNode} onRelated={focusNode} onFocus={toggleFocus} onIsolate={isolateNode} onClose={() => setSelectedId(null)}
        isolated={!!isolatedIds} focused={selNode && focusedId === selNode.id} onClearIsolate={clearIsolate} mobile={mobile} />

      {/* SYSTEMS narration (free stepping) */}
      {activeSystem && !lesson && (
        <NarrationCard sys={window.SYS.SYSTEMS.find(s => s.id === activeSystem)} idx={sysStep} setIdx={setSysStep}
          playing={sysPlaying} setPlaying={setSysPlaying} onClose={closeSystem} onSelectNode={selectNode} isLesson={false} mobile={mobile} />
      )}

      {/* LESSON player chrome */}
      {lesson && phase === 'intro' && <LessonIntro lesson={lesson} onBegin={beginLesson} onClose={closeLesson} mobile={mobile} />}
      {lesson && phase === 'playing' && (
        <NarrationCard sys={window.SYS.SYSTEMS.find(s => s.id === lessonSysId)} idx={lessonStep} setIdx={setLessonStep}
          playing={lessonPlaying} setPlaying={setLessonPlaying} onClose={closeLesson} onSelectNode={selectNode}
          isLesson={true} lessonTitle={lesson.title} onFinish={finishStages} mobile={mobile} />
      )}
      {lesson && phase === 'quiz' && (
        <LessonQuiz lesson={lesson} qIdx={qIdx} setQIdx={setQIdx} answers={answers} setAnswers={setAnswers}
          onFinish={completeLesson} pickFromStage={quizPickRef} mobile={mobile} />
      )}
      {lesson && phase === 'done' && (
        <LessonComplete lesson={lesson} score={lesson.quiz ? lesson.quiz.reduce((a, q, i) => a + (answers[i] === q.answer ? 1 : 0), 0) : 0}
          total={lesson.quiz ? lesson.quiz.length : 0} onReplay={replayLesson} onClose={closeLesson} onShare={copyShareLink} mobile={mobile} />
      )}

      <Toast msg={toast} />

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

/* bottom-center cookie-consent popup (gates Firebase/Google Analytics) */
function ConsentBanner({ onAccept, onDecline }) {
  return (
    <div className="glass glass-top-hi pop" style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
      width: 'min(560px, calc(100vw - 32px))', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <Icon name="info" size={16} style={{ color: 'var(--ink-faint)', flex: '0 0 auto' }} />
      <span style={{ flex: 1, minWidth: 220, fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
        We use Google&nbsp;Analytics to understand usage. Decline keeps it anonymous &amp; cookieless.
      </span>
      <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
        <button onClick={onDecline} style={{
          padding: '8px 14px', borderRadius: 10, border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)',
          color: 'var(--ink-soft)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}>Decline</button>
        <button onClick={onAccept} style={{
          padding: '8px 16px', borderRadius: 10, border: '1px solid transparent', background: 'var(--accent)',
          color: '#fff', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>Accept</button>
      </div>
    </div>
  );
}

/* small toast confirmation (e.g. "Link copied") */
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="pop" style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 99,
      background: 'rgba(8,11,18,0.72)', color: 'var(--on-stage)', fontSize: 12.5, fontWeight: 600, backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)' }}>
      <Icon name="checkCircle" size={14} style={{ color: '#5fd08a' }} /> {msg}
    </div>
  );
}

/* stage toolbar: subsystem key, share (link / poster), palette, about (mobile: zoom + about, top-right) */
function Legend({ groups, layerOn, onPoster, posterBusy, onCopyLink, onRandomPalette, onZoom, mobile }) {
  const [open, setOpen] = React.useState(false);     // subsystem key
  const [cred, setCred] = React.useState(false);     // credits
  const [share, setShare] = React.useState(false);   // share menu (link / poster)
  const visible = groups.filter(g => layerOn[g.cat]);
  const pill = {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 99, border: '1px solid var(--glass-edge)',
    color: 'var(--ink-soft)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  };
  const credLink = {
    display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--ink-soft)',
    fontSize: 12, fontWeight: 600, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)',
  };
  const shareItem = {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer',
    border: 'none', background: 'transparent', color: 'var(--ink-soft)', fontFamily: 'var(--font)',
    fontSize: 12.5, fontWeight: 600, padding: '9px 10px', borderRadius: 9,
  };
  const about = (
    <div className="glass pop scroll" style={{ padding: '14px 15px', width: 290, maxHeight: '70vh', overflowY: 'auto' }}>
      <div className="eyebrow" style={{ marginBottom: 9 }}>About</div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
        I'm a visual learner, and I always wished for a tool to <b style={{ color: 'var(--ink)' }}>see
        and explore</b> the brain myself - deeper than just its main components. So I built it.
        An open 3D brain you can spin, search and peel apart: all
        <b style={{ color: 'var(--ink)' }}> 344 structures</b> individually named and toggleable -         the granularity neuroscientists actually need, free for everyone.
      </p>
      <div className="eyebrow" style={{ marginBottom: 9 }}>Credits</div>
      <a href="https://github.com/itayinbarr" target="_blank" rel="noopener noreferrer" style={{ ...credLink, marginBottom: 11 }}><Icon name="github" size={14} /> Built by Itay Inbar</a>
      <p style={{ margin: '0 0 9px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
        3D anatomy from <b style={{ color: 'var(--ink)' }}>Z-Anatomy</b>, built on BodyParts3D / DBCLS - licensed <span className="mono" style={{ fontSize: 11 }}>CC&nbsp;BY-SA&nbsp;4.0</span>.
      </p>
      <a href="https://www.z-anatomy.com/" target="_blank" rel="noopener noreferrer" style={credLink}><Icon name="globe" size={14} /> z-anatomy.com</a>
    </div>
  );

  // mobile: pinned top-right - zoom −/+ then About, with the panel opening downward
  if (mobile) {
    const zoomBtn = { width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 99, border: '1px solid var(--glass-edge)', color: 'var(--ink-soft)', cursor: 'pointer' };
    return (
      <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 22, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onZoom(-1)} className="glass" style={zoomBtn} title="Zoom in"><Icon name="plus" size={16} /></button>
          <button onClick={() => onZoom(1)} className="glass" style={zoomBtn} title="Zoom out"><Icon name="minus" size={16} /></button>
          <button onClick={() => setCred(c => !c)} className="glass" style={pill}><Icon name="info" size={14} /> About</button>
        </div>
        {cred && about}
      </div>
    );
  }

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
      {cred && about}
      {share && !mobile && (
        <div className="glass pop" style={{ padding: 8, width: 232 }}>
          <button onClick={() => { onCopyLink(); setShare(false); }} style={shareItem} title="Copy a link that reopens this exact view">
            <Icon name="link" size={15} style={{ color: 'var(--ink-faint)' }} /> <span style={{ flex: 1 }}>Copy link to this view</span>
          </button>
          <button onClick={() => { onPoster(); setShare(false); }} disabled={posterBusy} style={{ ...shareItem, opacity: posterBusy ? 0.6 : 1 }} title="Download a high-definition poster (features the selected structure)">
            <Icon name={posterBusy ? 'reset' : 'download'} size={15} style={{ color: 'var(--ink-faint)' }} /> <span style={{ flex: 1 }}>{posterBusy ? 'Rendering\u2026' : 'Download poster'}</span>
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {!mobile && (
          <button onClick={() => { setShare(s => !s); setOpen(false); setCred(false); }} className="glass" style={pill} title="Share this view: copy a link or download a poster">
            <Icon name="share" size={14} /> Share
          </button>
        )}
        <button onClick={() => { setCred(c => !c); setOpen(false); setShare(false); }} className="glass" style={pill} title="About this project · credits & licence">
          <Icon name="info" size={14} /> About
        </button>
        {!mobile && (
          <button onClick={onRandomPalette} className="glass" style={pill} title="Shuffle the colour palette">
            <Icon name="palette" size={14} /> Palette
          </button>
        )}
        {!mobile && (
          <button onClick={() => { setOpen(o => !o); setCred(false); }} className="glass" style={pill}>
            <Icon name="info" size={14} /> Key
            <span style={{ display: 'flex', marginLeft: 2 }}>
              {visible.slice(0, 6).map((g, i) => <span key={g.cat} style={{ width: 9, height: 9, borderRadius: 99, background: g.color, marginLeft: i ? -3 : 0, boxShadow: '0 0 0 1.5px var(--glass)' }} />)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

/* Brain Project - app composition, state & scene wiring */

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

// Shuffle palettes - 12 subsystems incl. white-matter tracts. These are deliberately
// far apart from each other (cortex tone, saturation and overall mood all shift) so a
// single tap on "Palette" is an unmistakable change, not a subtle nudge. The page default
// lives in data.js (window.BRAIN.palette); a refresh always returns to it.
const PALETTES = [
  // Jewel - saturated, gem-bright on a warm-cream cortex
  { name: 'Jewel',    colors: { cortex:'#E7DEC9', white_matter:'#D7DDE8', deep_grey:'#B57BE0', diencephalon:'#7E8CF2', brainstem:'#E8B24A', cerebellum:'#F0894E', ventricles:'#3FC8D6', arteries:'#F05068', veins_sinuses:'#5078E8', cranial_nerves:'#D9D24A', meninges_dura:'#CC63CC', tracts:'#46C2B0' } },
  // Ice - cool monochrome blues/teals, cortex a pale frost, one warm rescue (arteries)
  { name: 'Ice',      colors: { cortex:'#D6E2EC', white_matter:'#C4D4E2', deep_grey:'#6E86C8', diencephalon:'#4F9AD6', brainstem:'#3FB0C4', cerebellum:'#56C8C0', ventricles:'#7FE0E4', arteries:'#F2756A', veins_sinuses:'#3E72C8', cranial_nerves:'#9ED0E0', meninges_dura:'#8C9ED8', tracts:'#34C0D8' } },
  // Ember - earthy, warm clay & amber; cool structures pulled toward terracotta
  { name: 'Ember',    colors: { cortex:'#E8CDA8', white_matter:'#D8C4B0', deep_grey:'#C2683E', diencephalon:'#B8884A', brainstem:'#E0982E', cerebellum:'#E8743A', ventricles:'#C9A86A', arteries:'#E03C3C', veins_sinuses:'#8C5A86', cranial_nerves:'#F0C44A', meninges_dura:'#A85C4A', tracts:'#C98A3E' } },
  // Neon - electric, fully saturated against a cool-slate cortex
  { name: 'Neon',     colors: { cortex:'#C7D2DE', white_matter:'#AEBCCE', deep_grey:'#B14DFF', diencephalon:'#3D8BFF', brainstem:'#FFD23D', cerebellum:'#FF7A2E', ventricles:'#1EE0E0', arteries:'#FF2D6B', veins_sinuses:'#3A5DFF', cranial_nerves:'#EAFF3D', meninges_dura:'#FF4DE0', tracts:'#2DFFB0' } },
  // Bloom - soft pastels, gentle and desaturated, lavender-tinted cortex
  { name: 'Bloom',    colors: { cortex:'#EADFE8', white_matter:'#DCD6E6', deep_grey:'#B79CDE', diencephalon:'#9CB4E6', brainstem:'#E6C68A', cerebellum:'#E8A88C', ventricles:'#9CD8D2', arteries:'#E892A2', veins_sinuses:'#9CAEE0', cranial_nerves:'#D8D08C', meninges_dura:'#D29ECE', tracts:'#92CFC4' } },
  // Forest - greens, teals and ambers; mossy cortex, earthy and organic
  { name: 'Forest',   colors: { cortex:'#D8DEC2', white_matter:'#C6D2BE', deep_grey:'#7A9E6E', diencephalon:'#4F9E86', brainstem:'#D2A23C', cerebellum:'#E0883C', ventricles:'#46C2A0', arteries:'#D8543C', veins_sinuses:'#3E7E8C', cranial_nerves:'#C6C23C', meninges_dura:'#8E9E5C', tracts:'#5CB87E' } },
  // Mono - near-greyscale with a single bold accent per cool/warm; stark and editorial
  { name: 'Mono',     colors: { cortex:'#DEDEDE', white_matter:'#C8C8C8', deep_grey:'#8E8E96', diencephalon:'#9A9AA2', brainstem:'#B0AEA6', cerebellum:'#A6A6AA', ventricles:'#7FC2C8', arteries:'#E64A5C', veins_sinuses:'#5A78C8', cranial_nerves:'#D8C84A', meninges_dura:'#9A8EA2', tracts:'#6ABFB8' } },
  // Spectrum - the full wheel, maximally varied hue per subsystem
  { name: 'Spectrum', colors: { cortex:'#E8DAC0', white_matter:'#D6DEE8', deep_grey:'#A35CE0', diencephalon:'#5C6CE8', brainstem:'#F0B23C', cerebellum:'#F07A3C', ventricles:'#2CC8C8', arteries:'#F0405C', veins_sinuses:'#3C6CE8', cranial_nerves:'#E0D43C', meninges_dura:'#D44CC4', tracts:'#2CC86A' } },
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
        : 'The most detailed interactive 3D brain';
      const url = s.capturePoster(2400, 1500, { title, subtitle: sub, color: selNode ? PAL[selNode.category] : t.accent });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brain-project-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
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
      <Legend groups={groups} layerOn={layerOn} onPoster={savePoster} posterBusy={posterBusy} onCopyLink={copyShareLink} onZoom={zoom} mobile={mobile}
        autorotate={t.autorotate} onToggleSpin={() => setTweak('autorotate', !t.autorotate)} />

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

/* stage toolbar: spin toggle, share (link / poster), palette, about (mobile: zoom + about, top-right) */
function Legend({ groups, layerOn, onPoster, posterBusy, onCopyLink, onZoom, mobile, autorotate, onToggleSpin }) {
  const [cred, setCred] = React.useState(false);     // credits
  const [share, setShare] = React.useState(false);   // share menu (link / poster)
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
        The <b style={{ color: 'var(--ink)' }}>most detailed interactive 3D brain</b> available to date, and
        it's <b style={{ color: 'var(--ink)' }}>constantly growing</b>. Free for everyone.
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
        The <a href="https://www.reddit.com/r/neuro/comments/1tyfydj/the_lack_of_a_proper_brain_map_drove_me_nuts_when/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>r/neuro community</a> gave
        it a warm welcome - that meant a lot.
      </p>
      <div className="eyebrow" style={{ marginBottom: 9 }}>Credits</div>
      <a href="https://github.com/itayinbarr" target="_blank" rel="noopener noreferrer" style={{ ...credLink, marginBottom: 10 }}><Icon name="github" size={14} /> Built by Itay Inbar</a>
      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: 'var(--ink-faint)' }}>
        initial 3D anatomy from z anatomy, built on BodyParts3D / DBCLS (CC&nbsp;BY-SA&nbsp;4.0). Deep nuclei,
        hypothalamus and white-matter tracts registered from open MRI atlases: CIT168 (Pauli&nbsp;et&nbsp;al.
        2018; Tyszka&nbsp;&amp;&nbsp;Pauli 2016), the Najdenovska&nbsp;et&nbsp;al. 2018 thalamic atlas,
        the Neudorfer&nbsp;et&nbsp;al. 2020 hypothalamic atlas, and HCP1065 tract templates. Approximate and
        educational - not for clinical use.
      </p>
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

  const spinPill = autorotate ? { ...pill, borderColor: 'var(--accent)', color: 'var(--accent)' } : pill;
  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
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
          <button onClick={() => { setShare(s => !s); setCred(false); }} className="glass" style={pill} title="Share this view: copy a link or download a poster">
            <Icon name="share" size={14} /> Share
          </button>
        )}
        <button onClick={() => { setCred(c => !c); setShare(false); }} className="glass" style={pill} title="About this project · credits & licence">
          <Icon name="info" size={14} /> About
        </button>
        {!mobile && (
          <button onClick={onToggleSpin} className="glass" style={spinPill}
            title={autorotate ? 'Stop the automatic spin' : 'Resume the automatic spin'}>
            <Icon name="rotate" size={14} /> {autorotate ? 'Spinning' : 'Spin'}
          </button>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

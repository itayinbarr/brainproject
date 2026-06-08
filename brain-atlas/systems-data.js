/* ============================================================
   Brain Atlas - Systems & Lessons content
   ------------------------------------------------------------
   Functional pathways and guided lessons that drive the REAL
   3D specimen. Each pathway "node" is a schematic landmark that
   resolves to one or more actual structures in window.BRAIN by
   label, so Systems/Learn highlight true meshes (bx_id) - same
   picking, focus and colour as Explore, not a static overlay.

   A handful of landmarks have no individual mesh in this atlas
   (e.g. the corticospinal tract, arcuate fasciculus, spinal cord
   and the eye/muscle end-organs). Those keep their teaching role
   in the narration but resolve to no mesh ("real: []"); the note
   still names them. Where a region is split into nuclei (striatum,
   amygdala, thalamus) a landmark resolves to the whole set.
   ============================================================ */
(function () {
  // schematic key -> { label (display), cat (real subsystem for colour),
  //   short? (compact on-card label), real: [ exact BRAIN.label strings ] }
  const NODES = {
    /* ---- cortex ---- */
    prefrontal:   { label: 'Prefrontal cortex', cat: 'cortex', real: ['Superior frontal gyrus', 'Middle frontal gyrus'] },
    mpfc:         { label: 'Medial prefrontal cortex', cat: 'cortex', short: 'Medial PFC', real: ['Straight gyrus (Gyrus rectus)', 'Superior frontal gyrus'] },
    broca:        { label: "Broca's area", cat: 'cortex', real: ['Opercular part of inferior frontal gyrus', 'Triangular part of inferior frontal gyrus'] },
    premotor:     { label: 'Premotor cortex / SMA', cat: 'cortex', short: 'Premotor / SMA', real: ['Precentral sulcus (Superior part)', 'Precentral sulcus (inferior part)'] },
    m1:           { label: 'Primary motor cortex (M1)', cat: 'cortex', short: 'Primary motor (M1)', real: ['Precentral gyrus'] },
    s1:           { label: 'Primary somatosensory (S1)', cat: 'cortex', short: 'Somatosensory (S1)', real: ['Postcentral gyrus'] },
    parietal:     { label: 'Posterior parietal cortex', cat: 'cortex', short: 'Posterior parietal', real: ['Superior parietal lobule', 'Intraparietal sulcus'] },
    wernicke:     { label: "Wernicke's area", cat: 'cortex', real: ['Temporal plane'] },
    a1:           { label: 'Primary auditory (Heschl)', cat: 'cortex', short: 'Auditory (A1)', real: ['Transverse temporal gyri'] },
    mt_dorsal:    { label: 'Dorsal stream (MT / parietal)', cat: 'cortex', short: 'Dorsal stream', real: ['Lateral occipital gyrus (Middle occipital gyrus)'] },
    v1:           { label: 'Primary visual cortex (V1)', cat: 'cortex', short: 'Visual cortex (V1)', real: ['Calcarine sulcus', 'Occipital pole'] },
    cuneus:       { label: 'Dorsal extrastriate (cuneus)', cat: 'cortex', short: 'Cuneus (V2/V3)', real: ['Cuneus'] },
    visual_assoc: { label: 'Ventral stream (V2-V4 / fusiform)', cat: 'cortex', short: 'Ventral stream', real: ['Lingual gyrus', 'Lateral occipitotemporal gyrus'] },
    temporal:     { label: 'Inferior temporal cortex', cat: 'cortex', short: 'Inferior temporal', real: ['Inferior temporal gyrus'] },
    cingulate:    { label: 'Cingulate gyrus', cat: 'cortex', real: ['Cingulate gyrus and sulcus (Middle anterior part)'] },
    hippocampus:  { label: 'Hippocampus', cat: 'cortex', real: ['Hippocampus'] },

    /* ---- white matter (some tracts have no individual mesh here) ---- */
    arcuate:      { label: 'Arcuate fasciculus', cat: 'white_matter', real: [] },
    fornix:       { label: 'Fornix', cat: 'white_matter', real: ['Fornix'] },
    cst:          { label: 'Corticospinal tract', cat: 'white_matter', real: [] },

    /* ---- deep grey / basal ganglia ---- */
    striatum:     { label: 'Striatum (caudate + putamen)', cat: 'deep_grey', short: 'Striatum', real: ['Caudate nucleus', 'Putamen'] },
    gp:           { label: 'Globus pallidus', cat: 'deep_grey', short: 'Globus pallidus', real: ['Globus pallidus external', 'Globus pallidus internal'] },
    accumbens:    { label: 'Nucleus accumbens', cat: 'deep_grey', short: 'N. accumbens', real: ['Nucleus accumbens'] },
    amygdala:     { label: 'Amygdala', cat: 'deep_grey', real: ['Lateral nucleus', 'Basolateral complex', 'Central nucleus', 'Corticomedial group'] },

    /* ---- diencephalon ---- */
    thalamus:     { label: 'Thalamus', cat: 'diencephalon', real: ['Ventral lateroventral nucleus', 'Ventral laterodorsal nucleus', 'Ventral anterior nucleus', 'Mediodorsal nucleus', 'Pulvinar', 'Anterior nuclei of thalamus'] },
    thal_va:      { label: 'Thalamus (VA / VL nuclei)', cat: 'diencephalon', short: 'Thalamus (VA/VL)', real: ['Ventral anterior nucleus', 'Ventral lateroventral nucleus', 'Ventral laterodorsal nucleus'] },
    thal_ant:     { label: 'Anterior thalamic nucleus', cat: 'diencephalon', short: 'Ant. thalamus', real: ['Anterior nuclei of thalamus'] },
    lgn:          { label: 'Lateral geniculate (LGN)', cat: 'diencephalon', real: ['Lateral geniculate body'] },
    mgn:          { label: 'Medial geniculate (MGN)', cat: 'diencephalon', real: ['Medial geniculate body'] },
    mammillary:   { label: 'Mammillary body', cat: 'diencephalon', real: ['Mamillary body'] },
    optic_chiasm: { label: 'Optic chiasm', cat: 'diencephalon', real: ['Optic chiasm'] },
    stn:          { label: 'Subthalamic nucleus', cat: 'deep_grey', short: 'Subthalamic n.', real: ['Subthalamic nucleus'] },

    /* ---- brainstem ---- */
    midbrain:     { label: 'Midbrain', cat: 'brainstem', real: ['Midbrain'] },
    snc:          { label: 'Substantia nigra (SNc)', cat: 'deep_grey', short: 'Substantia nigra', real: ['Substantia nigra'] },
    vta:          { label: 'Ventral tegmental area (at substantia nigra)', cat: 'brainstem', short: 'VTA (at SN)', real: ['Substantia nigra'] },
    pons:         { label: 'Pons', cat: 'brainstem', real: ['Pons'] },
    cochlear:     { label: 'Cochlear / vestibular nuclei', cat: 'brainstem', short: 'Cochlear nuclei', real: ['Vestibular nuclei'] },
    medulla:      { label: 'Medulla (pyramids)', cat: 'brainstem', short: 'Medulla', real: ['Medulla oblongata', 'Pyramid of medulla oblongata'] },
    decussation:  { label: 'Pyramidal decussation', cat: 'brainstem', short: 'Decussation', real: ['Pyramid of medulla oblongata'] },

    /* ---- cerebellum ---- */
    cerebellum:   { label: 'Cerebellum', cat: 'cerebellum', real: ['Culmen', 'Declive', 'Central lobule', 'Tuber of vermis', 'Anterior quadrangular lobule'] },

    /* ---- ventricles ---- */
    vent_lateral: { label: 'Lateral ventricle', cat: 'ventricles', real: ['Lateral ventricle'] },
    choroid:      { label: 'Choroid plexus', cat: 'ventricles', real: ['Choroid plexus'] },
    vent_third:   { label: 'Third ventricle', cat: 'ventricles', real: ['Third ventricle'] },
    vent_fourth:  { label: 'Fourth ventricle', cat: 'ventricles', real: ['Fourth ventricle'] },
    sss:          { label: 'Superior sagittal sinus', cat: 'veins_sinuses', short: 'Sup. sagittal sinus', real: ['Superior sagittal sinus'] },

    /* ---- external input / output (end-organs absent from a brain-only atlas) ---- */
    retina:       { label: 'Optic nerve (eye)', cat: 'cranial_nerves', short: 'Optic nerve', real: ['Optic nerve (II)'] },
    spinal:       { label: 'Spinal cord', cat: 'white_matter', real: [] },
    muscle:       { label: 'Skeletal muscle', cat: 'cranial_nerves', real: [] },
  };

  /* ============================================================
     FUNCTIONAL SYSTEMS  (Systems mode)
     Motor = flagship, fully authored. Others: correct pathway
     sequences + a concise exam-relevant note each.
     ============================================================ */
  const SYSTEMS = [
    {
      id: 'motor', label: 'Motor system', cat: 'cortex',
      blurb: 'How a movement is planned, gated, refined and sent to muscle.',
      flagship: true,
      stages: [
        { title: 'Forming the intention',
          body: "Voluntary movement begins before any muscle twitches. The prefrontal cortex decides to act; the premotor cortex and supplementary motor area (SMA) assemble the spatial plan and the sequence - which muscles, in what order, with what timing.",
          nodes: ['prefrontal', 'premotor'] },
        { title: 'The command - primary motor cortex',
          body: "The plan converges on the precentral gyrus (M1). Its giant Betz cells are arranged as the motor homunculus, a distorted body map where the hand and face claim huge territory. M1 is the origin of the corticospinal tract.",
          nodes: ['premotor', 'm1'] },
        { title: 'The basal ganglia loop - go / no-go',
          body: "Before the command leaves, a cortico-striato-pallido-thalamic loop scales it. The direct pathway ('go') releases movement; the indirect pathway ('no-go') suppresses unwanted movement. Dopamine from the substantia nigra biases the loop toward action - its loss is the lesion of Parkinson's disease.",
          nodes: ['m1', 'striatum', 'gp', 'snc', 'thal_va'] },
        { title: 'Fine-tuning - the cerebellar loop',
          body: "In parallel, a copy of the command reaches the cerebellum via the pons. The cerebellum compares intended against actual movement and sends correction back through the thalamus, smoothing timing and coordination. Damage causes ataxia, not paralysis.",
          nodes: ['m1', 'pons', 'cerebellum', 'thal_va'] },
        { title: 'The descending highway',
          body: "The refined command travels down the corticospinal tract, through the internal capsule, the midbrain, and the pyramids of the medulla. This is the great motor expressway from cortex to cord.",
          nodes: ['m1', 'cst', 'midbrain', 'pons', 'medulla'] },
        { title: 'Crossing over & the final common path',
          body: "At the pyramidal decussation in the lower medulla, about 85% of fibres cross, which is why the left brain moves the right body. They synapse on lower motor neurons in the spinal cord: the 'final common pathway' to muscle.",
          nodes: ['medulla', 'decussation', 'spinal', 'muscle'] },
      ],
    },
    {
      id: 'visual', label: 'Visual processing', cat: 'cortex',
      blurb: 'Retina to LGN to V1, then the dorsal "where" and ventral "what" streams.',
      stages: [
        { title: 'Eye to thalamus', body: 'Signals leave the retina along the optic nerve, partially cross at the optic chiasm, and relay in the lateral geniculate nucleus (LGN) of the thalamus.', nodes: ['retina', 'optic_chiasm', 'lgn'] },
        { title: 'Primary visual cortex (V1)', body: 'The LGN projects to V1, the first cortical visual area: the striate cortex lining the calcarine sulcus, with its central-vision representation at the occipital pole. Here orientation, edges and contrast are first extracted before anything splits into streams.', nodes: ['lgn', 'v1'] },
        { title: 'The dorsal "where" stream', body: 'From V1 the dorsal stream passes through dorsal extrastriate cortex (the cuneus) to area MT and the parietal cortex, coding motion, location and visually-guided action.', nodes: ['v1', 'cuneus', 'mt_dorsal', 'parietal'] },
        { title: 'The ventral "what" stream', body: 'The ventral stream runs to inferior temporal cortex, coding form, colour and object/face identity.', nodes: ['v1', 'visual_assoc', 'temporal'] },
      ],
    },
    {
      id: 'auditory', label: 'Auditory pathway', cat: 'cortex',
      blurb: 'Cochlea to brainstem nuclei to MGN to primary auditory cortex.',
      stages: [
        { title: 'Into the brainstem', body: 'Auditory nerve fibres synapse in the cochlear nuclei of the brainstem, the first central relay.', nodes: ['cochlear', 'pons'] },
        { title: 'Thalamic relay', body: 'The pathway ascends to the medial geniculate nucleus (MGN) of the thalamus.', nodes: ['cochlear', 'mgn'] },
        { title: 'Auditory cortex', body: "The MGN projects to Heschl's gyrus (A1) in the superior temporal lobe, tonotopically mapped by frequency.", nodes: ['mgn', 'a1'] },
      ],
    },
    {
      id: 'somatosensory', label: 'Somatosensory pathway', cat: 'cortex',
      blurb: 'Body to spinal cord to medulla to thalamus to primary somatosensory cortex.',
      stages: [
        { title: 'Ascending the cord', body: 'Touch and proprioception ascend the dorsal columns of the spinal cord to the medulla.', nodes: ['spinal', 'medulla'] },
        { title: 'Thalamic relay', body: 'After crossing, fibres relay in the thalamus (VPL/VPM nuclei).', nodes: ['medulla', 'thalamus'] },
        { title: 'Somatosensory cortex', body: 'The thalamus projects to S1 in the postcentral gyrus, the sensory homunculus.', nodes: ['thalamus', 's1', 'parietal'] },
      ],
    },
    {
      id: 'language', label: 'Language network', cat: 'cortex',
      blurb: 'Wernicke comprehends, the arcuate fasciculus links, Broca produces.',
      stages: [
        { title: 'Comprehension', body: "Heard speech is decoded for meaning in Wernicke's area (posterior superior temporal lobe).", nodes: ['a1', 'wernicke'] },
        { title: 'The connecting tract', body: 'The arcuate fasciculus carries the message forward; its lesion produces conduction aphasia.', nodes: ['wernicke', 'arcuate', 'broca'] },
        { title: 'Production', body: "Broca's area plans articulation and drives the motor cortex to speak.", nodes: ['broca', 'm1'] },
      ],
    },
    {
      id: 'limbic', label: 'Limbic / memory', cat: 'deep_grey',
      blurb: 'The Papez circuit of emotion & memory, plus the amygdala.',
      stages: [
        { title: 'Encoding: the hippocampal output', body: 'New declarative memories form in the hippocampus. Its output leaves along the fornix, arching forward to the mammillary bodies of the hypothalamus.', nodes: ['hippocampus', 'fornix', 'mammillary'] },
        { title: 'Closing the Papez loop', body: 'From the mammillary bodies the signal runs to the anterior thalamic nucleus, on to the cingulate gyrus, and back to the hippocampus, the loop Papez proposed binds emotion to memory.', nodes: ['mammillary', 'thal_ant', 'cingulate', 'hippocampus'] },
        { title: "The amygdala's emotional tag", body: 'In parallel, the amygdala tags experiences with emotional salience, especially fear, and modulates how strongly the hippocampus stores them.', nodes: ['amygdala', 'hippocampus'] },
      ],
    },
    {
      id: 'reward', label: 'Reward / dopamine', cat: 'deep_grey',
      blurb: 'The dopamine system: where dopamine is made, and the mesolimbic & mesocortical pathways.',
      stages: [
        { title: 'The source: midbrain dopamine', body: 'Reward signalling starts with dopamine neurons of the ventral tegmental area (VTA). The VTA sits in the midbrain immediately medial to the substantia nigra, so closely that this atlas shows them at the same location, but the VTA is the reward source, the substantia nigra the motor one.', nodes: ['vta'] },
        { title: 'The mesolimbic pathway', body: 'VTA neurons project to the nucleus accumbens (ventral striatum) and nearby limbic targets such as the amygdala, signalling reward, motivation and "wanting". This is the limbic, not cortical, arm, so it bypasses the cingulate.', nodes: ['vta', 'accumbens', 'amygdala'] },
        { title: 'The mesocortical pathway', body: 'A separate VTA projection reaches the prefrontal cortex and the anterior cingulate gyrus, shaping motivation, decision-making and drive. The cingulate is a target of this cortical arm.', nodes: ['vta', 'mpfc', 'cingulate'] },
      ],
    },
    {
      id: 'csf', label: 'CSF / ventricular flow', cat: 'ventricles',
      blurb: 'Where cerebrospinal fluid is made, how it circulates, and where it is reabsorbed.',
      stages: [
        { title: 'Production', body: 'The choroid plexus inside the lateral ventricles secretes most cerebrospinal fluid (CSF).', nodes: ['choroid', 'vent_lateral'] },
        { title: 'Lateral to third ventricle', body: 'CSF flows from each lateral ventricle through the interventricular foramen (of Monro) into the midline third ventricle.', nodes: ['vent_lateral', 'vent_third'] },
        { title: 'Third to fourth ventricle', body: 'From the third ventricle CSF passes down the cerebral aqueduct (of Sylvius) into the fourth ventricle, between the brainstem and cerebellum.', nodes: ['vent_third', 'vent_fourth'] },
        { title: 'Out and reabsorbed', body: 'CSF leaves the fourth ventricle into the subarachnoid space to cushion the whole CNS, then is reabsorbed through arachnoid granulations into the superior sagittal sinus and back to the blood.', nodes: ['vent_fourth', 'sss'] },
      ],
    },
  ];

  /* ============================================================
     LESSONS  (Learn mode - richer standalone stories)
     The flagship lesson ("The Motor Loop") is built end-to-end
     with a quiz; the rest play their system with an intro.
     ============================================================ */
  const LESSONS = [
    {
      id: 'l_motor', system: 'motor', kicker: 'Functional pathway', level: 'Core', minutes: 6,
      title: 'The Motor Loop', subtitle: 'From a thought to a movement, and why the left brain moves the right hand.',
      intro: "We'll follow a single voluntary movement across six stages: from the intention forming in the frontal lobe, through the basal-ganglia and cerebellar loops that shape it, down the corticospinal tract, to the muscle. Watch how each structure lights up in sequence on the real specimen.",
      flagship: true,
      quiz: [
        { type: 'mc', q: "Which structure's giant Betz cells give rise to the corticospinal tract?",
          options: ['Premotor cortex', 'Primary motor cortex (M1)', 'Cerebellum', 'Thalamus'], answer: 1,
          explain: 'M1 (the precentral gyrus) houses Betz cells, the origin of the corticospinal tract and the motor homunculus.' },
        { type: 'find', q: "Click the structure whose dopamine loss causes Parkinson's disease.",
          options: ['snc', 'cerebellum', 'thalamus', 'm1'], answer: 'snc',
          explain: "The substantia nigra (SNc) supplies dopamine to the basal-ganglia loop; its degeneration causes Parkinson's." },
        { type: 'mc', q: 'Where do most corticospinal fibres cross to the opposite side?',
          options: ['Internal capsule', 'Pons', 'Pyramidal decussation (medulla)', 'Spinal cord'], answer: 2,
          explain: 'At the pyramidal decussation in the lower medulla, about 85% of fibres cross, so the left cortex controls the right body.' },
      ],
    },
    { id: 'l_visual', system: 'visual', kicker: 'Functional pathway', level: 'Core', minutes: 5,
      title: 'Seeing: Retina to Recognition', subtitle: 'The visual relay and the split into "where" and "what".',
      intro: 'Follow light from the retina to the thalamus and V1, then watch vision split into the dorsal and ventral streams.' },
    { id: 'l_limbic', system: 'limbic', kicker: 'Functional circuit', level: 'Core', minutes: 5,
      title: 'How We Remember', subtitle: "The Papez circuit and the amygdala's emotional tag.",
      intro: 'Trace the loop that binds emotion to memory, and meet the amygdala.' },
    { id: 'l_reward', system: 'reward', kicker: 'Functional pathway', level: 'Intro', minutes: 4,
      title: 'Reward & Motivation', subtitle: 'The mesolimbic and mesocortical dopamine pathways.',
      intro: 'See where dopamine is made and where it goes to drive motivation.' },
    { id: 'l_csf', system: 'csf', kicker: 'Structural story', level: 'Intro', minutes: 4,
      title: 'The Ventricles & CSF', subtitle: 'Where cerebrospinal fluid is made and how it flows.',
      intro: 'Follow CSF from the choroid plexus through the ventricular system.' },
    { id: 'l_language', system: 'language', kicker: 'Functional network', level: 'Core', minutes: 5,
      title: 'The Language Network', subtitle: 'Wernicke, the arcuate fasciculus, and Broca.',
      intro: 'From hearing a word to speaking one, the classic language loop.' },
  ];

  /* short teaching descriptions for the pathway landmarks (used by the
     SelectionCard when a structure is reached through a system) */
  const NODE_DESC = {
    m1: 'The precentral gyrus. Its giant Betz cells form the motor homunculus and give rise to the corticospinal tract, the command centre for voluntary movement.',
    premotor: 'Premotor cortex and the supplementary motor area plan and sequence movement before it is executed by M1.',
    s1: 'The postcentral gyrus, the primary somatosensory cortex, mapping touch and proprioception as the sensory homunculus.',
    prefrontal: 'The seat of executive function: planning, working memory, and the decision to act.',
    broca: "Inferior frontal gyrus. Plans the motor sequence of speech; damage causes non-fluent (Broca's) aphasia.",
    wernicke: "The posterior superior temporal cortex (posterior BA 22), not the whole gyrus. It decodes the meaning of language; damage causes fluent (Wernicke's) aphasia. This atlas localises it to the planum temporale (the temporal plane), the posterior supratemporal language cortex just behind Heschl's gyrus, since the superior temporal gyrus is not subdivided here.",
    v1: 'The primary visual cortex at the occipital pole, organised retinotopically around the calcarine sulcus.',
    a1: "Heschl's gyrus, the primary auditory cortex, tonotopically mapped by sound frequency.",
    thalamus: "The brain's great relay station: almost all sensory and motor information synapses here on the way to cortex.",
    striatum: 'Caudate + putamen, the input stage of the basal ganglia, gating movement via the direct and indirect pathways.',
    snc: "Substantia nigra pars compacta. Supplies dopamine to the striatum; its degeneration causes Parkinson's disease.",
    vta: 'Ventral tegmental area: origin of the mesolimbic and mesocortical dopamine pathways of reward and motivation. It lies in the midbrain just medial to the substantia nigra; this atlas shows the two at the same location.',
    hippocampus: 'Essential for forming new declarative memories; the hub of the Papez circuit.',
    amygdala: 'Tags experience with emotional salience, especially fear, and modulates memory.',
    cerebellum: 'Coordinates timing and smoothness of movement by comparing intended with actual motion. Damage causes ataxia.',
    medulla: 'The lowest brainstem segment; its pyramids carry the corticospinal tract, most of which crosses here.',
    pons: 'Relays cortical motor copies to the cerebellum and houses several cranial-nerve nuclei.',
    lgn: 'Lateral geniculate nucleus, the thalamic relay for vision, between retina and V1.',
    mgn: 'Medial geniculate nucleus, the thalamic relay for hearing, between brainstem and A1.',
    accumbens: 'Nucleus accumbens, the ventral striatum, a key node of reward and motivation.',
    fornix: 'The major output tract of the hippocampus, arching to the mammillary bodies in the Papez circuit.',
  };

  /* ---- resolvers (filled lazily once window.BRAIN is present) ---- */
  let _labelToIds = null;
  function labelToIds() {
    if (_labelToIds) return _labelToIds;
    _labelToIds = {};
    (window.BRAIN && window.BRAIN.nodes || []).forEach(n => {
      (_labelToIds[n.label] = _labelToIds[n.label] || []).push(n.id);
    });
    return _labelToIds;
  }

  // schematic key -> array of real nodeIds (both sides). [] when no mesh exists.
  function idsForKey(key) {
    const node = NODES[key];
    if (!node) return [];
    const map = labelToIds();
    const out = [];
    (node.real || []).forEach(lbl => (map[lbl] || []).forEach(id => out.push(id)));
    return out;
  }

  // pick one representative nodeId for a key (for selection / cross-links)
  function repId(key) {
    const ids = idsForKey(key);
    return ids.length ? ids[0] : null;
  }

  // which schematic keys reference a given real label
  function keysForLabel(label) {
    return Object.keys(NODES).filter(k => (NODES[k].real || []).includes(label));
  }

  // which lessons feature a given real structure label (any stage of its system)
  function lessonsForLabel(label) {
    const keys = new Set(keysForLabel(label));
    if (!keys.size) return [];
    const sysIds = new Set();
    SYSTEMS.forEach(s => { if (s.stages.some(st => st.nodes.some(n => keys.has(n)))) sysIds.add(s.id); });
    return LESSONS.filter(l => sysIds.has(l.system));
  }

  window.SYS = { NODES, SYSTEMS, LESSONS, NODE_DESC, idsForKey, repId, keysForLabel, lessonsForLabel };
})();

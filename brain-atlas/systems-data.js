/* ============================================================
   Brain Project - Systems & Lessons content
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

    /* ---- white matter & registered tracts ---- */
    arcuate:      { label: 'Arcuate fasciculus', cat: 'tracts', real: ['Arcuate fasciculus'] },
    fornix:       { label: 'Fornix', cat: 'white_matter', real: ['Fornix'] },
    cst:          { label: 'Corticospinal tract', cat: 'tracts', real: ['Corticospinal tract'] },
    drtt:         { label: 'Dentatorubrothalamic tract', cat: 'tracts', short: 'Dentatorubrothalamic', real: ['Dentatorubrothalamic tract'] },

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
     Every lesson now carries a BANK of quiz questions. The player
     draws a short randomised round from the bank and invites the
     learner to keep going for fresh questions (see lessons.jsx /
     app.jsx). Mix of 'mc' (multiple-choice) and 'find' (click the
     glowing structure on the real specimen) - 'find' options are
     schematic keys from NODES above.
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
        { type: 'mc', q: 'Within the basal-ganglia loop, what does the direct ("go") pathway do?',
          options: ['Suppresses unwanted movement', 'Releases/facilitates movement', 'Relays touch to the cortex', 'Makes cerebrospinal fluid'], answer: 1,
          explain: "The direct pathway facilitates movement; the indirect ('no-go') pathway suppresses it. Dopamine biases the loop toward 'go'." },
        { type: 'find', q: 'Click the cortical area that plans and sequences a movement just before M1 executes it.',
          options: ['premotor', 'm1', 'cerebellum', 'medulla'], answer: 'premotor',
          explain: 'The premotor cortex and supplementary motor area assemble the spatial plan and sequence before the command converges on M1.' },
        { type: 'find', q: 'Click the structure that compares intended with actual movement and smooths coordination.',
          options: ['cerebellum', 'striatum', 'pons', 'thal_va'], answer: 'cerebellum',
          explain: 'The cerebellum corrects timing and coordination; its damage causes ataxia, not paralysis.' },
        { type: 'mc', q: 'A lesion of the cerebellum typically produces which deficit?',
          options: ['Flaccid paralysis', 'Resting tremor and rigidity', 'Ataxia (incoordination)', 'Complete sensory loss'], answer: 2,
          explain: 'Cerebellar damage causes ataxia - clumsy, poorly-timed movement - rather than weakness or paralysis.' },
        { type: 'find', q: 'Click the deep-grey input stage of the basal ganglia (caudate + putamen).',
          options: ['striatum', 'gp', 'thal_va', 'snc'], answer: 'striatum',
          explain: 'The striatum (caudate + putamen) is the input stage of the basal ganglia, gating movement via the direct and indirect pathways.' },
        { type: 'mc', q: 'The cerebellum receives its copy of the motor command relayed through which brainstem structure?',
          options: ['Medulla', 'Pons', 'Midbrain', 'Thalamus'], answer: 1,
          explain: 'Cortical motor copies cross into the cerebellum via the pons (the pontine nuclei and middle cerebellar peduncle).' },
      ],
    },
    { id: 'l_visual', system: 'visual', kicker: 'Functional pathway', level: 'Core', minutes: 5,
      title: 'Seeing: Retina to Recognition', subtitle: 'The visual relay and the split into "where" and "what".',
      intro: 'Follow light from the retina to the thalamus and V1, then watch vision split into the dorsal and ventral streams.',
      quiz: [
        { type: 'mc', q: 'Which thalamic nucleus relays vision from the retina to the cortex?',
          options: ['Medial geniculate (MGN)', 'Lateral geniculate (LGN)', 'Pulvinar', 'Anterior nucleus'], answer: 1,
          explain: 'The lateral geniculate nucleus (LGN) is the thalamic relay for vision, between the retina and V1.' },
        { type: 'find', q: 'Click the primary visual cortex (V1).',
          options: ['v1', 'lgn', 'temporal', 'cuneus'], answer: 'v1',
          explain: 'V1, the striate cortex around the calcarine sulcus, is the first cortical visual area.' },
        { type: 'mc', q: 'The dorsal "where" stream chiefly codes for...',
          options: ['Object and face identity', 'Motion, location and visually-guided action', 'Sound frequency', 'Emotional salience'], answer: 1,
          explain: 'The dorsal stream (toward parietal cortex) codes motion, spatial location and visually-guided action.' },
        { type: 'mc', q: 'The ventral "what" stream runs toward which lobe to identify objects and faces?',
          options: ['Frontal lobe', 'Parietal lobe', 'Inferior temporal lobe', 'Occipital pole only'], answer: 2,
          explain: 'The ventral stream projects to inferior temporal cortex, coding form, colour and object/face identity.' },
        { type: 'find', q: 'Click where the two optic nerves partially cross before the thalamus.',
          options: ['optic_chiasm', 'lgn', 'v1', 'retina'], answer: 'optic_chiasm',
          explain: 'Nasal retinal fibres cross at the optic chiasm, so each hemisphere sees the opposite visual field.' },
        { type: 'find', q: 'Click the start of the dorsal "where" stream as it leaves V1 (the cuneus / dorsal extrastriate cortex).',
          options: ['cuneus', 'temporal', 'visual_assoc', 'lgn'], answer: 'cuneus',
          explain: 'From V1 the dorsal stream passes through the dorsal extrastriate cortex (cuneus) toward MT and parietal cortex.' },
        { type: 'mc', q: 'V1 is organised around which landmark sulcus, with central vision at the occipital pole?',
          options: ['Central sulcus', 'Calcarine sulcus', 'Lateral sulcus', 'Cingulate sulcus'], answer: 1,
          explain: 'V1 lines the calcarine sulcus and is retinotopically mapped, with the macula represented at the occipital pole.' },
      ] },
    { id: 'l_limbic', system: 'limbic', kicker: 'Functional circuit', level: 'Core', minutes: 5,
      title: 'How We Remember', subtitle: "The Papez circuit and the amygdala's emotional tag.",
      intro: 'Trace the loop that binds emotion to memory, and meet the amygdala.',
      quiz: [
        { type: 'find', q: 'Click the structure essential for forming new declarative memories.',
          options: ['hippocampus', 'amygdala', 'cingulate', 'thal_ant'], answer: 'hippocampus',
          explain: 'The hippocampus is the hub of the Papez circuit and is essential for forming new declarative memories.' },
        { type: 'mc', q: 'Which tract carries the hippocampal output forward to the mammillary bodies?',
          options: ['Arcuate fasciculus', 'Fornix', 'Corticospinal tract', 'Optic tract'], answer: 1,
          explain: 'The fornix is the major output tract of the hippocampus, arching to the mammillary bodies.' },
        { type: 'mc', q: 'Order the classic Papez loop after the hippocampus:',
          options: ['Fornix to mammillary bodies to anterior thalamus to cingulate', 'Cingulate to fornix to thalamus to amygdala', 'Mammillary bodies to amygdala to V1', 'Thalamus to medulla to cerebellum'], answer: 0,
          explain: 'Papez: hippocampus to fornix to mammillary bodies to anterior thalamic nucleus to cingulate gyrus and back to the hippocampus.' },
        { type: 'find', q: 'Click the structure that tags experiences with emotional salience, especially fear.',
          options: ['amygdala', 'hippocampus', 'mammillary', 'fornix'], answer: 'amygdala',
          explain: 'The amygdala adds emotional salience and modulates how strongly the hippocampus stores a memory.' },
        { type: 'find', q: 'Click the thalamic relay of the Papez circuit (the anterior thalamic nucleus).',
          options: ['thal_ant', 'mammillary', 'cingulate', 'hippocampus'], answer: 'thal_ant',
          explain: 'The mammillary bodies project to the anterior thalamic nucleus, which relays on to the cingulate gyrus.' },
        { type: 'mc', q: 'Bilateral hippocampal damage classically produces which deficit?',
          options: ['Loss of old memories only', 'Inability to form new declarative memories', 'Paralysis', 'Loss of vision'], answer: 1,
          explain: 'Hippocampal damage causes anterograde amnesia: new declarative memories can no longer be formed.' },
      ] },
    { id: 'l_reward', system: 'reward', kicker: 'Functional pathway', level: 'Intro', minutes: 4,
      title: 'Reward & Motivation', subtitle: 'The mesolimbic and mesocortical dopamine pathways.',
      intro: 'See where dopamine is made and where it goes to drive motivation.',
      quiz: [
        { type: 'mc', q: 'Where do the dopamine neurons of the reward system originate?',
          options: ['Substantia nigra pars compacta', 'Ventral tegmental area (VTA)', 'Nucleus accumbens', 'Raphe nuclei'], answer: 1,
          explain: 'Reward signalling starts in the VTA of the midbrain, just medial to the substantia nigra.' },
        { type: 'find', q: 'Click the ventral striatum target of the mesolimbic pathway (nucleus accumbens).',
          options: ['accumbens', 'vta', 'cingulate', 'amygdala'], answer: 'accumbens',
          explain: 'The mesolimbic pathway runs from the VTA to the nucleus accumbens, signalling reward and "wanting".' },
        { type: 'mc', q: 'The mesocortical pathway projects from the VTA chiefly to which target?',
          options: ['Cerebellum', 'Prefrontal cortex and anterior cingulate', 'Medulla', 'Lateral geniculate'], answer: 1,
          explain: 'The mesocortical arm reaches the prefrontal cortex and anterior cingulate, shaping motivation and decision-making.' },
        { type: 'find', q: 'Click the prefrontal target of the mesocortical pathway (medial prefrontal cortex).',
          options: ['mpfc', 'accumbens', 'amygdala', 'vta'], answer: 'mpfc',
          explain: 'The medial prefrontal cortex is a cortical target of the VTA, shaping drive and decision-making.' },
        { type: 'mc', q: 'How does this atlas display the VTA relative to the substantia nigra?',
          options: ['As a separate occipital structure', 'At the same midbrain location, just medial to it', 'Inside the thalamus', 'In the cerebellum'], answer: 1,
          explain: 'The VTA sits in the midbrain immediately medial to the substantia nigra - so close that the atlas shows them at one location.' },
      ] },
    { id: 'l_csf', system: 'csf', kicker: 'Structural story', level: 'Intro', minutes: 4,
      title: 'The Ventricles & CSF', subtitle: 'Where cerebrospinal fluid is made and how it flows.',
      intro: 'Follow CSF from the choroid plexus through the ventricular system.',
      quiz: [
        { type: 'find', q: 'Click the tissue that secretes most cerebrospinal fluid.',
          options: ['choroid', 'vent_third', 'vent_fourth', 'sss'], answer: 'choroid',
          explain: 'The choroid plexus inside the ventricles secretes most CSF.' },
        { type: 'mc', q: 'CSF flows from the lateral ventricles into the third ventricle through which opening?',
          options: ['Cerebral aqueduct (of Sylvius)', 'Interventricular foramen (of Monro)', 'Foramen of Magendie', 'Arachnoid granulations'], answer: 1,
          explain: 'The interventricular foramen of Monro connects each lateral ventricle to the midline third ventricle.' },
        { type: 'mc', q: 'The cerebral aqueduct (of Sylvius) connects which two ventricles?',
          options: ['Lateral and third', 'Third and fourth', 'Fourth and central canal', 'Left and right lateral'], answer: 1,
          explain: 'The cerebral aqueduct runs through the midbrain, linking the third and fourth ventricles.' },
        { type: 'find', q: 'Click the fourth ventricle, sitting between the brainstem and cerebellum.',
          options: ['vent_fourth', 'vent_lateral', 'choroid', 'vent_third'], answer: 'vent_fourth',
          explain: 'The fourth ventricle lies between the pons/medulla and the cerebellum; CSF leaves it for the subarachnoid space.' },
        { type: 'mc', q: 'Where is CSF finally reabsorbed back into the venous blood?',
          options: ['Choroid plexus', 'Arachnoid granulations into the superior sagittal sinus', 'Lateral ventricles', 'Pituitary gland'], answer: 1,
          explain: 'Arachnoid granulations return CSF to the superior sagittal sinus and the venous circulation.' },
      ] },
    { id: 'l_language', system: 'language', kicker: 'Functional network', level: 'Core', minutes: 5,
      title: 'The Language Network', subtitle: 'Wernicke, the arcuate fasciculus, and Broca.',
      intro: 'From hearing a word to speaking one, the classic language loop.',
      quiz: [
        { type: 'find', q: 'Click the area that decodes the meaning of heard speech.',
          options: ['wernicke', 'broca', 'a1', 'm1'], answer: 'wernicke',
          explain: "Wernicke's area (posterior superior temporal cortex) decodes the meaning of language." },
        { type: 'find', q: 'Click the area that plans the motor sequence of speech.',
          options: ['broca', 'wernicke', 'arcuate', 'a1'], answer: 'broca',
          explain: "Broca's area in the inferior frontal gyrus plans articulation and drives the motor cortex to speak." },
        { type: 'mc', q: "Which tract connects Wernicke's and Broca's areas?",
          options: ['Fornix', 'Arcuate fasciculus', 'Corticospinal tract', 'Optic radiation'], answer: 1,
          explain: 'The arcuate fasciculus links the two language hubs; its lesion produces conduction aphasia.' },
        { type: 'mc', q: "Damage to Broca's area classically causes which aphasia?",
          options: ['Fluent (receptive) aphasia', 'Non-fluent (expressive) aphasia', 'Conduction aphasia', 'No language deficit'], answer: 1,
          explain: "Broca's (expressive) aphasia is non-fluent: comprehension is relatively spared but speech production is effortful." },
        { type: 'mc', q: 'A lesion of the arcuate fasciculus produces which syndrome?',
          options: ["Wernicke's aphasia", "Broca's aphasia", 'Conduction aphasia', 'Global aphasia'], answer: 2,
          explain: 'Disconnecting Wernicke from Broca yields conduction aphasia - fluent speech and good comprehension but poor repetition.' },
        { type: 'find', q: 'Click the primary auditory cortex that first receives the spoken word.',
          options: ['a1', 'wernicke', 'broca', 'm1'], answer: 'a1',
          explain: "Heschl's gyrus (A1) is the primary auditory cortex; from there the signal passes to Wernicke's area." },
      ] },
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

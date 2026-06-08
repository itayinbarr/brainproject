"""Regenerate brain-atlas/data.js from models/manifest.json.

data.js is what the viewer actually reads (window.BRAIN.nodes, .descriptions,
.categories, .palette, .depth), keyed by the same bx_id the GLB carries. It must
be regenerated whenever the model is re-exported.

Node breadcrumbs (`crumb`) are an ordered path through Z-Anatomy's collection
nesting, which the alphabetised manifest `ta2` no longer preserves; rather than
rebuild that hierarchy we reuse each existing node's crumb (matched by the unique
label+side key) and author crumbs for the structures added by the nuclei pipeline.

Run:  python scripts/gen_data.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
MANI = os.path.join(ROOT, "brain-atlas", "models", "manifest.json")
DATA = os.path.join(ROOT, "brain-atlas", "data.js")

manifest = json.load(open(MANI))

# Carry over palette/depth and existing crumbs + curated descriptions from the
# current data.js (it is the only record of the hand-tuned palette and prose).
old_txt = open(DATA).read()
old = json.loads(old_txt[old_txt.index("{"):old_txt.rindex("}")+1])
old_crumb = {(n["label"], n["side"]): n.get("crumb", []) for n in old["nodes"]}
descriptions = dict(old["descriptions"])

# Crumbs for the structures introduced by the nuclei pipeline.
CRUMB_GP = ["Brain", "Cerebrum", "Telencephalon", "Corpus striatum", "Globus pallidus"]
CRUMB_THAL = ["Brain", "Cerebrum", "Diencephalon", "Thalamus"]
CRUMB_AMY = ["Brain", "Cerebrum", "Telencephalon", "Amygdala"]
CRUMB_HYP = ["Brain", "Cerebrum", "Diencephalon", "Hypothalamus"]
CRUMB_BY_LABEL = {
    "Subthalamic nucleus": ["Brain", "Cerebrum", "Diencephalon", "Subthalamus"],
    "Substantia nigra":    ["Brain", "Brainstem", "Midbrain"],
    "Nucleus accumbens":   ["Brain", "Cerebrum", "Telencephalon", "Ventral striatum"],
    # endocrine glands + structures rescued from the non-neural filter
    "Pineal gland":              ["Brain", "Cerebrum", "Diencephalon", "Epithalamus"],
    "Straight gyrus (Gyrus rectus)": ["Brain", "Cerebrum", "Telencephalon", "Frontal lobe"],
    "Uvula of vermis":           ["Brain", "Cerebellum", "Vermis"],
    "Anterior cochlear nucleus": ["Brain", "Brainstem", "Medulla oblongata"],
}
CRUMB_PITUITARY = ["Brain", "Cerebrum", "Diencephalon", "Hypophysis"]

# Plain-language descriptions for the new sub-structures.
descriptions.update({
    "Globus pallidus external":
        "Outer pallidal segment (GPe), a relay in the basal ganglia's indirect "
        "pathway that tunes the scale and timing of movement.",
    "Globus pallidus internal":
        "Inner pallidal segment (GPi), the basal ganglia's main inhibitory output "
        "to the thalamus and a key deep-brain-stimulation target in Parkinson's "
        "disease and dystonia.",
    "Subthalamic nucleus":
        "Small lens-shaped nucleus that drives basal ganglia output; the principal "
        "deep-brain-stimulation target in Parkinson's disease.",
    "Substantia nigra":
        "Midbrain pigmented nucleus; its dopamine neurons (pars compacta) degenerate "
        "in Parkinson's disease, while pars reticulata is a basal ganglia output.",
    "Nucleus accumbens":
        "Ventral striatum hub of the reward circuit, central to motivation, pleasure "
        "and addiction.",
    "Pulvinar":
        "Largest thalamic nucleus; a higher-order hub for visual attention and "
        "cross-cortical communication.",
    "Anterior nuclei of thalamus":
        "Limbic relay in the Papez circuit (mammillary bodies to cingulate cortex); "
        "important for memory.",
    "Mediodorsal nucleus":
        "Major relay to the prefrontal cortex, supporting executive function, working "
        "memory and emotion.",
    "Ventral anterior nucleus":
        "Motor relay carrying basal ganglia output forward to premotor and motor cortex.",
    "Ventral laterodorsal nucleus":
        "Part of the motor thalamus relaying cerebellar and basal ganglia signals to "
        "the motor cortex.",
    "Ventral lateroventral nucleus":
        "Part of the motor thalamus relaying cerebellar and basal ganglia signals to "
        "the motor cortex.",
    "Intralaminar and lateral posterior nuclei":
        "Intralaminar and posterior thalamic group involved in arousal, attention and "
        "sensorimotor integration.",
    # Amygdala functional groups (CIT168)
    "Lateral nucleus":
        "Main sensory input gateway of the amygdala, where emotional associations "
        "(notably fear conditioning) are first formed.",
    "Basolateral complex":
        "Largest amygdala division (basolateral and basomedial nuclei); links sensory "
        "input to emotional value and feeds the cortex, hippocampus and striatum.",
    "Central nucleus":
        "Main output of the amygdala, driving autonomic and behavioural fear and "
        "stress responses via the brainstem and hypothalamus.",
    "Corticomedial group":
        "Cortical, medial and transition nuclei; processes olfactory and pheromonal "
        "cues and links the amygdala to social and reproductive behaviour.",
    # Hypothalamus functional zones (Neudorfer)
    "Preoptic hypothalamus":
        "Preoptic region governing thermoregulation, sleep onset and reproductive "
        "and parental behaviour.",
    "Anterior hypothalamus":
        "Anterior zone (incl. paraventricular, supraoptic, suprachiasmatic nuclei); "
        "sets circadian rhythm and drives the neuroendocrine stress and fluid axes.",
    "Tuberal hypothalamus":
        "Middle zone (arcuate, ventromedial, dorsomedial nuclei) controlling appetite, "
        "satiety and pituitary hormone release.",
    "Lateral hypothalamus":
        "Lateral zone driving arousal, feeding and motivation via orexin neurons.",
    "Posterior hypothalamus":
        "Posterior zone coordinating sympathetic arousal and heat conservation.",
    # Endocrine glands + rescued structures
    "Adenohypophysis":
        "Anterior pituitary; secretes growth hormone, prolactin, ACTH, TSH and the "
        "gonadotropins under hypothalamic control.",
    "Neurohypophysis":
        "Posterior pituitary; releases hypothalamic oxytocin and vasopressin (ADH) "
        "into the blood.",
    "Pineal gland":
        "Midline epithalamic gland that secretes melatonin and sets the circadian "
        "sleep-wake rhythm.",
    "Straight gyrus (Gyrus rectus)":
        "Gyrus rectus, on the medial orbital surface of the frontal lobe, part of the "
        "orbitofrontal cortex.",
    "Uvula of vermis":
        "Lobule IX of the cerebellar vermis, part of the spinocerebellum.",
    "Anterior cochlear nucleus":
        "First brainstem relay of the auditory nerve, in the rostral medulla.",
})


def crumb_for(n):
    parent = n.get("parent")
    if parent == "Thalamus":
        return CRUMB_THAL
    if parent == "Globus pallidus":
        return CRUMB_GP
    if parent == "Amygdaloid body":
        return CRUMB_AMY
    if parent == "Hypothalamus":
        return CRUMB_HYP
    if parent == "Pituitary gland":
        return CRUMB_PITUITARY
    if n["label"] in CRUMB_BY_LABEL:
        return CRUMB_BY_LABEL[n["label"]]
    return old_crumb.get((n["label"], n["side"]), [])


nodes = []
for n in manifest["nodes"]:
    node = {"id": n["id"], "label": n["label"], "category": n["category"],
            "side": n["side"], "region": n["region"], "crumb": crumb_for(n),
            "source": n.get("source", "Z-Anatomy / BodyParts3D")}
    if n.get("parent"):
        node["parent"] = n["parent"]
    nodes.append(node)

brain = {
    "generatedFrom": "Z-Anatomy / BodyParts3D (CC BY-SA 4.0); deep nuclei "
                     "registered from CIT168 (CC BY 4.0) and Najdenovska 2018 (CC BY-SA 4.0)",
    "categories": {c: {"label": v["label"], "count": v["count"]}
                   for c, v in manifest["categories"].items()},
    "palette": old["palette"],
    "depth": old["depth"],
    "descriptions": descriptions,
    "nodes": nodes,
}

header = ("/* Auto-generated from manifest.json by scripts/gen_data.py - Brain Atlas "
          "dataset (CC BY-SA 4.0, Z-Anatomy/BodyParts3D; deep nuclei from CIT168 & "
          "Najdenovska, see README). */\n")
with open(DATA, "w") as f:
    f.write(header)
    f.write("window.BRAIN = " + json.dumps(brain, ensure_ascii=False) + ";\n")

print(f"[gen_data] wrote {DATA} with {len(nodes)} nodes, "
      f"{len(descriptions)} descriptions")
print("  category counts:",
      {c: v["count"] for c, v in sorted(brain["categories"].items())})

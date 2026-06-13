# The lack of a proper brain map drove me nuts, so I built the most detailed one I could

*How I went from "a dozen labelled blobs" to an interactive 3D brain with ~344 named structures — and the one hard problem that the whole thing turned out to be.*

---

## The itch

I'm a visual learner. When I study, I need to *see* the thing — turn it over, take it apart, put a name on every piece. So when I sat down to learn neuroanatomy properly, I went looking for a map.

I never found one good enough.

The resources out there name the broad regions — frontal lobe, thalamus, cerebellum — and then stop. A dozen labelled blobs. But the parts I actually needed to learn were the ones nobody bothered to draw: the individual gyri and sulci, the deep nuclei, the white-matter tracts, the way a structure sits *relative* to its neighbours. The angular gyrus. The supramarginal gyrus. The calcarine sulcus. The things you get quizzed on and operate near.

The existing tools fell into two camps. Either they were beautiful but shallow — gorgeous renders of "the brain" that bottomed out at major regions — or they were deep but locked inside research software that a student is never going to install. There was no free, open, *granular* thing you could just open in a browser and peel apart.

So I built one. For me first, and then — once it started working — for whoever comes after me. Free and open source.

**Try it:** [itayinbarr.github.io/brainproject](https://itayinbarr.github.io/brainproject/)

---

## What it actually is

It's an interactive 3D brain that runs entirely in your browser. No install, no login, no paywall. You spin it, search it, click a structure to focus it, fade the cortex down to see what's underneath, show one hemisphere or both.

And it goes *down*. From the cortical surface all the way to individual structures, across every system:

- **Cortex** — every gyrus and sulcus, individually named (yes, the supramarginal and angular gyri, the cuneus, the fusiform, the calcarine sulcus).
- **Deep gray & basal ganglia** — caudate, putamen, globus pallidus split into GPe/GPi, subthalamic nucleus, substantia nigra, nucleus accumbens.
- **Diencephalon** — thalamus broken into seven nuclei groups, hypothalamus into five zones, plus the amygdala in four functional groups.
- **White-matter tracts** — arcuate, cingulum, uncinate, corticospinal, optic radiations and ~50 others, drawn as pathways.
- **Brainstem & cerebellum**, the **ventricles**, the **circle of Willis** with named arterial segments, the **dural venous sinuses**, **cranial nerves I–XII**, and the **meninges**.

Around 344 individually named structures in total. Click any one and it tells you what it is — and suggests related structures, so exploring one piece pulls you toward the next.

---

## The motivation, said plainly

I didn't build this because the world needed another pretty brain render. I built it because there's a specific kind of person — the visual learner staring at a textbook cross-section trying to *rotate it in their head* — who is badly served by every tool that exists. I was that person. The goal was never "look how detailed," it was "let someone learn the supramarginal gyrus by grabbing it."

That single requirement — real, named, sub-regional granularity — is what made this hard, because it's exactly the granularity that doesn't come for free.

---

## The one hard problem

Here's the thing nobody tells you when you start: there is no single source that has all of this.

The base model I started from (Z-Anatomy, built on BodyParts3D) is a gorgeous, hand-segmented *gross-anatomy* model. It's a real surface mesh of the whole organ. But it's coarse where it counts: one thalamus blob per side, one globus pallidus, and no subthalamic nucleus, no substantia nigra, no nucleus accumbens *at all*. Those finer structures simply aren't in it.

The finer structures *do* exist — but only inside neuroimaging atlases. And those atlases live in **MNI space**: a standardized millimetre coordinate system that brain scans get normalized into. My model isn't in MNI space. It's in Blender world units, life-size, with the axes flipped relative to the convention scans use.

So the entire project collapsed to a single question:

> **Can I find a reliable transform between MNI space and my model's mesh space?**

If yes, then every open atlas in the world becomes a donor. I can take the subthalamic nucleus out of a published atlas, push it through the transform, and drop it into my model in exactly the right place. If no, I'm hand-sculpting nuclei from anatomy textbooks and lying about where they are.

(I wrote the full technical version of this up in the repo — [`docs/registration.md`](https://github.com/itayinbarr/brainproject/blob/main/docs/registration.md) — if you want the real math. Here's the human version.)

### The transform

I fit a single affine transform — rotation, scale, shear, translation, twelve parameters — that maps MNI millimetres to mesh world coordinates. To anchor it, I used the structures that exist in *both* the model and the atlases: caudate, putamen, globus pallidus, thalamus (left and right), plus the hypothalamus and mammillary body to pin down the vertical axis. About eleven paired landmark points. Solve least-squares, and you get the transform — and its inverse — which I cache to a file and never refit. That cached transform is the reusable heart of the whole thing.

Then there are two ways to add a structure:

1. **Partition something I already have.** For the globus pallidus → GPe/GPi, and the thalamus → its seven nuclei, I take each vertex of the existing mesh, map it *back* into MNI space, read which atlas label it lands in, and split the mesh along those boundaries. The original surface is preserved exactly — I'm just dividing it. So it still looks like the rest of the model, and it's still legitimately a derivative of the original.

2. **Grow it from the atlas.** For the structures with no parent mesh — subthalamic nucleus, substantia nigra, accumbens — I threshold the atlas's probability volume, run marching cubes to get a surface, and transform that surface into mesh space.

White-matter tracts got a third treatment. Tracts aren't solid blobs, they're pathways, so I render them as tubes swept along a centerline: skeletonize the atlas's bundle envelope, take the longest path through it, smooth it, map it through the same transform, and clip it so it hugs the cortex instead of poking out the side.

### How accurate is it, honestly?

This is the part I refuse to fudge. I validated the transform with a held-out control: the red nucleus exists in *both* the model and the atlas, and I deliberately left it out of the fit. The gap between where the transform *predicts* it and where it *actually* is comes out to about **7 mm**. That's the honest, out-of-sample number.

So the **relative arrangement is correct** — GPi medial to GPe, STN below and inside the globus pallidus, substantia nigra below the STN, all verified. But **absolute placement is ~7 mm**, roughly the size of the smaller nuclei themselves. This is an educational tool, not a surgical one, and it says so on every registered structure.

A nonlinear warp would do better. The affine is a deliberate trade-off: good enough to teach the arrangement, simple enough to be trustworthy and reproducible.

---

## The principle I built around: don't fake geometry

The most important design decision in the whole project is a *restriction*: the model never fakes geometry it doesn't have. Finer subnuclei get added **only** when there's a suitable open atlas that registers cleanly. If I can't place something honestly, I don't place it.

That cost me structures people asked for. And I think it's the single thing that makes the tool worth trusting. A few examples of what I left *out*, on purpose:

- **Cerebellar deep nuclei** (dentate, interposed, fastigial): the standard atlas (SUIT) is licensed NonCommercial, which is incompatible with keeping this project fully open. So they're out until a compatibly-licensed atlas exists.
- **Hippocampal subfields** (CA1–4, subiculum, dentate gyrus): the available atlases are either license-restricted or the subfields are sub-millimetre laminae that a 7 mm registration would simply misrepresent. Drawing them would be drawing a lie.

I'd rather ship an honest 344 structures than an impressive-sounding 500 where a third of them are in the wrong place.

---

## How it runs (the boring-but-nice tech)

I wanted this to open instantly for anyone, forever, with no server to maintain.

- **Three.js** does the 3D rendering and click-picking.
- **React** runs the interface.
- **Blender** is where the assets get assembled and exported.
- The model ships as a single **Draco-compressed glTF** file, so it's small enough to load fast.
- There's **no build step** — the JSX transpiles in the browser. You can host the whole thing by serving one folder of static files.

The viewer code is **Apache 2.0**. The anatomy assets are **CC BY-SA 4.0**, crediting Z-Anatomy and BodyParts3D/DBCLS, with every imaging-registered structure crediting its source atlas (CIT168, Najdenovska, Neudorfer, HCP1065). Open in, open out — that's the deal, and it's also why the licensing of every donor atlas mattered so much.

---

## What people said when I posted it

I put it on r/neuro expecting a few "nice" comments. It picked up a few hundred upvotes and sixty-odd comments, and the conversation turned out to be the most useful part of the whole launch.

The recurring challenge was: *haven't I seen this before?* People pointed me at [brainfacts.org's 3D brain](https://www.brainfacts.org/3d-brain) ("been around 10+ years"), at [neurotorium.org](https://neurotorium.org), at the Allen Institute. Fair — there are good 3D brains out there. My answer each time came back to the same thing that started this whole project:

> "This one is cool, yet it doesn't get down to sufficient granularity — the specific sulci and gyri, like the supramarginal. It's nice, but it wouldn't help me in neuroanatomy."

That *is* the niche. Not "a 3D brain" — those exist. A 3D brain you can take apart down to the named sub-region. One commenter who'd recommended Neurotorium came back with "true, yours has a lot more structures, I might just start using yours actually," which is exactly the bar I was aiming for.

The best thread was a critique. **msttu02** liked it but pointed out the deep nuclei were thin — "add the accumbens, nucleus ambiguus, PAG." I replied that those would take time because there's no existing 3D model, "yet they can be derived creatively enough." Then I went and did it, and came back a few days later: *added the deep nuclei of the thalamus, amygdala, and basal ganglia.* That whole exchange is the registration pipeline above, in miniature — and it's why I built the transform to be reusable in the first place.

There was also a fair hit on a real decision: I **simplify the interface on mobile** — search and the fuller controls live on desktop, while mobile gets presets. My reasoning was that exploring a 3D brain on a phone is already a stretch, and cramming every control in would make it a mess. The pushback — "that's how most people access a website nowadays" — is legitimate, and it's on my list.

> *[Itay — drop in any specific replies or screenshots here you want to feature, and I'll format them as pull-quotes.]*

---

## What's next

- **More deep structures**, as fast as cleanly-registerable open atlases let me — the principle holds, no faking.
- **A better mobile experience**, because the criticism was right.
- Eventually, **projecting imaging data onto the model** — the same transform runs in reverse, so an fMRI statistical map in MNI space can be painted onto the surface. The plumbing for that already exists.

---

## Try it / take it apart

It's free, it's open source, and it'll stay that way.

- **Use it:** [itayinbarr.github.io/brainproject](https://itayinbarr.github.io/brainproject/)
- **Read the code / the registration writeup:** [github.com/itayinbarr/brainproject](https://github.com/itayinbarr/brainproject)

If you're a visual learner who's ever stared at a brain cross-section wishing you could just *grab it* — this is the thing I wish I'd had. I hope it helps.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------- palette / config
const CAT_COLOR = {
  cortex:0xe8c4b0, white_matter:0xf2ead9, deep_grey:0xb486cf, diencephalon:0x86a6e6,
  brainstem:0xceac5b, cerebellum:0xe89466, ventricles:0x53d9d9, meninges_dura:0xa07fe0,
  arteries:0xe23b3b, veins_sinuses:0x3f78e6, cranial_nerves:0xf0d94f, other:0xc2cad6,
};
const CAT_ORDER = ['cortex','white_matter','deep_grey','diencephalon','brainstem',
  'cerebellum','ventricles','arteries','veins_sinuses','cranial_nerves','meninges_dura','other'];
const TRANSLUCENT = new Set(['ventricles','meninges_dura']);
// clean first view: nerves + dura are big/cluttering, start hidden (toggleable)
const HIDDEN_BY_DEFAULT = new Set(['cranial_nerves','meninges_dura']);

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setClearAlpha(0);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.85; controls.panSpeed = 0.8;
controls.mouseButtons = { LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN };

// soft key light on top of the environment for crisp shading
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(0.6,1,0.8); scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc0ff, 0.5); rim.position.set(-0.8,0.2,-0.7); scene.add(rim);

// ---------------------------------------------------------------- state
const root = new THREE.Group(); scene.add(root);
const records = new Map();          // bx_id -> { id,cat,label,side,region,meshes:[],visible }
const byCategory = new Map();
let manifest = null, selected = null, hovered = null;
const HL = new THREE.Color(0x6fe9ff);

// ---------------------------------------------------------------- load
const draco = new DRACOLoader().setDecoderPath('./vendor/addons/libs/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

Promise.all([
  fetch('./models/manifest.json').then(r=>r.json()),
  loader.loadAsync('./models/brain.glb'),
]).then(([man, gltf]) => {
  manifest = man;
  document.getElementById('count').textContent = man.nodes.length;

  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const ex = extrasOf(o);
    const id = ex.bx_id ?? -Math.random();
    const cat = ex.bx_cat || 'other';
    const mat = new THREE.MeshStandardMaterial({
      color:new THREE.Color(CAT_COLOR[cat] ?? CAT_COLOR.other),
      roughness:0.55, metalness:0.0, emissive:0x000000,
      side: TRANSLUCENT.has(cat) ? THREE.DoubleSide : THREE.FrontSide,
      flatShading:false,
    });
    if (TRANSLUCENT.has(cat)) { mat.transparent=true; mat.opacity=0.35; mat.depthWrite=false; }
    o.material = mat;
    o.userData.cat = cat;
    o.userData.baseOpacity = mat.opacity;
    o.castShadow = o.receiveShadow = false;

    let rec = records.get(id);
    if (!rec) {
      rec = { id, cat, label:ex.bx_label||o.name, side:ex.bx_side||'median',
              region:ex.bx_region||cat, meshes:[], visible:true };
      records.set(id, rec);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(rec);
    }
    rec.meshes.push(o);
    o.userData.recId = id;
  });

  root.add(gltf.scene);

  // default visibility
  for (const rec of records.values()) setVisible(rec, !HIDDEN_BY_DEFAULT.has(rec.cat), false);

  centerOnCore();
  frameCore(false);
  buildPanel();
  document.getElementById('loading').classList.add('done');
}).catch(err => {
  document.getElementById('loading').textContent = 'Failed to load: '+err.message;
  console.error(err);
});

function extrasOf(o){
  // three.js puts glTF node.extras on userData; for multi-primitive nodes it lands on the parent
  if (o.userData && o.userData.bx_cat) return o.userData;
  if (o.parent && o.parent.userData && o.parent.userData.bx_cat) return o.parent.userData;
  return o.userData || {};
}

// ---------------------------------------------------------------- centering & framing
let coreBox = new THREE.Box3();
function centerOnCore(){
  // recenter the whole model so the core brain sits at the origin (nice orbit pivot)
  const core = new THREE.Box3();
  let any=false;
  for (const rec of records.values())
    if (['cortex','cerebellum','brainstem','diencephalon','deep_grey','white_matter'].includes(rec.cat))
      for (const m of rec.meshes){ core.expandByObject(m); any=true; }
  if (!any) core.setFromObject(root);
  const c = core.getCenter(new THREE.Vector3());
  root.position.sub(c);
  coreBox = core.clone().translate(c.clone().negate());
}
function boxOf(recs){
  const b = new THREE.Box3();
  for (const rec of recs) for (const m of rec.meshes) if (m.visible) b.expandByObject(m);
  return b;
}
function frameBox(box, animate=true){
  if (box.isEmpty()) return;
  const s = box.getBoundingSphere(new THREE.Sphere());
  const dist = s.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov*0.5)) * 1.25;
  const dir = new THREE.Vector3(0.35,0.18,1).normalize();
  const newPos = s.center.clone().add(dir.multiplyScalar(dist));
  camera.near = Math.max(s.radius/200, 0.0005); camera.far = s.radius*200; camera.updateProjectionMatrix();
  tweenCamera(newPos, s.center, animate?0.6:0);
}
const frameCore = (a)=>frameBox(coreBox.clone(), a);

// camera tween
let tween = null;
function tweenCamera(pos, target, dur){
  if (dur<=0){ camera.position.copy(pos); controls.target.copy(target); controls.update(); tween=null; return; }
  tween = { from:camera.position.clone(), to:pos.clone(),
            tfrom:controls.target.clone(), tto:target.clone(), t:0, dur };
}

// ---------------------------------------------------------------- visibility helpers
function setVisible(rec, v, sync=true){
  rec.visible = v;
  for (const m of rec.meshes) m.visible = v;
  if (sync && rec.cb) rec.cb.checked = v;
}

// ---------------------------------------------------------------- panel
function buildPanel(){
  const groups = document.getElementById('groups');
  groups.innerHTML='';
  for (const cat of CAT_ORDER.filter(c=>byCategory.has(c))){
    const recs = byCategory.get(cat).sort((a,b)=>a.label.localeCompare(b.label));
    const g = document.createElement('div'); g.className='group collapsed'; g.dataset.cat=cat;

    const head = document.createElement('div'); head.className='ghead';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = recs.some(r=>r.visible);
    const sw = document.createElement('span'); sw.className='swatch'; sw.style.background='#'+new THREE.Color(CAT_COLOR[cat]).getHexString();
    const title = document.createElement('span'); title.className='gtitle'; title.textContent = manifest.categories[cat]?.label ?? cat;
    const cnt = document.createElement('span'); cnt.className='gcount'; cnt.textContent = recs.length;
    const caret = document.createElement('span'); caret.className='caret'; caret.textContent='▾';
    head.append(cb, sw, title, cnt, caret);
    g.appendChild(head);

    const list = document.createElement('div'); list.className='glist';
    for (const rec of recs){
      const it = document.createElement('label'); it.className='item'; rec.item = it;
      const icb = document.createElement('input'); icb.type='checkbox'; icb.checked = rec.visible; rec.cb = icb;
      const lbl = document.createElement('span'); lbl.className='lbl'; lbl.textContent = rec.label;
      const side = document.createElement('span'); side.className='side '+rec.side;
      side.textContent = rec.side==='left'?'L':rec.side==='right'?'R':'';
      it.append(icb, lbl, side);
      it.dataset.search = (rec.label+' '+rec.region+' '+rec.cat).toLowerCase();
      icb.addEventListener('change', e=>{ e.stopPropagation(); setVisible(rec, icb.checked, false); syncGroup(g); });
      lbl.addEventListener('click', e=>{ e.preventDefault(); select(rec, true); });
      list.appendChild(it);
    }
    g.appendChild(list);

    cb.addEventListener('change', ()=> recs.forEach(r=>setVisible(r, cb.checked)));
    head.addEventListener('click', e=>{ if(e.target!==cb) g.classList.toggle('collapsed'); });
    groups.appendChild(g);
  }
}
function syncGroup(g){
  const recs = byCategory.get(g.dataset.cat);
  g.querySelector('.ghead input').checked = recs.some(r=>r.visible);
}

// ---------------------------------------------------------------- selection / hover
function clearSel(){
  if (!selected) return;
  for (const m of selected.meshes){ m.material.emissive.setHex(0x000000); m.material.emissiveIntensity=1; }
  selected.item?.classList.remove('sel'); selected = null;
}
function select(rec, focus){
  clearSel(); selected = rec;
  setVisible(rec, true);
  for (const m of rec.meshes){ m.material.emissive.copy(HL); m.material.emissiveIntensity=0.6; }
  rec.item.classList.add('sel');
  const g = rec.item.closest('.group'); g.classList.remove('collapsed'); syncGroup(g);
  rec.item.scrollIntoView({block:'nearest'});
  document.getElementById('selName').textContent = rec.label + (rec.side!=='median' ? '  ('+rec.side+')' : '');
  const node = manifest.nodes.find(n=>n.id===rec.id);
  document.getElementById('selPath').textContent = node ? (node.ta2||[]).slice().reverse().join('  ›  ') : rec.region;
  if (focus){ const b=new THREE.Box3(); rec.meshes.forEach(m=>b.expandByObject(m)); frameBox(b); }
}
function setHover(rec){
  if (hovered===rec) return;
  if (hovered && hovered!==selected) for (const m of hovered.meshes){ m.material.emissive.setHex(0x000000); }
  hovered = rec;
  if (hovered && hovered!==selected) for (const m of hovered.meshes){ m.material.emissive.copy(HL).multiplyScalar(0.35); m.material.emissiveIntensity=0.3; }
  canvas.style.cursor = rec ? 'pointer' : 'default';
}

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pick(ev){
  const r = canvas.getBoundingClientRect();
  ptr.x = ((ev.clientX-r.left)/r.width)*2-1;
  ptr.y = -((ev.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(root.children, true);
  for (const h of hits){ if (h.object.visible && h.object.userData.recId!=null) return records.get(h.object.userData.recId); }
  return null;
}
let downXY=null;
canvas.addEventListener('pointerdown', e=>downXY=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup', e=>{
  if (!downXY || Math.hypot(e.clientX-downXY[0],e.clientY-downXY[1])>5) return;
  const rec = pick(e); if (rec) select(rec, false);
});
let moveRAF=0;
canvas.addEventListener('pointermove', e=>{
  if (moveRAF) return; moveRAF=requestAnimationFrame(()=>{ moveRAF=0; setHover(pick(e)); });
});

// ---------------------------------------------------------------- Cmd/Ctrl = pan (drift)
function setPan(on){ controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; }
addEventListener('keydown', e=>{ if (e.key==='Meta'||e.key==='Control') setPan(true); });
addEventListener('keyup',   e=>{ if (e.key==='Meta'||e.key==='Control') setPan(false); });
addEventListener('blur', ()=>setPan(false));

// ---------------------------------------------------------------- search
const search = document.getElementById('search');
function applySearch(){
  const q = search.value.trim().toLowerCase();
  for (const g of document.querySelectorAll('.group')){
    let any=false;
    for (const it of g.querySelectorAll('.item')){
      const hit = !q || it.dataset.search.includes(q);
      it.classList.toggle('hidden-by-search', !hit); any = any||hit;
    }
    g.classList.toggle('hidden-by-search', !any);
    if (q && any) g.classList.remove('collapsed');
  }
  for (const rec of records.values()){
    const hit = !q || rec.item.dataset.search.includes(q);
    for (const m of rec.meshes){
      const op = !q ? rec.cat && (TRANSLUCENT.has(rec.cat)?0.35:1) : (hit?1:0.05);
      m.material.opacity = op; m.material.transparent = op<1; m.material.depthWrite = op>=0.95;
    }
  }
}
search.addEventListener('input', applySearch);
document.getElementById('clear').addEventListener('click', ()=>{ search.value=''; applySearch(); });

// ---------------------------------------------------------------- toolbar
document.getElementById('isolate').addEventListener('click', ()=>{
  const q = search.value.trim().toLowerCase();
  const keep = new Set();
  for (const rec of records.values()){
    const match = q ? rec.item.dataset.search.includes(q) : (selected && rec===selected);
    setVisible(rec, !!match); if (match) keep.add(rec);
  }
  document.querySelectorAll('.group').forEach(syncGroup);
  if (keep.size) frameBox(boxOf([...keep]));
});
document.getElementById('reset').addEventListener('click', ()=>{
  search.value=''; applySearch();
  for (const rec of records.values()) setVisible(rec, !HIDDEN_BY_DEFAULT.has(rec.cat));
  document.querySelectorAll('.group').forEach(syncGroup);
  clearSel();
  document.getElementById('selName').textContent='Click a structure or search';
  document.getElementById('selPath').textContent='';
  frameCore();
});
document.getElementById('focus').addEventListener('click', ()=>{
  if (selected){ const b=new THREE.Box3(); selected.meshes.forEach(m=>b.expandByObject(m)); frameBox(b); }
  else frameCore();
});
document.getElementById('cortexOpacity').addEventListener('input', e=>{
  const v = e.target.value/100;
  for (const rec of byCategory.get('cortex')||[]) for (const m of rec.meshes){
    m.material.opacity=v; m.material.transparent=v<1; m.material.depthWrite=v>=0.98;
  }
});
for (const b of document.querySelectorAll('.sides button')){
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.sides button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const side=b.dataset.side;
    for (const rec of records.values()){
      if (rec.side==='left'||rec.side==='right'){
        const show = (side==='both'||rec.side===side) && rec.cb.checked;
        for (const m of rec.meshes) m.visible = show;
      }
    }
  });
}

// ---------------------------------------------------------------- render loop
let last=performance.now();
function onResize(){
  const w=canvas.clientWidth, h=canvas.clientHeight;
  if (canvas.width!==Math.round(w*devicePixelRatio)||canvas.height!==Math.round(h*devicePixelRatio)){
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  }
}
renderer.setAnimationLoop((now)=>{
  const dt=(now-last)/1000; last=now;
  onResize();
  if (tween){
    tween.t = Math.min(1, tween.t + dt/tween.dur);
    const k = tween.t<.5 ? 2*tween.t*tween.t : 1-Math.pow(-2*tween.t+2,2)/2; // easeInOutQuad
    camera.position.lerpVectors(tween.from, tween.to, k);
    controls.target.lerpVectors(tween.tfrom, tween.tto, k);
    if (tween.t>=1) tween=null;
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', onResize);

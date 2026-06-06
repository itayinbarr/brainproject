import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2] || 'brain-atlas/models/brain.glb');
const root = doc.getRoot();

function worldMatrix(node){
  // accumulate parent chain
  const chain=[]; let n=node;
  while(n){ chain.unshift(n); n = n.getParentNode ? n.getParentNode() : null; }
  // gltf-transform: node.getParentNode() exists; fall back to identity
  let m=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  for(const c of chain){ m = mul(m, c.getMatrix()); }
  return m;
}
function mul(a,b){const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let cc=0;cc<4;cc++){let s=0;for(let k=0;k<4;k++)s+=a[r*4+k]*b[k*4+cc];o[r*4+cc]=s;}return o;}
function xf(m,v){return [
 m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
 m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
 m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];}

const rows=[];
let withExtras=0;
for(const node of root.listNodes()){
  const mesh=node.getMesh(); if(!mesh) continue;
  const ex=node.getExtras()||{};
  if(ex.bx_cat) withExtras++;
  const m=node.getMatrix();
  let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
  for(const prim of mesh.listPrimitives()){
    const pos=prim.getAttribute('POSITION'); if(!pos) continue;
    const lo=pos.getMin([]), hi=pos.getMax([]);
    for(const cx of [lo[0],hi[0]]) for(const cy of [lo[1],hi[1]]) for(const cz of [lo[2],hi[2]]){
      const w=xf(m,[cx,cy,cz]);
      for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],w[i]);mx[i]=Math.max(mx[i],w[i]);}
    }
  }
  const c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  rows.push({name:node.getName(), cat:ex.bx_cat, label:ex.bx_label, c, mn, mx});
}
console.log('nodes with bx_ extras:', withExtras, '/', rows.length);
// In y-up gltf the brain is ~+1.5 in Y. Find vertical outliers.
const ys=rows.map(r=>r.c[1]).sort((a,b)=>a-b);
const med=ys[Math.floor(ys.length/2)];
console.log('median Y center:', med.toFixed(3));
rows.sort((a,b)=>a.c[1]-b.c[1]);
console.log('--- LOWEST 8 (Y) ---');
for(const r of rows.slice(0,8)) console.log('  y=',r.c[1].toFixed(3),'span=',(r.mx[1]-r.mn[1]).toFixed(3), r.cat, '|', r.name);
console.log('--- biggest bbox diagonal 8 ---');
rows.sort((a,b)=>{const da=Math.hypot(...a.mx.map((v,i)=>v-a.mn[i]));const db=Math.hypot(...b.mx.map((v,i)=>v-b.mn[i]));return db-da;});
for(const r of rows.slice(0,8)){const d=Math.hypot(...r.mx.map((v,i)=>v-r.mn[i]));console.log('  diag=',d.toFixed(3), r.cat,'|',r.name);}
const cc=rows.find(r=>/corpus callosum/i.test(r.name));
if(cc) console.log('CORPUS CALLOSUM center=', cc.c.map(x=>x.toFixed(3)), 'span=',cc.mn.map((v,i)=>(cc.mx[i]-v).toFixed(3)));

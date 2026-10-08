import {createRequire} from 'node:module';
import path from 'node:path';
const {MeshoptSimplifier}=createRequire(path.resolve('downloads/tree-review/tools/package.json'))('meshoptimizer');

/** Fit a textured quad to each disconnected source leaf; sample across the full canopy. */
export function leafCards(doc,primitive,maxCards=8000){
 const positions=primitive.getAttribute('POSITION').getArray(),uvs=primitive.getAttribute('TEXCOORD_0').getArray(),indices=primitive.getIndices().getArray();
 const parents=MeshoptSimplifier.generatePositionRemap(positions,3);
 const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x]}return x};
 for(let i=0;i<indices.length;i+=3){const root=find(indices[i]);parents[find(indices[i+1])]=root;parents[find(indices[i+2])]=root;}
 const components=new Map();
 for(let i=0;i<positions.length/3;i++){const root=find(i);let list=components.get(root);if(!list){list=[];components.set(root,list)}list.push(i)}
 const hash=x=>{x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return (x^(x>>>16))>>>0};
 const sampled=[...components.entries()].sort((a,b)=>hash(a[0])-hash(b[0])).slice(0,maxCards);
 const scale=Math.min(2.2,Math.sqrt(components.size/sampled.length));
 const outP=[],outN=[],outUV=[],outI=[];
 for(const [,vertices] of sampled){
  const mean=[0,0,0,0,0];let u0=Infinity,v0=Infinity,u1=-Infinity,v1=-Infinity;
  for(const i of vertices){for(let c=0;c<3;c++)mean[c]+=positions[i*3+c];const u=uvs[i*2],v=uvs[i*2+1];mean[3]+=u;mean[4]+=v;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v)}
  for(let c=0;c<5;c++)mean[c]/=vertices.length;
  let uu=0,vv=0,uv=0;const pu=[0,0,0],pv=[0,0,0];
  for(const i of vertices){const u=uvs[i*2]-mean[3],v=uvs[i*2+1]-mean[4];uu+=u*u;vv+=v*v;uv+=u*v;for(let c=0;c<3;c++){pu[c]+=(positions[i*3+c]-mean[c])*u;pv[c]+=(positions[i*3+c]-mean[c])*v}}
  const det=uu*vv-uv*uv;if(Math.abs(det)<1e-12)continue;
  const a=pu.map((p,c)=>(p*vv-pv[c]*uv)/det),b=pv.map((p,c)=>(p*uu-pu[c]*uv)/det);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const len=Math.hypot(...n);if(len<1e-10)continue;
  const offset=outP.length/3;
  for(const [u,v] of [[u0,v0],[u1,v0],[u1,v1],[u0,v1]]){
   for(let c=0;c<3;c++){outP.push(mean[c]+scale*(a[c]*(u-mean[3])+b[c]*(v-mean[4])));outN.push(n[c]/len)}outUV.push(u,v);
  }
  outI.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
 }
 const buffer=doc.getRoot().listBuffers()[0];
 for(const semantic of primitive.listSemantics())primitive.setAttribute(semantic,null);
 for(const [semantic,type,values] of [['POSITION','VEC3',outP],['NORMAL','VEC3',outN],['TEXCOORD_0','VEC2',outUV]])primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer));
 primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(outI)).setBuffer(buffer));
}

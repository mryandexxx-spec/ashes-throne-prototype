// MAP-3D-01F: isolated comparison, not runtime. Node geometry/query only.
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { init, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh as recastBake } from 'recast-navigation/generators';
import { findPath, DEFAULT_QUERY_FILTER } from 'navcat';
import { generateSoloNavMesh as navcatBake } from 'navcat/blocks';

const positions=[],indices=[];
const xs=[-8,-2,2,8,12,18,20,24],zs=[-6,-3,-2,2,3,6];
function tile(x,z){
  if(x>=-8&&x<8&&z>=-6&&z<6) return !(x>=-2&&x<2&&z>=-2&&z<2);
  return ((x>=8&&x<18)||(x>=20&&x<24))&&z>=-3&&z<3;
}
function y(x){return x<=8?0:x<12?(x-8)/2:2;}
for(let a=0;a<xs.length-1;a++)for(let b=0;b<zs.length-1;b++){
  const [x0,x1]=xs.slice(a,a+2),[z0,z1]=zs.slice(b,b+2);
  if(!tile(x0,z0))continue;
  const i=positions.length/3;
  positions.push(x0,y(x0),z0,x0,y(x0),z1,x1,y(x1),z1,x1,y(x1),z0);
  indices.push(i,i+1,i+2,i,i+2,i+3);
}
const cases=[
  {id:'around-hole',from:[-6,0,0],to:[6,0,0],want:true},
  {id:'north',from:[-6,0,4],to:[6,0,4],want:true},
  {id:'south',from:[-6,0,-4],to:[6,0,-4],want:true},
  {id:'upper',from:[6,0,0],to:[15,2,0],want:true},
  {id:'return',from:[15,2,0],to:[-6,0,0],want:true},
  {id:'arbitrary',from:[-5,0,1.1],to:[5.3,0,-3.7],want:true},
  {id:'hole',from:[-6,0,0],to:[0,0,0],want:false},
  {id:'off-floor',from:[-6,0,0],to:[-11,0,0],want:false},
  {id:'island',from:[6,0,0],to:[22,2,0],want:false}
];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// Independent continuous XY-plan oracle; sample path at 0.05m. It checks floor
// footprint and 0.20m horizontal safety margin, not exact navmesh triangulation.
function floor(x,z){
  const main=x>=-8&&x<=8&&z>=-6&&z<=6&&!(Math.abs(x)<2&&Math.abs(z)<2);
  return main || (x>=8&&x<=18&&Math.abs(z)<=3) || (x>=20&&x<=24&&Math.abs(z)<=3);
}
function clear(x,z){
  return [[0,0],[.2,0],[-.2,0],[0,.2],[0,-.2]].every(([dx,dz])=>floor(x+dx,z+dz));
}
function inspect(c,p){
  if(!Array.isArray(p)||p.length<2||p.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))return {accepted:false,reason:'no finite complete path'};
  const startError=distance(p[0],c.from),endError=distance(p.at(-1),c.to);
  let length=0,unsafe=0;
  for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i],d=distance(a,b);length+=d;
    const steps=Math.max(1,Math.ceil(d/.05));
    for(let k=0;k<=steps;k++){
      const t=k/steps,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
      if(!clear(x,z))unsafe++;
    }
  }
  // 0.65m 3D error allows voxel height quantization, rejects distant snap/partial.
  // Distinguish intended destination from valid nearest point.
  return {accepted:startError<=.65&&endError<=.65&&unsafe===0,startError,endError,length,unsafe,points:p};
}
const pct=(x,p)=>{const s=[...x].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(p*s.length)-1)];};
const vec=p=>({x:p[0],y:p[1],z:p[2]});
const arr=p=>[p.x,p.y,p.z];
const recastOpts={cs:.15,ch:.25,walkableSlopeAngle:45,walkableHeight:8,walkableClimb:2,walkableRadius:2,minRegionArea:8,mergeRegionArea:20,maxSimplificationError:1.3,maxEdgeLen:12,maxVertsPerPoly:5,detailSampleDist:6,detailSampleMaxError:1};
const navcatOpts={cellSize:.15,cellHeight:.25,walkableRadiusWorld:.3,walkableRadiusVoxels:2,walkableClimbVoxels:2,walkableHeightWorld:2,walkableHeightVoxels:8,walkableSlopeAngleDegrees:45,borderSize:0,minRegionArea:8,mergeRegionArea:20,maxSimplificationError:1.3,maxEdgeLength:12,maxVerticesPerPoly:5,detailSampleDistance:.9,detailSampleMaxError:.25};
const report={scope:'Node-only query; no browser FPS, GPU, actual device, or final choice',node:process.version,geometry:{vertices:positions.length/3,triangles:indices.length/3,positions,indices},cases,settings:{recastOpts,navcatOpts},results:[]};
async function trial(name,make){
  const start=performance.now();let adapter;
  try{
    adapter=await make();
    const initBakeMs=performance.now()-start,times=[],results=[];
    for(const c of cases){
      const samples=[];
      let first;
      for(let i=0;i<30;i++){
        const t=performance.now(),p=adapter.query(c.from,c.to);
        samples.push(performance.now()-t);
        if(i===0)first=inspect(c,p);
      }
      times.push(...samples);
      results.push({id:c.id,want:c.want,...first,pass:first.accepted===c.want,medianMs:pct(samples,.5),p95Ms:pct(samples,.95)});
    }
    report.results.push({name,initBakeMs,queryMedianMs:pct(times,.5),queryP95Ms:pct(times,.95),passed:results.filter(x=>x.pass).length,total:results.length,results});
  }catch(e){report.results.push({name,error:String(e),stack:e.stack});}
  finally{adapter?.dispose?.();}
}
await trial('recast-navigation@0.43.1',async()=>{
  await init();
  const result=recastBake(positions,indices,recastOpts);
  if(!result.success)throw Error(result.error||'Recast bake failed');
  const mesh=result.navMesh,q=new NavMeshQuery(mesh);
  return {query(a,b){const x=q.computePath(vec(a),vec(b));return x.success?x.path.map(arr):[];},dispose(){q.destroy?.();mesh.destroy?.();}};
});
await trial('navcat@0.4.1',async()=>{
  const {navMesh}=navcatBake({positions:new Float32Array(positions),indices:new Uint32Array(indices)},navcatOpts);
  if(!navMesh)throw Error('Navcat bake failed');
  return {query(a,b){const x=findPath(navMesh,a,b,[.5,.75,.5],DEFAULT_QUERY_FILTER);return x.success?x.path.map(p=>Array.from(p.position)):[];}};
});
// A fixed authored waypoint graph is a deliberately constrained control.
// No general geometric solver; only named waypoints connected by prechecked routes.
await trial('authored-graph-control',async()=>{
  const nodes=[[-6,0,0],[-6,0,4],[6,0,4],[6,0,0],[-6,0,-4],[6,0,-4],[8,0,0],[12,2,0],[15,2,0]];
  const edges=[[0,1],[1,2],[2,3],[0,4],[4,5],[5,3],[3,6],[6,7],[7,8]];
  return {query(a,b){
    const s=nodes.findIndex(p=>distance(p,a)<.01),g=nodes.findIndex(p=>distance(p,b)<.01);
    if(s<0||g<0)return [];
    const queue=[[s]],seen=new Set([s]);
    while(queue.length){const path=queue.shift(),u=path.at(-1);if(u===g)return path.map(i=>nodes[i]);
      for(const [a,b] of edges){const v=a===u?b:b===u?a:-1;if(v>=0&&!seen.has(v)){seen.add(v);queue.push([...path,v]);}}
    }
    return [];
  }};
});
writeFileSync('map-3d-nav-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.results.map(({name,error,passed,total,initBakeMs,queryMedianMs,queryP95Ms})=>({name,error,passed,total,initBakeMs,queryMedianMs,queryP95Ms})),null,2));
if(report.results.filter(x=>!x.error&&x.name!=='authored-graph-control').length===0)process.exitCode=1;

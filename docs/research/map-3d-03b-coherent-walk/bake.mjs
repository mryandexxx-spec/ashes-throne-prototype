import {init,NavMeshQuery,exportNavMesh} from 'recast-navigation';
import {generateSoloNavMesh} from 'recast-navigation/generators';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=process.argv[2];const geo=JSON.parse(readFileSync(dir+'/nav.json')),level=JSON.parse(readFileSync(dir+'/level.json'));
await init();
const opts={cs:.15,ch:.25,walkableSlopeAngle:45,walkableHeight:8,walkableClimb:0,walkableRadius:2,minRegionArea:8,mergeRegionArea:20,maxSimplificationError:1.0,maxEdgeLen:12,maxVertsPerPoly:5,detailSampleDist:6,detailSampleMaxError:1};
const result=generateSoloNavMesh(geo.positions,geo.indices,opts);assert(result.success,result.error);const mesh=result.navMesh,q=new NavMeshQuery(mesh);
const vec=p=>({x:p[0],y:p[1],z:p[2]}),get=id=>level.markers.find(m=>m.id===id).position;
const report=[];
for(const [a,b] of [['spawn','direct'],['direct','exit'],['spawn','court'],['court','exit'],['exit','spawn']]){
 const path=q.computePath(vec(get(a)),vec(get(b)));assert(path.success&&path.path.length>=2,[a,b]);
 const p=path.path.at(-1),v=get(b);const error=Math.hypot(p.x-v[0],p.y-v[1],p.z-v[2]);assert(error<.65,[a,b,error]);
 report.push({from:a,to:b,points:path.path.map(p=>[p.x,p.y,p.z]),error});
}
writeFileSync(dir+'/navmesh.bin',exportNavMesh(mesh));q.destroy();mesh.destroy();
writeFileSync(dir+'/bake-receipt.json',JSON.stringify({opts,report},null,2));
const files={};for(const n of ["level.glb","level.json","nav.json","navmesh.bin"])files[n]=createHash("sha256").update(readFileSync(dir+'/'+n)).digest("hex");
writeFileSync(dir+'/manifest.json',JSON.stringify({schema:1,recast:"0.43.1",files},null,2));

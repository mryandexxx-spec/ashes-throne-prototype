import {init,NavMeshQuery,exportNavMesh} from 'recast-navigation';
import {generateSoloNavMesh} from 'recast-navigation/generators';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=process.argv[2],geo=JSON.parse(readFileSync(dir+'/nav.json')),level=JSON.parse(readFileSync(dir+'/level.json'));
await init();
const opts={cs:.15,ch:.15,walkableSlopeAngle:40,walkableHeight:12,walkableClimb:3,walkableRadius:2,minRegionArea:8,mergeRegionArea:20,maxSimplificationError:1,maxEdgeLen:12,maxVertsPerPoly:5,detailSampleDist:6,detailSampleMaxError:1};
const result=generateSoloNavMesh(geo.positions,geo.indices,opts);assert(result.success,result.error);
const mesh=result.navMesh,q=new NavMeshQuery(mesh),vec=p=>({x:p[0],y:p[1],z:p[2]}),get=id=>level.markers.find(m=>m.id===id).position;
const report=[];for(const [a,b] of [...level.edges,...level.edges.map(([a,b])=>[b,a]),['spawn','exit'],['exit','spawn']]){
const path=q.computePath(vec(get(a)),vec(get(b)));assert(path.success&&path.path.length>=2,JSON.stringify([a,b,path]));
const p=path.path.at(-1),v=get(b),error=Math.hypot(p.x-v[0],p.y-v[1],p.z-v[2]);assert(error<.65,JSON.stringify([a,b,error]));report.push({from:a,to:b,error,points:path.path.map(p=>[p.x,p.y,p.z])});
}
writeFileSync(dir+'/navmesh.bin',exportNavMesh(mesh));q.destroy();mesh.destroy();
writeFileSync(dir+'/bake-receipt.json',JSON.stringify({opts,report},null,2));
const files={};for(const n of ["level.glb","level.json","nav.json","navmesh.bin"])files[n]=createHash("sha256").update(readFileSync(dir+'/'+n)).digest("hex");
writeFileSync(dir+'/manifest.json',JSON.stringify({schema:1,recast:"0.43.1",files},null,2));
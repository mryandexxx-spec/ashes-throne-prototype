// Independently validate the authoring output, bake and query exported proxy.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {init,NavMeshQuery,exportNavMesh,importNavMesh} from 'recast-navigation';
import {generateSoloNavMesh} from 'recast-navigation/generators';
import {cases,inspect,positions,indices} from './map-3d-01-nav-core.mjs';
const root=resolve(process.argv[2]);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const v=p=>({x:p[0],y:p[1],z:p[2]});
const opts={cs:.15,ch:.25,walkableSlopeAngle:45,walkableHeight:8,walkableClimb:2,walkableRadius:2,minRegionArea:8,mergeRegionArea:20,maxSimplificationError:1.3,maxEdgeLen:12,maxVertsPerPoly:5,detailSampleDist:6,detailSampleMaxError:1};
await init();const results=[];
for(const name of ['base','revision']){
 const dir=root+'/'+name,nav=await read(dir+'/nav.json'),level=await read(dir+'/level.json');
 const bytes=await readFile(dir+'/level.glb');assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const j=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(j.asset.version,'2.0');assert(j.meshes.length>=4);assert(!j.nodes.some(n=>n.name?.startsWith('NAV_')),'proxy leaked into visible GLB');
 assert.deepEqual(nav.positions,positions);assert.deepEqual(nav.indices,indices);
 assert.equal(level.schema,1);assert.equal(level.coordinateSystem,'RH-Y-up-meters');assert.equal(new Set(level.markers.map(m=>m.id)).size,4);
 const start=performance.now(),b=generateSoloNavMesh(nav.positions,nav.indices,opts);assert(b.success);
 const bakeMs=performance.now()-start,encoded=exportNavMesh(b.navMesh);await writeFile(dir+'/navmesh.bin',encoded);b.navMesh.destroy();
 const restored=importNavMesh(encoded),mesh=restored.navMesh,q=new NavMeshQuery(mesh);
 const run=(a,b)=>{const x=q.computePath(v(a),v(b));return x.success?x.path.map(p=>[p.x,p.y,p.z]):[];};
 const checked=cases.map(c=>({id:c.id,...inspect(c,run(c.from,c.to)),want:c.want}));for(const c of checked)assert.equal(c.accepted,c.want,c.id);
 const spawn=level.markers.find(m=>m.role==='spawn').position;
 for(const m of level.markers.filter(m=>m.role!=='spawn'))assert(inspect({from:spawn,to:m.position},run(spawn,m.position)).accepted,m.id);
 q.destroy();mesh.destroy();
 results.push({name,bakeMs,navmeshBytes:encoded.byteLength,glbBytes:bytes.length,markers:level.markers,nav,checked});
}
assert.deepEqual(results[0].nav,results[1].nav);
assert.deepEqual(results[0].markers.map(m=>m.id),results[1].markers.map(m=>m.id));
for(let i=0;i<4;i++){const a=results[0].markers[i],b=results[1].markers[i];if(a.id==='lab.branch.n')assert.notDeepEqual(a.position,b.position);else assert.deepEqual(a,b);}
await writeFile(root+'/validation.json',JSON.stringify({results,scope:'neutral blockout; actual exported nav and serialized Recast round trip; no final art'},null,2));
console.log(JSON.stringify(results.map(({name,bakeMs,navmeshBytes,glbBytes,checked})=>({name,bakeMs,navmeshBytes,glbBytes,passed:checked.filter(x=>x.accepted===x.want).length}))));

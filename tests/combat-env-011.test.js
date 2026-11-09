"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),exportGlb=require("../tools/env011-gorge-export.cjs");
const asset=fs.readFileSync(path.join(root,"assets/env011/open-gorge-v1.glb"));
const len=asset.readUInt32LE(12),g=JSON.parse(asset.subarray(20,20+len).toString("utf8")),bin=28+len;
function point(mesh,row){
 const p=g.meshes[mesh].primitives[0].attributes.POSITION,a=g.accessors[p],v=g.bufferViews[a.bufferView],start=bin+v.byteOffset+12*row;
 return [asset.readFloatLE(start),asset.readFloatLE(start+4),asset.readFloatLE(start+8)];
}
test("ENV011 original GLB is deterministic, mobile-sized and contains 4 natural terrain meshes",()=>{
 const generated=exportGlb();
 assert.deepEqual(Buffer.from(generated.bytes),asset);
 assert.equal(asset.readUInt32LE(0),0x46546c67);
 assert.equal(asset.readUInt32LE(8),asset.length);
 assert.ok(asset.length<400000);
 assert.deepEqual(g.meshes.map(x=>x.name),["front_buttress","middle_terraces","gorge_floor","pale_horizon"]);
 assert.equal(generated.stats.reduce((sum,x)=>sum+x.triangles,0),11180);
});
test("ENV011 bank and canyon bed meet exactly along both shared seams",()=>{
 for(let row=0;row<=78;row+=6){
  const l=point(0,row*24),r=point(1,row*24);
  const floorL=point(2,row*16),floorR=point(2,row*16+15);
  assert.ok(l.every((v,i)=>Math.abs(v-floorL[i])<.002),"left seam "+row);
  assert.ok(r.every((v,i)=>Math.abs(v-floorR[i])<.002),"right seam "+row);
 }
 const first=point(2,7),last=point(2,78*16+7);
 assert.ok(first[1]>-5,"accessible gorge entrance");
 assert.ok(last[1]<-40,"deepening far course");
 const far=g.accessors[g.meshes[3].primitives[0].attributes.POSITION];
 assert.ok(far.max[1]<-25,"no high horizon ceiling");
});
test("ENV011 preserves fixed three-quarter camera, pinch limits and legacy GLB fallback",()=>{
 const get=p=>fs.readFileSync(path.join(root,p),"utf8");
 const game=get("game.js"),env=get("combat-environment-010.js"),visual=get("combat-visual-007.js");
 assert.match(game,/alpha:-3\*Math\.PI\/4,beta:\.96,radius:12,targetY:\.9/);
 assert.match(game,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
 assert.match(env,/open-gorge-v1\.glb/);
 assert.match(env,/fetch\(ASSET_ROOT\+"gorge-strata-v1\.glb"/);
 assert.ok(visual.indexOf("CombatEnvironment011.openRearExit")>visual.indexOf("CombatEnvironment009.build"));
 assert.ok(visual.indexOf("CombatEnvironment011.openRearExit")<visual.indexOf("CombatEnvironment010.build"));
});

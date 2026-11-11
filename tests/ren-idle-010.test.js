"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const motion=require("../ren-idle-kinemiq.js");
const file=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
test("RENIDLE010: KinemIQ CC0 relaxed-idle samples are finite, periodic and keyframed",()=>{
 assert.equal(motion.DURATION_MS,2500);
 assert.equal(motion.TIMES.length,14);
 assert.ok(motion.CHANNELS.length>=6);
 for(const ch of motion.CHANNELS){
  assert.equal(ch.data.length,motion.TIMES.length*3,ch.source);
  assert.deepEqual(motion.sample(ch,0),[0,0,0],ch.target+" begins from neutral delta");
  for(const t of [0,250,620,1110,1800,2499,2500,5000]){
   for(const v of motion.sample(ch,t))assert.ok(Number.isFinite(v)&&Math.abs(v)<.1,ch.target);
  }
 }
 assert.deepEqual(motion.sample(motion.CHANNELS[2],2500),motion.sample(motion.CHANNELS[2],0));
 assert.notDeepEqual(motion.sample(motion.CHANNELS[2],650),motion.sample(motion.CHANNELS[2],0));
 assert.equal(motion.glance(0),0);
 assert.ok(motion.glance(5500)>0);
 assert.ok(motion.glance(14500)<0);
});
test("RENIDLE010: additive motion preserves Ren bind pose and planted legs",()=>{
 class Q{
  constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}
  clone(){return new Q(this.x,this.y,this.z,this.w);}
  copyFrom(other){Object.assign(this,other);}
  multiply(b){const a=this;return new Q(
   a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
   a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
   a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
   a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z
  );}
  static RotationYawPitchRoll(y,x,z){return new Q(x*.5,y*.5,z*.5,Math.sqrt(Math.max(0,1-(x*x+y*y+z*z)*.25)));}
 }
 const names=["hips","hipR","hipL","kneeL","kneeR","spine","head","shL","shR","elL","elR"];
 const nodes=names.map(name=>({name,rotationQuaternion:new Q(.01,.02,.03,.9993)}));
 const originals=new Map(nodes.map(n=>[n.name,n.rotationQuaternion.clone()]));
 const animate=motion.create({Quaternion:Q},nodes);
 assert.equal(typeof animate,"function");
 animate(625);
 const moved=nodes.filter(n=>["spine","head","shL","shR","elL","elR"].includes(n.name));
 assert.ok(moved.some(n=>n.rotationQuaternion.x!==originals.get(n.name).x));
 for(const name of ["hips","hipR","hipL","kneeL","kneeR"])
  assert.ok(nodes.find(n=>n.name===name).rotationQuaternion,"RENPOSE012 preserves skeleton joint "+name);
 const snapshot=nodes.map(n=>n.rotationQuaternion.clone());
 animate(625);
 assert.deepEqual(nodes.map(n=>n.rotationQuaternion),snapshot,"repeating a frame cannot accumulate bone drift");
 animate(0);
 assert.notDeepEqual(nodes.find(n=>n.name==="spine").rotationQuaternion,originals.get("spine"),"RENIDLE011 preserves intentional asymmetrical relaxed pose");
 assert.equal(motion.create({Quaternion:Q},[{name:"other",rotationQuaternion:new Q()}]),null);
});
test("RENIDLE010: actual game GLB declares mapped skeleton joints",()=>{
 // Checkout binary itself, not an obsolete preview/placeholder.
 const p=path.join(__dirname,"../assets/ren-wanderer-v1.glb");
 const bytes=fs.readFileSync(p);
 assert.equal(bytes.toString("ascii",0,4),"glTF");
 const length=bytes.readUInt32LE(12);
 const type=bytes.toString("ascii",16,20);
 assert.equal(type,"JSON");
 const gltf=JSON.parse(bytes.subarray(20,20+length).toString("utf8"));
 const names=new Set((gltf.nodes||[]).map(n=>n.name).filter(Boolean));
 const mapped=motion.CHANNELS.filter(ch=>names.has(ch.target));
 assert.ok(mapped.length>=4,
  "Ren GLB must contain 4+ mapped bone names, available: "+[...names].join(", "));
 assert.ok(names.has("head"),"Ren GLB head must exist for looking around");
});
test("RENIDLE010: only hero viewer uses KinemIQ sampled motion",()=>{
 const card=file("ren-card-3d.js"),runtime=file("ren-glb-runtime.js"),html=file("index.html"),pkg=JSON.parse(file("package.json"));
 assert.match(card,/kinemiqIdle=typeof RenKinemIQIdle/);
 assert.match(card,/if\(kinemiqIdle\)kinemiqIdle\(idleMs\)/);
 assert.doesNotMatch(runtime,/RenKinemIQIdle/);
 assert.ok(html.indexOf("ren-idle-kinemiq.js?v=")<html.indexOf("ren-card-3d.js?v="));
 assert.ok(/^0\.3\.(?:1\d\d|[2-9]\d\d)$/.test(pkg.version));
 assert.ok(html.includes("v"+pkg.version+" · UIHUD001"));
 assert.match(html,/RENIDLE010/);
});

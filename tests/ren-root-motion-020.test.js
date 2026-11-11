'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const C=require('../ren-choreography.js');
const source=['animation-profiles.js','ren-choreography.js','battle-animation.js'].map(f=>fs.readFileSync(require('path').join(__dirname,'..',f),'utf8')).join('\n');
const {BattleAnimation:A,RenChoreography:R}=vm.runInNewContext(source+'\n({BattleAnimation,RenChoreography})');
test('RENCHOR021: continuous world trajectory, distance-scaled travel and exact return',()=>{
 C.calibrate(1.1);
 for(const d of [2.5,4.9,8]){
  const p=C.plan(d);let prev=C.sample(p,0);
  for(let t=5;t<=p.durationMs;t+=5){const s=C.sample(p,t);assert.ok(Number.isFinite(s.forward));assert.ok(Math.hypot(s.forward-prev.forward,s.lateral-prev.lateral)<.04,`jump ${d}m at ${t}`);prev=s;}
  assert.equal(C.sample(p,p.durationMs).forward,0);
  for(const t of [p.approachMs,p.attackStart,p.attackEnd,p.retreatStart,p.settleStart]){
   const a=C.sample(p,t-.001),b=C.sample(p,t+.001);assert.ok(Math.hypot(a.forward-b.forward,a.lateral-b.lateral)<.0001);
  }
  const side=C.offset(p,p.contactMs,{x:0,z:0},{x:d,z:0});
  const diagonal=C.offset(p,p.contactMs,{x:0,z:0},{x:0,z:d});
  assert.ok(Math.abs(side.x-diagonal.z)<1e-9);assert.ok(Math.abs(side.z+diagonal.x)<1e-9);
 }
 assert.ok(C.plan(8).approachMs>C.plan(2.5).approachMs);
});
test('RENCHOR021: real GLB root samples transferred, including lateral weight shift',()=>{
 const bytes=fs.readFileSync(require('path').join(__dirname,'../assets/ren-meshy-mixamo-animated.glb'));
 const n=bytes.readUInt32LE(12),g=JSON.parse(bytes.toString('utf8',20,20+n)),data=bytes.subarray(28+n);
 const anim=g.animations.find(a=>a.name==='Double_Combo_Attack');
 const c=anim.channels.find(c=>g.nodes[c.target.node].name==='mixamorig:Hips'&&c.target.path==='translation');
 const ac=g.accessors[anim.samplers[c.sampler].output],view=g.bufferViews[ac.bufferView],offset=(view.byteOffset||0)+(ac.byteOffset||0);
 C.calibrate(1);
 for(const frame of [0,20,39,60]){
  // Original asset is 30fps; Babylon exposes 60fps frames. Contact interpolates.
  const i=frame/2,lo=Math.floor(i),hi=Math.ceil(i),p=i-lo;
  const read=(i,k)=>data.readFloatLE(offset+i*12+k*4);
  const x=read(lo,0)*(1-p)+read(hi,0)*p-read(0,0),z=read(lo,2)*(1-p)+read(hi,2)*p-read(0,2);
  const r=C.rootAt(frame/60*1000);assert.ok(Math.abs(r.forward-z)<1e-6);assert.ok(Math.abs(r.lateral-x)<1e-6);
 }
 assert.ok(C.rootAt(1000).forward>.3);assert.ok(Math.abs(C.rootAt(650).lateral)>.05);
});
test('RENCHOR021: contacts occur during strike once at every speed; death and clear drain safely',()=>{
 for(const speed of [1,2,4]){
  A.clear();const p=R.plan(4.9);
  A.enqueue([{type:'ability',actorId:'ren',targetId:'shade',abilityId:'basic'},{type:'damage',actorId:'ren',targetId:'shade',amount:10},{type:'death',targetId:'shade'}],{ren:{x:0,z:0},shade:{x:4.9,z:0}});
  let cues=0,at=0;
  while(A.pending()&&at<15000){A.tick(5,speed);at+=5*speed;const c=A.drainStarted();if(c.length){cues+=c.length;assert.ok(at>=p.contactMs&&at<p.contactMs+21);assert.equal(A.activity('ren').slot,'basic');assert.equal(A.activity('shade').slot,'hit');}}
  assert.equal(A.pending(),0);assert.equal(cues,1);assert.equal(A.isDying('shade'),false);
  A.clear();assert.equal(A.activity('ren').slot,'idle');
 }
});
test('RENCHOR021: other actors retain sequential presentation and clear cancels contact',()=>{
 A.clear();A.enqueue([{type:'ability',actorId:'kael',targetId:'shade',abilityId:'basic'},{type:'damage',actorId:'kael',targetId:'shade'}],{kael:{x:0,z:0},shade:{x:5,z:0}});
 assert.equal(A.pending(),2);A.tick(100,4);assert.equal(A.pending(),0);
 A.enqueue([{type:'ability',actorId:'ren',targetId:'shade',abilityId:'basic'},{type:'damage',actorId:'ren',targetId:'shade'}],{ren:{x:0,z:0},shade:{x:5,z:0}});A.clear();A.tick(100,4);assert.equal(A.drainStarted().length,0);
});

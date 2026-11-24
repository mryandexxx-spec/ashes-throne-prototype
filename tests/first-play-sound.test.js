"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Sound=require("../first-play-sound.js");
function fake(){
 const created=[],sources=[];
 class Context{
  constructor(){created.push(this);this.state="suspended";this.sampleRate=8000;this.currentTime=0;this.destination={};}
  async resume(){this.state="running";}
  async close(){this.state="closed";}
  createBuffer(ch,size){const samples=new Float32Array(size);return {getChannelData:()=>samples};}
  createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;}
  createBiquadFilter(){return {frequency:{},connect(){},disconnect(){}};}
  createGain(){return {gain:{},connect(){},disconnect(){}};}
 }
 return {Context,created,sources};
}
test("sound has no autoplay/context until explicit enable",async()=>{
 const f=fake(),sound=Sound.create(f.Context);
 assert.equal(f.created.length,0);
 assert.equal(sound.play("warning","intro:0"),false);
 assert.equal(await sound.enable(),true);
 assert.equal(sound.active(),true);
 assert.equal(f.created.length,1);
 assert.equal(sound.play("warning","intro:0"),true);
 const count=f.sources.length;
 assert.ok(count>0&&f.sources.every(s=>s.started));
 assert.equal(sound.play("warning","intro:0"),false);
 assert.equal(f.sources.length,count);
 assert.equal(sound.play("conflict","intro:1"),true);
 assert.ok(f.sources.slice(0,count).every(s=>s.stopped));
 sound.stop();
 assert.ok(f.sources.every(s=>s.stopped));
 sound.disable();
 assert.equal(f.created[0].state,"closed");
 assert.equal(sound.active(),false);
 assert.equal(sound.play("rescue","outro:0"),false);
});
test("unsupported or denied sound leaves gameplay usable",async()=>{
 assert.equal(await Sound.create(null).enable(),false);
 class Denied{constructor(){throw Error("denied");}}
 assert.equal(await Sound.create(Denied).enable(),false);
});
test("each synthesized cue has a bounded length, volume and known accent",()=>{
 for(const entries of Object.values(Sound.CUES)){
  assert.ok(entries.length<=3);
  for(const [kind,offset,duration,volume] of entries){
   assert.ok(["wind","water","wood","metal","step","paper"].includes(kind));
   assert.ok(offset>=0&&duration>0&&offset+duration<=3);
   assert.ok(volume>0&&volume<=.15);
  }
 }
});

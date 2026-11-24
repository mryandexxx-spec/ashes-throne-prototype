/* FIRSTSESSIONP1C: original synthesized scene accents. No music, downloads or autoplay. */
const FirstPlaySound=(()=>{
 "use strict";
 const CUES=Object.freeze({
  warning:[["wind",0,2.5,.10],["wood",.4,.52,.15],["wood",1.2,.35,.10]],
  conflict:[["wind",0,1.6,.08],["metal",.25,.48,.14],["wood",.85,.38,.11]],
  artSupport:[["metal",.1,.45,.12],["wind",.4,1.8,.07]],
  renRoute:[["step",.1,.22,.13],["step",.47,.2,.10],["wind",.8,1.5,.07]],
  rescue:[["step",.1,.22,.10],["step",.45,.22,.09],["water",0,2.4,.11]],
  document:[["paper",.1,.52,.10]]
 });
 function create(Context){
  let ctx=null,nodes=[],key=null;
  function stop(){
   key=null;
   for(const n of nodes){try{n.stop();}catch(_){}}
   nodes=[];
  }
  function disable(){
   stop();
   const old=ctx;ctx=null;
   try{old?.close()?.catch(()=>{});}catch(_){}
  }
  async function enable(){
   if(typeof Context!=="function")return false;
   try{
    if(!ctx)ctx=new Context();
    const current=ctx;
    if(current.state!=="running")await current.resume();
    return ctx===current&&current.state==="running";
   }catch(_){disable();return false;}
  }
  function play(cue,frameKey){
   if(!ctx||ctx.state!=="running"||!CUES[cue]||key===frameKey)return false;
   stop();key=frameKey;
   try{
    const now=ctx.currentTime;
    for(const [kind,offset,duration,volume] of CUES[cue]){
     const start=now+offset,end=start+duration;
     const rate=ctx.sampleRate;
     const buffer=ctx.createBuffer(1,Math.ceil(rate*duration),rate);
     const samples=buffer.getChannelData(0);
     let random=0x5a17,smoothed=0;
     for(let i=0;i<samples.length;i++){
      random=(Math.imul(random,1664525)+1013904223)>>>0;
      const white=random/2147483648-1;
      smoothed=smoothed*.88+white*.12;
      const t=i/rate;
      const envelope=Math.min(1,t/.025,(duration-t)/.055);
      const tone=kind==="metal"?Math.sin(2*Math.PI*880*t)*Math.exp(-t*8):
       kind==="wood"?Math.sin(2*Math.PI*(110*t+50*t*t))*.35:0;
      samples[i]=(kind==="paper"?white*.45:smoothed+tone)*Math.max(0,envelope);
     }
     const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
     source.buffer=buffer;filter.type=kind==="paper"?"highpass":"lowpass";
     filter.frequency.value={wind:560,water:980,wood:420,metal:2600,step:280,paper:900}[kind];
     gain.gain.value=volume;
     source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
     source.onended=()=>{nodes=nodes.filter(n=>n!==source);try{source.disconnect();filter.disconnect();gain.disconnect();}catch(_){}};
     nodes.push(source);source.start(start);source.stop(end);
    }
    return true;
   }catch(_){stop();return false;}
  }
  return Object.freeze({enable,disable,stop,play,active:()=>!!ctx&&ctx.state==="running"});
 }
 return Object.freeze({CUES,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FirstPlaySound;

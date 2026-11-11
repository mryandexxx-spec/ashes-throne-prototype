/* RENCHOR021: presentation only. Source frames are Babylon 60fps frames.
 * First slash 0..60 of Double_Combo_Attack, measured from the real GLB.
 * Root curve is extracted to the anchor, never discarded or applied twice.
 */
const RenChoreography=(()=>{
 "use strict";
 const ROOT=[[0.0,0.0,0.0],[33.33333,-0.00025704,0.00485814],[66.66667,-0.00207348,0.01217616],[100.0,-0.00462442,0.02179861],[133.33333,-0.00755734,0.03363061],[166.66666,-0.01100961,0.04765725],[200.00002,-0.01573567,0.06268841],[233.33335,-0.02016575,0.07705772],[266.66668,-0.02428869,0.09006917],[300.00001,-0.02811859,0.10144454],[333.33334,-0.0317331,0.11132336],[366.66667,-0.03513082,0.11945611],[400.00001,-0.03975413,0.12748599],[433.33334,-0.04555387,0.13581735],[466.6667,-0.05196732,0.14454585],[500.0,-0.0580711,0.1530506],[533.33336,-0.0610682,0.15820181],[566.66666,-0.0627835,0.16183764],[600.00002,-0.0651592,0.16427982],[633.33333,-0.06932061,0.1660856],[666.66669,-0.07558867,0.16771066],[699.99999,-0.08159651,0.17580104],[733.33335,-0.08560837,0.18761182],[766.66665,-0.08879833,0.20249629],[800.00001,-0.0915693,0.2200259],[833.33331,-0.09341441,0.23981309],[866.66667,-0.0940056,0.26195377],[899.99998,-0.09327966,0.2845034],[933.33334,-0.09203122,0.30644405],[966.66664,-0.090551,0.32682282],[1000.0,-0.0885254,0.34470099]];
 const SOURCE=Object.freeze({attackEndFrame:60,contactFrame:37,attackMs:1000,runMs:633.333333,walkMs:1033.333333,runStrideSpeed:4.665,walkStrideSpeed:1.35});
 const clamp=v=>Math.max(0,Math.min(1,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 let scale=1,spacing=1.05;
 function calibrate(value,contact){
  if(!Number.isFinite(value)||value<=0)return;
  scale=value;spacing=1.05*value;
  if(contact&&Number.isFinite(contact.forward)&&Number.isFinite(contact.lateral)&&Number.isFinite(contact.y))
   spacing=contact.forward+Math.sqrt(Math.max(0,targetSurfaceRadius(contact.y)**2-contact.lateral**2));
 }
 // Exact cross section of the existing enemy capsule (height 1.5, radius
 // .42, center y=.8) plus sphere head (diameter .62, center y=1.8).
 function targetSurfaceRadius(y){
  const bodyDy=Math.max(.47-y,0,y-1.13),headDy=y-1.8;
  return Math.sqrt(Math.max(0,.42**2-bodyDy**2,.31**2-headDy**2));
 }
 function contactError(point,target){
  const radial=Math.hypot(point.x-target.x,point.z-target.z);
  const y=point.y-(target.y??.8)+.8,bodyDy=Math.max(.47-y,0,y-1.13);
  return Math.abs(Math.min(Math.hypot(radial,bodyDy)-.42,Math.hypot(radial,y-1.8)-.31));
 }
 function rootAt(ms,units=scale){
  ms=Math.max(0,Math.min(1000,ms));
  let i=0;while(i<ROOT.length-2&&ROOT[i+1][0]<ms)i++;
  const a=ROOT[i],b=ROOT[i+1],p=clamp((ms-a[0])/(b[0]-a[0]));
  return {forward:(a[2]+(b[2]-a[2])*p)*units,lateral:(a[1]+(b[1]-a[1])*p)*units};
 }
 function plan(distance=4.9){
  distance=Number.isFinite(distance)?Math.max(0,distance):4.9;
  // Candidate contact spacing; exposed on the lab for visual acceptance.
  const travel=Math.max(0,distance-spacing);
  const runSpeed=SOURCE.runStrideSpeed*scale,walkSpeed=SOURCE.walkStrideSpeed*scale;
  const approachMs=travel?travel/runSpeed*1000+160:0;
  const attackStart=approachMs+120;
  const attackEnd=attackStart+SOURCE.attackMs;
  const retreatStart=attackEnd+200;
  const endRoot=rootAt(1000,scale);
  const retreatDistance=Math.hypot(travel+endRoot.forward,endRoot.lateral);
  const retreatMs=retreatDistance?retreatDistance/walkSpeed*1000+160:0;
  const settleStart=retreatStart+retreatMs;
  return Object.freeze({scale,spacing,distance,travel,retreatDistance,approachMs,attackStart,attackEnd,retreatStart,retreatMs,settleStart,
   contactMs:attackStart+SOURCE.contactFrame/60*1000,durationMs:settleStart+140,endRoot});
 }
 // Acceleration/deceleration ramps; full speed is determined by the distance,
 // not by a fixed percentage of an unrelated action duration.
 function travelAt(t,duration){
  if(!duration)return 1;
  t=Math.max(0,Math.min(duration,t));const ramp=Math.min(160,duration/2),area=duration-ramp;
  if(t<ramp)return t*t/(2*ramp*area);
  if(t>duration-ramp)return 1-(duration-t)**2/(2*ramp*area);
  return (t-ramp/2)/area;
 }
 const clip=(name,ms)=>({name,progress:name==='Double_Combo_Attack'?clamp(ms/2833.333492):((ms%(name==='Running'?SOURCE.runMs:SOURCE.walkMs))+(name==='Running'?SOURCE.runMs:SOURCE.walkMs))%(name==='Running'?SOURCE.runMs:SOURCE.walkMs)/(name==='Running'?SOURCE.runMs:SOURCE.walkMs)});
 function sample(p,time){
  const t=Math.max(0,Math.min(p.durationMs,time));
  let forward=0,lateral=0,a={name:'Idle_4',progress:0},b=a,weight=0,phase='idle';
  if(t<p.approachMs){
   phase='approach';forward=p.travel*travelAt(t,p.approachMs);
   a={name:'Idle_4',progress:0};b=clip('Running',p.travel*travelAt(t,p.approachMs)/(SOURCE.runStrideSpeed*p.scale)*1000);weight=smooth(t/120);
  }else if(t<p.attackStart){
   phase='brake';forward=p.travel;
   a=clip('Running',p.travel/(SOURCE.runStrideSpeed*p.scale)*1000);b=clip('Double_Combo_Attack',0);weight=smooth((t-p.approachMs)/120);
   if(!p.approachMs)a={name:'Idle_4',progress:0};
  }else if(t<p.attackEnd){
   phase=t<p.contactMs?'windup':'strike';
   const ms=t-p.attackStart,r=rootAt(ms,p.scale);forward=p.travel+r.forward;lateral=r.lateral;
   a=b=clip('Double_Combo_Attack',ms);
  }else if(t<p.retreatStart){
   phase='recover';forward=p.travel+p.endRoot.forward;lateral=p.endRoot.lateral;
   a=clip('Double_Combo_Attack',1000);b={name:'Idle_4',progress:0};weight=smooth((t-p.attackEnd)/200);
  }else if(t<p.settleStart){
   phase='retreat';const ms=t-p.retreatStart,f=1-travelAt(ms,p.retreatMs);
   forward=(p.travel+p.endRoot.forward)*f;lateral=p.endRoot.lateral*f;
   a={name:'Idle_4',progress:0};b=clip('Walking',-p.retreatDistance*(1-f)/(SOURCE.walkStrideSpeed*p.scale)*1000);weight=smooth(ms/140)*smooth((p.settleStart-t)/140);
  }else{phase='settle';}
  return {phase,forward,lateral,a,b,weight,contact:Math.abs(t-p.contactMs)<35};
 }
 function offset(p,time,origin,target){
  const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz)||1,s=sample(p,time);
  return {x:dx/d*s.forward-dz/d*s.lateral,z:dz/d*s.forward+dx/d*s.lateral};
 }
 return Object.freeze({SOURCE,calibrate,targetSurfaceRadius,contactError,rootAt,plan,sample,offset});
})();
if(typeof module!=='undefined')module.exports=RenChoreography;

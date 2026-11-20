/* Combat-005: presentation-only animation catalog.
   Every fighter can override a slot independently. Missing slots use templates.
   Future model/AnimationGroup adapters may read asset/clip IDs from resolved entries. */
const AnimationProfiles=(()=>{
 "use strict";
 const SLOTS=Object.freeze(["idle","basic","special","powerful","passive","leader","guard","ward","hit","death"]);
 const templates=Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:1200,amplitude:.055}),
  basic:Object.freeze({kind:"lunge",durationMs:200,amplitude:.55}),
  special:Object.freeze({kind:"lunge",durationMs:200,amplitude:.7}),
  powerful:Object.freeze({kind:"lunge",durationMs:420,amplitude:.85}),
  passive:Object.freeze({kind:"ward",durationMs:280,amplitude:.22}),
  leader:Object.freeze({kind:"ward",durationMs:360,amplitude:.3}),
  guard:Object.freeze({kind:"guard",durationMs:190,amplitude:.32}),
  ward:Object.freeze({kind:"ward",durationMs:140,amplitude:.25}),
  hit:Object.freeze({kind:"hit",durationMs:120,amplitude:.18}),
  death:Object.freeze({kind:"death",durationMs:400,amplitude:.85})
 });
 const overrides=new Map();
 // RENPACE018: Meshy source clips last 14.0s idle, 2.83s combo,
 // 2.5s axe spin, 4.83s hit (including recovery), 2.97s death.
 // RENQUEUE019: moderate timing plus strict visual queue synchronization.\n // x2/x4 still use BattleSpeed, with no changes to the combat simulation.
 overrides.set("ren",Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:14000,amplitude:0}),
  basic:Object.freeze({kind:"lunge",durationMs:1350,amplitude:.55}),
  special:Object.freeze({kind:"lunge",durationMs:1500,amplitude:.7}),
  powerful:Object.freeze({kind:"lunge",durationMs:1650,amplitude:.85}),
  hit:Object.freeze({kind:"hit",durationMs:650,amplitude:.18}),
  death:Object.freeze({kind:"death",durationMs:1850,amplitude:.85})
 }));
 // NADAANIM001: Nada had no profile and used capsule templates, so her Meshy clips
 // ran 3-16x faster than authored (hit 1.2s in 120ms, death 6.3s in 400ms).
 // Clip sources: Archery_Shot_3 0.67s, mage_soell_cast 2.27s, Hit_Reaction_1 1.2s,
 // Idle_11 1.87s, Electrocuted_Fall window 2.6-5.2s (see NadaGlbRuntime.WINDOWS).
 overrides.set("nada",Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:1867,amplitude:0}),
  basic:Object.freeze({kind:"lunge",durationMs:900,amplitude:0}),
  special:Object.freeze({kind:"lunge",durationMs:900,amplitude:0}),
  powerful:Object.freeze({kind:"lunge",durationMs:1900,amplitude:0}),
  hit:Object.freeze({kind:"hit",durationMs:650,amplitude:.18}),
  death:Object.freeze({kind:"death",durationMs:2000,amplitude:.85})
 }));
 // LIORAANIM001: Liora had no profile either, so her shield clips were squeezed into the
 // capsule templates (bash 2.37s in 200ms, hit 1.63s in 120ms, death 2.9s in 400ms — 7-17x).
 // Both of her active abilities are self-guards, so BattleAnimation resolves them to the
 // "guard" slot followed by a "ward" cue on herself; those two slots are the ones that
 // actually play in battle (Liora_Shield_Block raise 0-55%, then the held block 55-100%).
 // Clip sources: Liora_Shield_Bash 2.37s, Liora_Shield_Block 3.47s, Squat_Stance 4.73s,
 // Hit_Reaction 1.63s, Liora_Shield_Death 2.97s (window 0-98%), Idle_02 1.87s.
 // Guard/ward amplitude 0: the skinned body must not hop or tilt under the clip.
 overrides.set("liora",Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:1867,amplitude:0}),
  // HUDSYNC001: the shield thrust lands around the middle of Liora_Shield_Bash;
  // target reactions and HUD numbers wait for that moment instead of the clip end.
  basic:Object.freeze({kind:"lunge",durationMs:1500,amplitude:.55,contactFraction:.5}),
  special:Object.freeze({kind:"lunge",durationMs:1750,amplitude:.55}),
  powerful:Object.freeze({kind:"lunge",durationMs:2400,amplitude:.55}),
  guard:Object.freeze({kind:"guard",durationMs:1300,amplitude:0}),
  ward:Object.freeze({kind:"ward",durationMs:900,amplitude:0}),
  hit:Object.freeze({kind:"hit",durationMs:850,amplitude:.18}),
  death:Object.freeze({kind:"death",durationMs:2000,amplitude:.85})
 }));
 // ART3D001: planted idle/insurance; physical actions use authored Mixamo clips.
 // Temporary visuals only — source clip names are not equipment or canon.
 overrides.set("art",Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:1833,amplitude:0}),
  basic:Object.freeze({kind:"lunge",durationMs:1450,amplitude:.55}),
  special:Object.freeze({kind:"guard",durationMs:1100,amplitude:0}),
  powerful:Object.freeze({kind:"lunge",durationMs:1800,amplitude:.72}),
  guard:Object.freeze({kind:"guard",durationMs:900,amplitude:0}),
  ward:Object.freeze({kind:"ward",durationMs:900,amplitude:0}),
  hit:Object.freeze({kind:"hit",durationMs:1150,amplitude:.12}),
  death:Object.freeze({kind:"death",durationMs:2200,amplitude:0})
 }));
 // SAVA3D001: no fake melee lunge; the skinned rig animates while rooted.
 overrides.set("sava",Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:4000,amplitude:0}),
  basic:Object.freeze({kind:"idle",durationMs:1400,amplitude:0}),
  special:Object.freeze({kind:"idle",durationMs:1700,amplitude:0}),
  powerful:Object.freeze({kind:"idle",durationMs:2100,amplitude:0}),
  guard:Object.freeze({kind:"idle",durationMs:900,amplitude:0}),
  ward:Object.freeze({kind:"idle",durationMs:900,amplitude:0}),
  hit:Object.freeze({kind:"hit",durationMs:1150,amplitude:.12}),
  death:Object.freeze({kind:"death",durationMs:2200,amplitude:0})
 }));
 // ARENA-ART-004C/004D: enemy GLB profiles by archetypeId (dev/src/assets/npc-models.js).
 // Shared Meshy clip lengths: Combat_Stance 1.70s, Thrust_Slash 3.03s, Over_Shoulder_Throw 4.33s,
 // Crouch_Charge_and_Throw 7.70s, Triple_Combo_Attack 4.37s, Block1 3.50s,
 // Charged_Spell_Cast 2.70s, Hit_Reaction 1.67s, dying_backwards 2.23s.
 // ARENA-ART-004D: each slot shows a measured part of its clip (NpcGlbRuntime.WINDOWS);
 // contactFraction equals that window's contact knot, so hit reactions and HUD numbers
 // start when the blow lands or the throw leaves the hand. Durations keep the 004C pace
 // or shorten it: guard raise 1300 -> 900 ms, death 2000 -> 1400 ms.
 // rooted: thrown/cast from the fighter's place, no visual approach (like Nada's shots).
 // Skinned bodies must not hop or tilt under guard/ward/death: amplitude 0 there, and
 // clipFall on death: dying_backwards already falls, so no extra template tilt.
 // Battle fighters carry instance ids, so link(instanceId, archetypeId) maps them while
 // the model is shown; a capsule fallback keeps the templates.
 {
  const idle=Object.freeze({kind:"idle",durationMs:1700,amplitude:0});
  const slash=Object.freeze({kind:"lunge",durationMs:1600,amplitude:.55,contactFraction:.42});
  const combo=Object.freeze({kind:"lunge",durationMs:2200,amplitude:.55,contactFraction:.6});
  const throwShot=Object.freeze({kind:"lunge",durationMs:1800,amplitude:0,rooted:true,contactFraction:.78});
  const chargedThrow=Object.freeze({kind:"lunge",durationMs:2600,amplitude:0,rooted:true,contactFraction:.75});
  const block=Object.freeze({kind:"guard",durationMs:1300,amplitude:0});
  const raise=Object.freeze({kind:"guard",durationMs:900,amplitude:0});
  const cast=Object.freeze({kind:"guard",durationMs:1500,amplitude:0});
  const gesture=Object.freeze({kind:"lunge",durationMs:1500,amplitude:0,rooted:true,contactFraction:.78});
  const ward=Object.freeze({kind:"ward",durationMs:900,amplitude:0});
  const hit=Object.freeze({kind:"hit",durationMs:800,amplitude:.18});
  const death=Object.freeze({kind:"death",durationMs:1400,amplitude:0,clipFall:true});
  const common={idle,guard:raise,ward,hit,death};
  const tank=Object.freeze({...common,basic:slash,special:block,powerful:block});
  const support=Object.freeze({...common,basic:slash,special:gesture,powerful:cast,guard:cast});
  for(const [id,slots] of [
   ["npc-pass-guard",tank],
   ["npc-laun-ford-guard",tank],
   ["npc-watch-captain",{...tank,powerful:combo}],
   ["npc-trail-interceptor",{...common,basic:slash,special:slash,powerful:combo}],
   ["npc-ridge-slinger",{...common,basic:throwShot,special:throwShot,powerful:chargedThrow}],
   ["npc-field-medic",support],
   ["npc-laun-physician",support],
   ["npc-route-signaller",support],
   // ARENA-ART-004E: sarkh clips come from the same Meshy set (moments measured on the snakes
   // match the humanoid table), so the slots reuse the measured profiles.
   ["npc-sarkh-convoy-guard",tank],
   ["npc-sarkh-land-courier",{...common,basic:throwShot,special:throwShot,powerful:throwShot}]
  ])overrides.set(id,Object.freeze({...slots}));
 }
 const links=new Map();
 function link(instanceId,profileId){
  if(typeof instanceId!=="string"||!instanceId||!overrides.has(profileId))return false;
  links.set(instanceId,profileId);return true;
 }
 function unlink(instanceId){links.delete(instanceId);}
 function register(heroId,slots){
  if(typeof heroId!=="string"||!heroId.trim()||!slots||typeof slots!=="object"||Array.isArray(slots))
   throw Error("Invalid character animation profile");
  const resolved={};
  for(const [slot,definition] of Object.entries(slots)){
   if(!SLOTS.includes(slot)||!definition||typeof definition!=="object"||
      !Number.isFinite(definition.durationMs)||definition.durationMs<=0||
      typeof definition.kind!=="string"||
      !["idle","lunge","guard","ward","hit","death"].includes(definition.kind)||
      !Number.isFinite(definition.amplitude)||definition.amplitude<0||
      ((definition.assetId!==undefined||definition.clipName!==undefined)&&
       (typeof definition.assetId!=="string"||!definition.assetId.trim()||
        typeof definition.clipName!=="string"||!definition.clipName.trim())))
    throw Error("Invalid animation slot: "+slot);
   resolved[slot]=Object.freeze({...definition});
  }
  overrides.set(heroId,Object.freeze(resolved));
 }
 function resolve(heroId,slot){
  if(!SLOTS.includes(slot))return null;
  const custom=(overrides.get(heroId)||overrides.get(links.get(heroId)))?.[slot];
  return custom||templates[slot];
 }
 function isCustom(heroId,slot){return !!(overrides.get(heroId)||overrides.get(links.get(heroId)))?.[slot];}
 return Object.freeze({slots:SLOTS,register,resolve,isCustom,link,unlink});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AnimationProfiles;

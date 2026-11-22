"use strict";
/* Historical sandbox-fixture adapter. This is TEST-ONLY: gameplay's HEROES is not
   modified, and production squads only expose ren/nada/liora/art/sava.
   Kept for mechanical regression scenarios written for the original training
   cast while those scripts are progressively ported to the five playable heroes. */
const fs=require("node:fs");
let originalRead=null;
function inject(source){
 if(typeof source!=="string"||!source.includes("const HEROES = [")||
    !source.includes("const PILOT_HERO_STATS=Object.freeze({"))
  throw Error("legacy scenario: incompatible game source");
 return source.replace("const HEROES = [",`const HEROES = [
 {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,speed:110,side:"ally",glyph:"♜"},
 {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,speed:155,side:"ally",glyph:"♧"},
 {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,speed:125,side:"ally",glyph:"⚔"},
 {id:"medic-demo",name:"Учебный лекарь",role:"Учебная поддержка",hp:90,atk:14,speed:115,side:"ally",glyph:"✚"},
 {id:"test-area-damage",name:"Учебный боец группы",role:"Тренировка массовых атак",hp:90,atk:20,speed:120,side:"ally",glyph:"✧"},`)
  .replace("const PILOT_HERO_STATS=Object.freeze({",`const PILOT_HERO_STATS=Object.freeze({
 kael:Object.freeze({physicalDefense:24,magicDefense:12,maxProtection:20}),
 lyra:Object.freeze({physicalDefense:6,magicDefense:15,maxProtection:0}),
 darin:Object.freeze({physicalDefense:14,magicDefense:9,maxProtection:0}),`);
}
function install(){
 if(originalRead)return;
 originalRead=fs.readFileSync;
 fs.readFileSync=function(file,...args){
  const contents=originalRead.call(fs,file,...args);
  if(typeof contents!=="string"||!/(?:^|[/\\])game\.js$/.test(String(file)))
   return contents;
  return inject(contents);
 };
}
module.exports={inject,install};
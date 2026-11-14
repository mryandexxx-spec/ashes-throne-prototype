"use strict";
/* Synthetic inspection scenario ONLY for tests; no canonical story content. */
const LoreCampaign004Fixture=(()=>{
 const base=typeof module!=="undefined"&&module.exports?
  require("./lore-campaign-003-fixture.js"):LoreCampaign003Fixture;
 function create(data){
  const b=base.create(data);
  const scene=b.pack.scenes[0],notes=scene.beats.find(beat=>beat.id==="notes");
  notes.inspections=[
   {id:"material-a",label:"Исследовать материал A",text:"Здесь видна неровная строка <img src=x onerror=alert(1)>."},
   {id:"material-b",label:"Исследовать материал B",text:"Второй материал содержит другую последовательность."}
  ];
  notes.requiredInspectionIds=["material-a","material-b"];
  notes.comparisons=[{
   id:"comparison",label:"Сопоставить A и B",
   text:"В материалах обнаружено расхождение. Из этого не следует готовый ответ.",
   evidenceIds:["material-a","material-b"]
  }];
  notes.requiredComparisonIds=["comparison"];
  scene.objectives.push(
   {id:"manual-a",kind:"inspect",hint:"Осмотреть A",required:true,evidenceIds:["material-a"]},
   {id:"manual-b",kind:"inspect",hint:"Осмотреть B",required:true,evidenceIds:["material-b"]},
   {id:"manual-compare",kind:"compare",hint:"Сопоставить A и B",
     required:true,evidenceIds:["material-a","material-b"],comparisonId:"comparison"}
  );
  return b;
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaign004Fixture;

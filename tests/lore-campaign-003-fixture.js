"use strict";
/* Test-only synthetic material. Not a chapter of «Пять теней» and never loaded by index.html. */
const LoreCampaign003Fixture=(()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 function create(data){
  const graph=clone(data.catalog());
  graph.nodes[0].contentId="fixture:source-selection";
  const beats=[
   {id:"intro",speakerId:"Наблюдатель",text:"Демо: <script>alert('not executed')</script>",
    nextBeatId:"notes",choiceIds:[],effects:[{type:"markEvidenceSeen",id:"journal"}],skipSafe:true},
   {id:"notes",speakerId:null,text:"Демо: второй источник.",
    nextBeatId:"decision",choiceIds:[],effects:[{type:"markEvidenceSeen",id:"sheet"}],skipSafe:true},
   {id:"decision",speakerId:null,text:"Демо: что проверить сначала?",
    nextBeatId:null,choiceIds:["left","right"],effects:[],skipSafe:false},
   {id:"leftBeat",speakerId:"Проверяющий",text:"Демо: путь через журнал.",
    nextBeatId:"end",choiceIds:[],effects:[],skipSafe:true},
   {id:"rightBeat",speakerId:"Проверяющий",text:"Демо: путь через лист.",
    nextBeatId:"end",choiceIds:[],effects:[],skipSafe:true},
   {id:"end",speakerId:null,text:"Демо: оба пути привели к завершению.",
    nextBeatId:null,choiceIds:[],effects:[],skipSafe:false}
  ];
  const choices=[
   {id:"left",decisionId:"order",label:"Сначала журнал",nextBeatId:"leftBeat",effects:[]},
   {id:"right",decisionId:"order",label:"Сначала лист",nextBeatId:"rightBeat",effects:[]}
  ];
  const objectives=[
   {id:"read",kind:"view",hint:"Прочитать вступление",required:true,beatId:"intro"},
   {id:"inspect",kind:"inspect",hint:"Увидеть журнал",required:true,evidenceIds:["journal"]},
   {id:"compare",kind:"compare",hint:"Сравнить материалы",required:true,evidenceIds:["journal","sheet"]},
   {id:"choose",kind:"choose",hint:"Выбрать порядок",required:true,decisionId:"order"}
  ];
  const scene={id:"fixture:source-selection",nodeId:"five-shadows:fs-01",
   entryBeatId:"intro",beats,choices,objectives};
  return {graph,pack:{scenes:[scene]},data:{...data,catalog:()=>graph}};
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaign003Fixture;

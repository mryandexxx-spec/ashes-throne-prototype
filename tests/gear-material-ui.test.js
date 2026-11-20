"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const files=["gear-data","progress-core","mission-data","campaign-data","gear-source-data",
 "daily-core","login-core","network-data","network-live-economy","lore-act1-reward-core",
 "reward-policy-core","weekly-threat-core","gear-material-ui"];
const deps=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(root,f+".js"),"utf8")).join("\n")+
 "\n({ui:GearMaterialUI,data:GearData,network:NetworkData,rewards:NetworkLiveEconomy})",{require:require("node:module").createRequire(path.join(root,"index.js"))});
test("Every inventory material has its own decodable-format WebP and safe accessible tile",()=>{
 for(const id of deps.data.MATERIALS){
  const data=fs.readFileSync(path.join(root,"assets","gear-materials",id+".webp"));
  assert.equal(data.toString("ascii",0,4),"RIFF");assert.equal(data.toString("ascii",8,12),"WEBP");
  const html=deps.ui.tile(id,0,2);
  assert.ok(html.includes('data-material="'+id+'"')&&html.includes('aria-haspopup="dialog"')&&
   html.includes("0/2")&&html.includes("не хватает 2"));
 }
 assert.equal(deps.ui.tile('__proto__',1),"");
 assert.equal(deps.ui.group({Fe:0,Gl:-1,unknown:4}),"");
 assert.match(deps.ui.group({Fe:0},{stock:true}),/Железо ×0/);
 assert.match(deps.ui.tile("Fe",2,2),/is-ready/);
});
test("Glass lists only positive real awards, distinguishes calendar and one-time clears and excludes the pilot network",()=>{
 const profile={energy:{value:0},materials:{Gl:1},rewardReceipts:[{id:"first-clear:five-shadows-act-2:once"}]};
 const before=JSON.stringify(profile);
 const options={day:"2026-02-11",liveNetwork:true,weekly:true};
 const rows=Object.fromEntries(deps.ui.sources("Gl",profile,null,options).map(s=>[s.title,s.lines]));
 assert.equal(rows["Задания дня"],undefined);
 assert.equal(rows["Главная угроза · раз в неделю"].length,3);
 assert.match(rows["Пять теней · один раз за акт"][0],/Акт 2 · ×1 · получено/);
 assert.ok(!rows["Пять теней · один раз за акт"].some(x=>x.includes("Акт 1")));
 assert.ok(rows["Календарь входа"][0].includes("28-й")&&!rows["Календарь входа"][0].includes("35-й"));
 for(const t of deps.network.LIVE_CATALOG.templates.filter(t=>t.materialId==="Gl")){
  const qty=deps.rewards.preview(t.rewardRef).materials.Gl;
  assert.ok(rows["Разведсеть · снабжение"].some(x=>x.includes("×"+qty+" за зацепку · влияние от "+t.minInfluence)));
 }
 assert.ok(!deps.ui.sources("Gl",profile,null,{day:options.day}).some(s=>s.title.startsWith("Разведсеть")));
 assert.equal(JSON.stringify(profile),before);
});

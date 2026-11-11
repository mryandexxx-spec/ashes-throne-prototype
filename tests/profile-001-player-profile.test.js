"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const api=vm.runInNewContext(read("player-profile-core.js")+"\nPlayerProfileCore");
const same=x=>JSON.parse(JSON.stringify(x));
const storageData=new Map();
const storage={getItem:k=>storageData.has(k)?storageData.get(k):null,
 setItem:(k,v)=>storageData.set(k,v)};
const getStorage=()=>storage;
const initial=api.load(getStorage);
assert.deepEqual(same(initial),{profile:{nickname:"Странник"},available:true,blocked:false});
assert.equal(storageData.has(api.KEY),false,"reading profile must not mutate localStorage");
for(const value of ["", " ", "Я", "x".repeat(25),"<img src=x>","a\u0000b",42,null]){
 assert.equal(api.normalizeNick(value),null);
 assert.equal(api.save({nickname:value},getStorage),false);
}
assert.equal(api.normalizeNick("  Тёмный    странник  "),"Тёмный странник");
assert.equal(api.normalizeNick("🙂🙂"),"🙂🙂");
assert.equal(api.save({nickname:"  Изгнанник  "},getStorage),true);
assert.deepEqual(same(api.load(getStorage)),{profile:{nickname:"Изгнанник"},available:true,blocked:false});
assert.equal(api.save({nickname:"Игрок"},()=>{throw Error("blocked")}),false);
assert.equal(api.load(()=>null).available,false);
const good=storageData.get(api.KEY);
storageData.set(api.KEY,'{"version":1,"nickname":"<img>"}');
assert.equal(api.load(getStorage).blocked,true);
assert.equal(api.save({nickname:"Друг"},getStorage),false);
assert.equal(storageData.get(api.KEY),'{"version":1,"nickname":"<img>"}');
storageData.set(api.KEY,good);
const P=vm.runInNewContext(read("progress-core.js")+"\nProgressCore");
assert.deepEqual(same(api.levelProgress(0,P.xpCost,15)),
 {level:1,current:0,required:47,totalXp:0,percent:0});
assert.equal(api.levelProgress(47,P.xpCost,15).level,2);
for(const xp of [0,1,46,47,80,350,10000]){
 const calc=api.levelProgress(xp,P.xpCost,15);
 assert.equal(calc.level, P.accountLevel({accountXp:xp}));
 assert.ok(calc.percent>=0&&calc.percent<=100);
}
assert.equal(api.levelProgress(-1,P.xpCost,15),null);
// Render & submit actual game.js profile section under a miniature DOM.
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
for(const required of ['id="playerProfile"','data-screen="playerProfile"','id="playerNicknameForm"',
 'id="playerAccountXpFill"','id="playerCampaignStars"','src="player-profile-core.js"']){
 assert.ok(html.includes(required),required);
}
assert.ok(html.indexOf('src="player-profile-core.js"')<html.indexOf(('src="game.js?v='+require('../package.json').version+'"')));
assert.match(css,/\.player-profile-grid/);
assert.match(css,/max-height:540px/);
assert.match(game,/if\(id==="playerProfile"\)renderPlayerProfile\(\)/);
const from=game.indexOf("// PROFILE-001:");
const to=game.indexOf("let battleIsCampaign=false;",from);
assert.ok(from>0&&to>from);
const nodes=new Map();
for(const id of ["playerNickname","playerNicknameInput","playerNicknameNotice",
 "playerAccountLevel","playerAccountXpTrack","playerAccountXpFill",
 "playerAccountXpText","playerCompletedMissions","playerCampaignStars","playerHeroCount",
 "playerNicknameForm"]){
 nodes.set(id,{id,textContent:"",value:"",style:{},attributes:{},
  handlers:{},setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,f){this.handlers[k]=f}});
}
const $=s=>nodes.get(s.slice(1))??null;
const fakeProgress={accountXp:85};
const campaignProgress={completed:{"black-pass-ambush":true,"demo-mission-2":false,"demo-mission-3":false},
 bestStars:{"black-pass-ambush":3}};
const allMissionIds=["black-pass-ambush","demo-mission-2","demo-mission-3"];
const stage=vm.runInNewContext(read("player-profile-core.js")+"\n"+read("progress-core.js")+
 "\nconst progress=profileProgress,campaignProgress=profileCampaign,ALLIES=profileHeroes;"+
 "\nconst MissionData={all:()=>missionIds.map(id=>({id}))};"+
 "\nconst $=selectNode;\n"+game.slice(from,to)+
 "\n({renderPlayerProfile,getNick:()=>playerNickname})",
 {window:{localStorage:storage},document:{activeElement:null},
 profileProgress:fakeProgress,profileCampaign:campaignProgress,
 profileHeroes:[1,2,3,4,5],missionIds:allMissionIds,selectNode:$});
stage.renderPlayerProfile();
assert.equal(nodes.get("playerNickname").textContent,"Изгнанник");
assert.equal(nodes.get("playerAccountLevel").textContent,"Уровень 2");
assert.equal(nodes.get("playerCompletedMissions").textContent,"1 / 3");
assert.equal(nodes.get("playerCampaignStars").textContent,"3 / 9");
assert.equal(nodes.get("playerHeroCount").textContent,5);
assert.equal(nodes.get("playerAccountXpFill").style.width,api.levelProgress(85,P.xpCost,15).percent+"%");
fakeProgress.accountXp=0;
stage.renderPlayerProfile();
assert.equal(nodes.get("playerAccountXpFill").style.width,"0%");
const onSubmit=nodes.get("playerNicknameForm").handlers.submit;
assert.equal(typeof onSubmit,"function");
let prevented=0;
nodes.get("playerNicknameInput").value="<script>";
onSubmit({preventDefault(){prevented++}});
assert.equal(stage.getNick(),"Изгнанник");
assert.equal(storageData.get(api.KEY),good);
nodes.get("playerNicknameInput").value=" Новое имя ";
onSubmit({preventDefault(){prevented++}});
assert.equal(stage.getNick(),"Новое имя");
assert.equal(nodes.get("playerNickname").textContent,"Новое имя");
assert.equal(api.load(getStorage).profile.nickname,"Новое имя");
assert.equal(prevented,2);
assert.equal(fakeProgress.accountXp,0,"nickname must not change XP");
console.log("Profile-001: valid/corrupted local nickname, XP, game profile UI render/submit, campaign facts passed");

/* CAMPAIGN-HUB-001: prevent regressions in the three-path selector.
   This is a static contract test; browser and iPhone checks remain separate. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=name=>fs.readFileSync(require("node:path").join(__dirname,"..",name),"utf8");
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
test("campaign hub has three unique actionable cards and a back button",()=>{
 for(const path of ["training","lore","main"])assert.equal((html.match(new RegExp('data-campaign-path="'+path+'"',"g"))||[]).length,1);
 for(const id of ["campaignHub","campaignTrainingContent","campaignLoreContent","campaignMainContent","campaignBackButton"])assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1);
 assert.match(game,/showCampaignPath\(button\.dataset\.campaignPath\)/);
 assert.match(game,/if\(selectedCampaignPath\)showCampaignPath\(null\)/);
 assert.match(game,/if\(previousScreenId!=="campaign"\)showCampaignPath\(null\)/);
});
test("existing mission identifiers, state and rewards stay stable",()=>{
 const context=vm.createContext({});
 const modules=vm.runInContext(read("mission-data.js")+"\n"+read("campaign-data.js")+"\n"+read("campaign-core.js")+"\n;({MissionData,CampaignData,CampaignCore})",context);
 const ids=Array.from(modules.MissionData.all(),item=>item.id);
 assert.deepEqual(ids,["black-pass-ambush","demo-mission-2","demo-mission-3"]);
 assert.equal(modules.CampaignData.catalogIsValid(),true);
 assert.equal(modules.CampaignCore.VERSION,2);
 assert.equal(modules.CampaignCore.KEY,"ashes-throne.campaign.v1");
 assert.match(html,/id="campaignMissions"/);
 assert.match(game,/CampaignCore\.recordResult/);
});
test("existing battles remain in training and story trial in main",()=>{
 const training=html.slice(html.indexOf('id="campaignTrainingContent"'),html.indexOf('id="campaignMainContent"'));
 const main=html.slice(html.indexOf('id="campaignMainContent"'),html.indexOf('id="heroGearDialog"'));
 const lore=html.slice(html.indexOf('id="campaignLoreContent"'),html.indexOf('id="campaignTrainingContent"'));
 assert.match(training,/id="campaignMissions"/);
 assert.match(training,/id="energyStatus"/);
 assert.doesNotMatch(training,/id="storyDemoOpen"/);
 assert.match(main,/id="storyDemoOpen"/);
 assert.doesNotMatch(main,/id="campaignMissions"/);
 assert.doesNotMatch(lore,/data-campaign-mission/);
 assert.match(lore,/Загрузка игрового пилота «Пять теней»/);
});
test("landscape cards and native hidden attribute are styled",()=>{
 assert.match(css,/#campaignHub\[hidden\],\.campaign-path-content\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(css,/\.campaign-hub-card:focus-visible/);
});

test("cover art is independently replaceable, thematic and lightweight",()=>{
 for(const [path,asset] of [["training","training"],["lore","five-shadows"],["main","throne"]]){
  assert.ok(css.includes("campaign-hub-"+path+"::before"),path+" cover selector");
  assert.ok(css.includes('campaign-cover-'+asset+'.svg'),asset+" asset referenced");
  const svg=read("assets/campaign-cover-"+asset+".svg");
  assert.match(svg,/<svg /);
  assert.ok(Buffer.byteLength(svg,"utf8")<8192,asset+" should remain lightweight");
 }
 assert.ok(html.includes('<strong>Кампании лора</strong><small>Пять теней</small>'));
 assert.ok(html.includes('id="trainingCampaignProgress">Тренировочные миссии'));
 assert.ok(!html.includes('id="trainingCampaignProgress">3 миссии'));
 assert.ok(css.includes("@media (orientation:portrait) and (max-width:640px)"));
 assert.ok(css.includes("@media (prefers-reduced-motion:reduce)"));
});

test("CAMPAIGN-ART-002: approved artwork crops are WebP, independent and small",()=>{
 const files=["training","five-shadows","throne"];
 let total=0;
 for(const name of files){
  const asset="assets/campaign-cover-"+name+".webp";
  const bytes=fs.readFileSync(require("node:path").join(__dirname,"..",asset));
  assert.equal(bytes.toString("ascii",0,4),"RIFF");
  assert.equal(bytes.toString("ascii",8,12),"WEBP");
  assert.ok(bytes.length>3000&&bytes.length<60000,asset+" budget");
  total+=bytes.length;
  assert.ok(css.includes('url("'+asset+'")'),asset+" referenced from CSS");
 }
 assert.ok(total<100000,"total campaign artwork exceeds 100 KB");
 assert.match(css,/#campaignHub \.campaign-hub-card::before\{/);
 assert.match(css,/background-position:center,center 27%,center/);
 assert.match(css,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(css,/#campaignHub \.campaign-hub-card:focus-visible|\.campaign-hub-card:focus-visible/);
});
test("CAMPAIGN-ART-002: cover treatment preserves all three working paths",()=>{
 for(const type of ["training","lore","main"]){
  assert.ok(html.includes('data-campaign-path="'+type+'"'));
 }
 assert.ok(game.includes("showCampaignPath(button.dataset.campaignPath)"));
 assert.ok(html.includes('id="trainingCampaignProgress">Тренировочные миссии'));
 assert.ok(html.includes('<strong>Кампании лора</strong><small>Пять теней</small>'));
 assert.ok(html.includes('id="campaignLoreContent"'));
 assert.doesNotMatch(html,/data-campaign-path="lore"[^>]*disabled/);
});

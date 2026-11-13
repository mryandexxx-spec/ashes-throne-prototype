/* CAMPAIGN-HUB-001: prevent regressions in the three-path selector.
   This is a static contract test; browser and iPhone checks remain separate. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=name=>fs.readFileSync(require("node:path").join(__dirname,"..",name),"utf8");
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
function panel(id){const begin=html.indexOf('<div id="'+id+'"');assert.ok(begin>=0,id+" exists");const next=html.indexOf('<div id="campaign',begin+6);return html.slice(begin,next>=0?next:html.indexOf("</section>",begin));}
test("campaign hub has three unique actionable cards and a back button",()=>{
 for(const path of ["training","lore","main"])assert.equal((html.match(new RegExp('data-campaign-path="'+path+'"',"g"))||[]).length,1);
 for(const id of ["campaignHub","campaignTrainingContent","campaignLoreContent","campaignMainContent","campaignBackButton"])assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1);
 assert.match(game,/showCampaignPath\(button\.dataset\.campaignPath\)/);
 assert.match(game,/if\(selectedCampaignPath\)showCampaignPath\(null\)/);
 assert.match(game,/if\(previousScreenId!=="campaign"\)showCampaignPath\(null\)/);
});
test("existing mission identifiers, state and rewards stay stable",()=>{
 const context=vm.createContext({});
 vm.runInContext(read("mission-data.js")+"\n"+read("campaign-data.js")+"\n"+read("campaign-core.js"),context);
 const ids=Array.from(context.MissionData.all(),item=>item.id);
 assert.deepEqual(ids,["black-pass-ambush","demo-mission-2","demo-mission-3"]);
 assert.equal(context.CampaignData.catalogIsValid(),true);
 assert.equal(context.CampaignCore.VERSION,2);
 assert.equal(context.CampaignCore.KEY,"ashes-throne.campaign.v1");
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
 assert.match(lore,/Пока доступных миссий нет/);
});
test("landscape cards and native hidden attribute are styled",()=>{
 assert.match(css,/#campaignHub\[hidden\],\.campaign-path-content\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(css,/\.campaign-hub-card:focus-visible/);
});

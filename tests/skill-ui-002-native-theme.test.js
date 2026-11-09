"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const section=html.split('<dialog id="skillUpgradeDialog"')[1]?.split('<dialog id="gearPromotionDialog"')[0];
assert.ok(section,"skill dialog remains in place");
const ids=["skillUpgradeDialog","skillUpgradeTitle","skillUpgradeSubhead","skillUpgradeClose",
 "skillPreviewLabel","skillPreviewText","skillPreviewMeta","skillNextEffect",
 "skillLevelButtons","skillLevelDetails","skillCostLabel","skillCostText",
 "skillUpgradeStatus","skillUpgradeButton"];
for(const id of ids){
 const n=(html.match(new RegExp('id="'+id+'"',"g"))||[]).length;
 assert.equal(n,1,id+" must be unique and preserved");
}
assert.ok(section.indexOf("skill-level-navigation")<section.indexOf("skill-dialog-grid"),
 "six level choices are in the native header strip above the two dossier panels");
assert.ok(section.includes('class="skill-dialog-cost"'));
assert.ok(css.includes("background:var(--panel);border:1px solid var(--line)"),
 "game panel theme tokens are reused");
const onlySkill=css.slice(css.indexOf("/* SkillUI-002:"));
assert.ok(onlySkill.includes("background:var(--panel2)"));
assert.ok(onlySkill.includes("border-radius:12px"));
assert.ok(onlySkill.includes("var(--gold)"));
assert.ok(!onlySkill.includes("#201810"),"old reference brown modal removed");
assert.ok(!onlySkill.includes("#39291c"),"old reference header brown removed");
assert.ok(!onlySkill.includes("#e8a653"),"old reference orange selected level removed");
assert.ok(onlySkill.includes("env(safe-area-inset-bottom"));
assert.ok(onlySkill.includes("min-height:44px"),"skill targets remain touch-friendly");
assert.match(css,/@media\(orientation:landscape\) and \(max-height:540px\)/);
assert.ok(game.includes('$("#skillUpgradeButton")?.addEventListener("click"'));
assert.ok(game.includes('$("#skillLevelButtons")?.addEventListener("click"'));
assert.ok(game.includes('$("#skillUpgradeClose")?.addEventListener("click"'));
assert.ok(html.includes("v0.3.85 · OPSHELP"));
assert.equal(JSON.parse(read("package.json")).version,"0.3.85");
console.log("SkillUI-002: own project theme, controls, preview, mobile scroll and version contract passed");

"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const {HeroProfileData,StoryTrialData}=vm.runInNewContext(
 read("hero-profile-data.js")+"\n"+read("story-trial-data.js")+"\n({HeroProfileData,StoryTrialData})");
const hero=StoryTrialData.heroes().find(x=>x.id==="trial-ren");
assert.ok(hero);
assert.equal(hero.classId,"melee","class stays independent of origin");
assert.equal(HeroProfileData.hasTag(hero,"gardens-over-abyss"),true);
assert.equal(HeroProfileData.hasTag(hero,"unknown"),false);
assert.equal(HeroProfileData.tag("gardens-over-abyss").kind,"origin","not an invented faction");
assert.deepEqual(Array.from(HeroProfileData.tagLabels(hero.tags)),["Сады над пропастью"]);
const profile=HeroProfileData.get("trial-ren");
assert.ok(profile);
assert.equal(profile.name,"Рен Терен");
assert.equal(profile.tags[0],hero.tags[0],"profile and battle share stable origin ID");
for(const detail of ["Косой Полке","Садах над пропастью","Эле Терен","Надой","Вель"]){
 assert.ok(profile.biography.includes(detail),"approved biography should contain "+detail);
}
assert.equal(HeroProfileData.get("trial-nada"),null,"avoid inventing biographies for other characters");
assert.equal(HeroProfileData.get("kael"),null,"avoid assigning invented biography to test-only roster");
assert.equal(HeroProfileData.hasTag(StoryTrialData.heroes().find(x=>x.id==="trial-liora"),"gardens-over-abyss"),false,
 "Ren origin must not automatically tag other Gardens characters");
assert.equal(Object.isFrozen(hero.tags),true,"shared tag source is read-only");
assert.equal(Object.isFrozen(profile),true,"biography content immutable");
const html=read("index.html"),js=read("game.js"),css=read("styles.css");
for(const id of ["detailTags","detailBiography","storyRenTags","storyRenBiography","heroBiographyDialog",
 "heroBiographyTitle","heroBiographyTags","heroBiographyText","heroBiographyNote","heroBiographyClose"]){
 const matches=html.match(new RegExp('id="'+id+'"',"g"))||[];
 assert.equal(matches.length,1,id+" occurs only once");
}
const heroSection=html.split('<section id="heroDetail"')[1]?.split('<section id="campaign"')[0];
assert.ok(heroSection.includes('id="detailBiography"'),"normal hero profile has biography button");
const storySection=html.split('<section id="storyDemo"')[1]?.split('<section id="squad"')[0];
assert.ok(storySection.includes('id="storyRenBiography"'),"trial Ren profile can open biography without recruitment");
assert.ok(html.indexOf('src="hero-profile-data.js"')<html.indexOf('src="game.js?v=0.3.106"'));
assert.match(js,/function showHeroBiography\(/);
assert.match(js,/HeroProfileData\.tagLabels/);
assert.match(js,/heroBiographyDialog/);
assert.ok(css.includes(".hero-biography-dialog"));
assert.ok(css.includes("max-height:calc(100dvh - 24px)"));
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
assert.ok(!read("hero-collection-core.js").includes("trial-ren"));
console.log("REN-001: approved origin tag, source-grounded biography, reusable profile buttons and no save expansion checked");

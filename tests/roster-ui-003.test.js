"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const html=read("index.html"),js=read("game.js"),css=read("styles.css"),profile=require("../hero-profile-data.js");
test("UIHERO002 displays established character identity and does not invent factions",()=>{
 assert.deepEqual(profile.tagLabels(profile.get("ren").tags),["Сады над пропастью"]);
 assert.deepEqual(profile.tagLabels(profile.get("kael")?.tags),[]);
 assert.match(js,/HeroProfileData\.get\(h\.id\)/);
 assert.match(js,/HeroProfileData\.tagLabels\(profile\.tags\)/);
 assert.match(js,/class="roster-identity-tag"/);
 assert.doesNotMatch(js,/roster-squad-badge|roster-in-squad/);
 assert.match(css,/#collection \.roster-identity-tag\{/);
});
test("UIHERO002 uses styled in-page menu instead of native select",()=>{
 assert.doesNotMatch(html,/<select id="rosterSort"/);
 assert.match(html,/<button type="button" id="rosterSortTrigger"[^>]*aria-expanded="false"/);
 assert.match(html,/id="rosterSortMenu"[^>]*hidden/);
 for(const key of ["level","stars","gear","name"]){
  assert.match(html,new RegExp('data-roster-sort="'+key+'" aria-pressed="(?:true|false)"'));
 }
 assert.match(js,/function closeRosterSortMenu\(/);
 assert.match(js,/event\.key==="Escape"/);
 assert.match(js,/!picker\.contains\(event\.target\)/);
 assert.match(js,/button\.dataset\.rosterSort/);
 assert.match(css,/#collection \.roster-sort-menu\[hidden\]\{display:none\}/);
 assert.match(css,/#collection \.roster-sort-menu button\{[^\n]*min-height:44px/);
});
test("UIHERO002 version is consistent",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.101");
 assert.match(html,/v0\.3\.101 · UIMODES001D/);
});

test("UIHERO002 shows only the current leader in the collection, without squad badges",()=>{
 assert.match(js,/const isLeader=owned&&selectedLeaderId===h\.id/);
 assert.match(js,/const leaderBadge=isLeader\?'<span class="roster-leader-indicator">★ Лидер<\/span>'/);
 assert.match(js,/\$\{portraitAvatar\}\$\{leaderBadge\}/);
 assert.doesNotMatch(js,/roster-squad-badge/);
 assert.match(css,/#collection \.roster-leader-indicator\{/);
 assert.match(js,/HeroProfileData\.tagLabels\(profile\.tags\)/);
});

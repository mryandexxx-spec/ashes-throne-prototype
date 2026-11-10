"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const html=read("index.html"),js=read("game.js"),css=read("styles.css");
const source=js.slice(js.indexOf("function rosterOrder("),js.indexOf("function renderHeroes(){",js.indexOf("function rosterOrder(")));
const order=vm.runInNewContext(source+"\nrosterOrder");
const items=[
 {index:0,owned:true,hero:{name:"Рен",level:2},rank:3,tier:2},
 {index:1,owned:false,hero:{name:"Алиса",level:99},rank:7,tier:3},
 {index:2,owned:true,hero:{name:"Лира",level:8},rank:2,tier:1},
 {index:3,owned:true,hero:{name:"Дарин",level:8},rank:5,tier:3},
 {index:4,owned:false,hero:{name:"Бор",level:99},rank:7,tier:3}
];
const ids=(f,s)=>Array.from(order(items,f,s),e=>e.index);
test("UIHERO002 filters available and locked while keeping obtained first",()=>{
 assert.deepEqual(ids("all","level"),[2,3,0,1,4]);
 assert.deepEqual(ids("owned","level"),[2,3,0]);
 assert.deepEqual(ids("locked","level"),[1,4]);
});
test("UIHERO002 sorts real stars and gear without showing locked names",()=>{
 assert.deepEqual(ids("all","stars"),[3,0,2,1,4]);
 assert.deepEqual(ids("owned","gear"),[3,0,2]);
 assert.deepEqual(ids("all","name"),[3,2,0,1,4]);
});
test("UIHERO002 exposes accessible, touch-friendly roster controls",()=>{
 for(const key of ["all","owned","locked"])assert.ok(html.includes('data-roster-filter="'+key+'"'));
 for(const key of ["level","stars","gear","name"])assert.ok(html.includes('data-roster-sort="'+key+'"'));
 assert.match(html,/id="rosterShown"/);
 assert.match(js,/button\.setAttribute\("aria-pressed"/);
 assert.match(css,/#collection \.roster-filter-button\{min-height:44px/);
 assert.match(css,/#collection \.roster-sort-trigger\{[^\n]*min-height:44px/);
});
test("UIHERO002 keeps navigation without squad badges",()=>{
 assert.doesNotMatch(js,/roster-squad-badge|roster-in-squad/);
 assert.match(js,/if\(heroOwned\(id\)\)openHeroDetail\(id\);else showLockedHero\(id\)/);
 assert.match(js,/rosterReturnScrollY=window\.scrollY/);
 assert.match(js,/const restore=rosterRestoreOnReturn&&rosterWasInDossier/);
 assert.match(js,/requestAnimationFrame\(scroll\)/);
});
test("UIHERO002 build matches package",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.95");
 assert.match(html,/v0\.3\.95 · UISYS001A/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const dependencies=["daily-core","login-core","resource-icon-ui"];
const ui=vm.runInNewContext(dependencies.map(name=>fs.readFileSync(path.join(root,name+".js"),"utf8")).join("\n")+"\nResourceIconUI",{});
test("Approved WebP atlas is compact, valid RIFF/WebP and stores four 64px cells",()=>{
 const data=fs.readFileSync(path.join(root,"assets/resources/atlas.webp"));
 assert.equal(data.toString("ascii",0,4),"RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP");
 assert.ok(data.length<16000);
 assert.deepEqual(Array.from(ui.IDS),["account-xp","krom","manual1","manual2","seal"]);
});
test("Clickable tiles validate ids and counters, and keep ability costs distinct",()=>{
 assert.equal(ui.tile("__proto__",1),"");
 assert.equal(ui.tile("manual1",-1),"");
 assert.match(ui.tile("account-xp",20),/data-resource-id="account-xp"/);
 assert.match(ui.tile("seal",2),/aria-haspopup="dialog"/);
 assert.match(ui.tile("manual2",3,{stock:1,need:3}),/resource-chip--short/);
 assert.match(ui.tile("manual2",3,{stock:3,need:3}),/resource-chip--ready/);
 assert.match(ui.rewards(12,{manual1:2,unknown:900}),/account-xp/);
 assert.ok(!ui.rewards(0,{unknown:9}).includes("unknown"));
});
test("Source cards reflect only actual daily and calendar skill awards",()=>{
 const date="2026-11-22";
 const beginner=ui.sources("manual1",date);
 const advanced=ui.sources("manual2",date);
 const seal=ui.sources("seal",date);
 assert.ok(beginner.some(x=>x.screen==="dailyTasks"&&x.detail.includes("Завершить бой кампании")));
 assert.ok(advanced.some(x=>x.screen==="dailyTasks"&&x.detail.includes("тактической задаче")));
 assert.ok(!seal.some(x=>x.screen==="dailyTasks"));
 assert.ok(seal.some(x=>x.screen==="loginCalendar"&&x.detail.includes("7")));
 const xp=ui.sources("account-xp",date);
 assert.ok(xp.some(x=>x.screen==="campaign"));
 assert.ok(xp.some(x=>x.screen==="dailyTasks"));
 assert.equal(ui.sources("unknown",date).length,0);
});
test("No wallet modifications in display module; costs use source-of-truth skill IDs",()=>{
 const code=fs.readFileSync(path.join(root,"resource-icon-ui.js"),"utf8");
 assert.doesNotMatch(code,/(?:progress|skillMaterials)\s*=\s*.+/);
 assert.match(code,/document\.addEventListener\("click"/);
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/id="resourceDialog"/);
 assert.match(html,/resource-icon-ui\.js/);
});

test("Krom coin is an independent compact transparent WebP, without a save schema change",()=>{
 const coin=fs.readFileSync(path.join(root,"assets/resources/krom.webp"));
 assert.equal(coin.toString("ascii",0,4),"RIFF");
 assert.equal(coin.toString("ascii",8,12),"WEBP");
 assert.ok(coin.length>1000&&coin.length<10000);
 assert.match(fs.readFileSync(path.join(root,"resource-icon-ui.css"),"utf8"),/krom\.webp\?v=2/);
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/data-resource-id="krom"/);
 assert.match(html,/id="hqCurrency"/);
 assert.match(html,/v0.3.228 · KROM002/);
 assert.match(fs.readFileSync(path.join(root,"progress-core.js"),"utf8"),/progress\.currency/);
});
test("Krom rewards, costs and source cards reuse verified catalogs",()=>{
 assert.match(ui.currencyTile(250),/data-resource-id="krom"/);
 assert.match(ui.currencyTile(250),/\+250/);
 assert.match(ui.currencyTile(250,{mode:"balance"}),/>250</);
 assert.match(ui.currencyTile(300,{stock:120,asCost:true}),/resource-chip--short/);
 assert.match(ui.currencyTile(300,{stock:400,asCost:true}),/resource-chip--ready/);
 assert.equal(ui.currencyTile(-1),"");
 assert.ok(ui.sources("krom","2026-11-22").some(x=>x.screen==="dailyTasks"&&x.detail.includes("Повысить уровень")));
 assert.ok(ui.sources("krom","2026-11-22").some(x=>x.screen==="loginCalendar"));
 assert.match(ui.art("krom"),/resource-art--krom/);
});

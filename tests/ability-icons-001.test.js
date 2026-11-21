"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const Icons=require("../ability-icon-core.js"),NPC=require("../npc-enemy-data.js");
test("ABILITYICONS001: 23 playable and 40 NPC icons, no demo actors",()=>{
 assert.equal(Icons.KEYS.length,63);assert.equal(new Set(Icons.KEYS).size,63);
 assert.equal(Icons.KEYS.filter(k=>k.startsWith("npc-")).length,40);
 for(const id of Icons.HERO_IDS)for(const slot of ["basic","special","powerful","passive"])
  assert.equal(Icons.key({id},slot),id+"-"+slot);
 for(const entry of NPC.all())for(const slot of ["basic","special","powerful","passive"])
  assert.equal(Icons.key({id:"wave",side:"enemy",archetypeId:entry.archetypeId},slot),entry.archetypeId+"-"+slot);
 for(const id of ["liora","art","sava"])assert.equal(Icons.key({id},"leader"),id+"-leader");
 for(const id of ["ren","nada"])assert.equal(Icons.key({id},"leader"),null);
 assert.equal(Icons.key({id:"kael"},"basic"),null);
});
test("ABILITYICONS001: approved atlas is a real small WebP, slicing is safe",()=>{
 const image=fs.readFileSync(path.join(__dirname,"..","assets/abilities/atlas.webp"));
 assert.equal(image.subarray(0,4).toString(),"RIFF");
 assert.equal(image.subarray(8,12).toString(),"WEBP");
 assert.ok(image.length>=30000&&image.length<65536);
 assert.match(Icons.style("ren","basic"),/background-size:900% 700%/);
 assert.match(Icons.style("npc-watch-captain","passive"),/background-position:/);
 assert.equal(Icons.style("missing","basic"),null);
 assert.equal(Icons.markup("missing","basic"),"");
 assert.match(Icons.markup("sava","leader"),/data-ability-icon="sava-leader"/);
});
test("ABILITYICONS001: the same icon source is used in all five UI locations",()=>{
 const html=read("index.html"),game=read("game.js"),arena=read("arena-ui-003.js"),css=read("styles.css");
 const version=JSON.parse(read("package.json")).version;
 assert.ok(html.includes('src="ability-icon-core.js?v='+version+'"'));
 assert.ok(html.indexOf("ability-icon-core.js")<html.indexOf("arena-ui-003.js"));
 assert.match(arena,/AbilityIconCore\.markup/);
 for(const marker of ["roster-ability-icons","hero-ability-thumb","squad-leader-skill-icon","npc-ability-row"])
  assert.ok(game.includes(marker),marker);
 for(const cls of [".roster-ability-icons",".hero-ability-thumb",".npc-ability-row"])
  assert.ok(css.includes(cls),cls);
 assert.ok(html.includes('id="buildVersion">Прототип · v'+version+' · '));
});

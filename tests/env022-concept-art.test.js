// ENV022 temporary concept-art backdrop contract tests. No browser/WebGL pass claimed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("bundled placeholder decodes to compact actual WebP, not an external URL",()=>{
  const svg=fs.readFileSync("assets/env022-canyon-concept.svg","utf8");
  const match=svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(match,"Self-contained image is required for offline battle");
  const webp=Buffer.from(match[1],"base64");
  assert.ok(webp.length>4000&&webp.length<20000);
  assert.equal(webp.toString("ascii",0,4),"RIFF");
  assert.equal(webp.toString("ascii",8,12),"WEBP");
  assert.match(svg,/viewBox="0 0 480 222"/);
});

test("ENV022 is the default; explicit legacy scene overrides are kept",()=>{
  const game=fs.readFileSync("game.js","utf8");
  const styles=fs.readFileSync("styles.css","utf8");
  assert.ok(game.includes("environment=(?:env017|env010)"));
  assert.match(game,/alpha:ENV022_CONCEPT_PREVIEW/);
  assert.match(game,/ENV022_CONCEPT_PREVIEW\?0:1/);
  assert.match(game,/CombatVisual007\.create\(BABYLON,scene,\{conceptBackdrop:ENV022_CONCEPT_PREVIEW\}\)/);
  assert.match(game,/!combatVisual007 && !ENV022_CONCEPT_PREVIEW/);
  assert.match(styles,/\.env022-concept-preview \.arena-wrap/);
  assert.match(styles,/assets\/env022-canyon-concept\.svg/);
  assert.match(game,/radius:12,targetY:\.9/);
});

test("concept mode keeps live fighter hit effect pool while skipping all old scenery",()=>{
  const source=fs.readFileSync("combat-visual-007.js","utf8");
  const context={};
  vm.runInNewContext(source+"\nthis.CV=CombatVisual007;",context);
  const spawned=[];
  function mesh(name){return {name,position:{x:0,y:0,z:0},scaling:{x:1,y:1,z:1},rotation:{x:0},setEnabled(v){this.enabled=v;},dispose(){}};}
  const builders={};
  for(const name of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
    builders[name]=(...args)=>{if(["CreateGround","CreateBox","CreateCylinder"].includes(name))throw Error("scenery created: "+name);const m=mesh(args[0]);spawned.push(m);return m;};
  const B={
    MeshBuilder:builders,
    StandardMaterial:class {constructor(name){this.name=name;}dispose(){}},
    Color3:class {constructor(r,g,b){Object.assign(this,{r,g,b});}},
    Vector3:class {constructor(x,y,z){Object.assign(this,{x,y,z});}}
  };
  const cv=context.CV.create(B,{}, {conceptBackdrop:true});
  assert.equal(spawned.length,6,"Three hit rings and three glow meshes should remain");
  assert.ok(spawned.every(m=>/cv007_hit_/.test(m.name)));
  assert.equal(cv.pending(),0);
  cv.emit([{slot:"hit",id:"hero"}],{hero:{head:{position:{x:1,y:2,z:3}}}});
  assert.equal(cv.pending(),1);
  cv.tick(100,1);
  cv.tick(100,1);
  assert.equal(cv.pending(),0);
});

test("public build label matches package version and unique ENV022 code",()=>{
  const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
  const html=fs.readFileSync("index.html","utf8");
  assert.equal(pkg.version,"0.3.105");
  assert.match(html,/id="buildVersion"[^>]*>[^<]*v0\.3\.105 · UIHUD001[^<]*ENV022-DEFAULT/);
});

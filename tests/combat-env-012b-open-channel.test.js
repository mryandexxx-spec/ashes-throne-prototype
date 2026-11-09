'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../combat-environment-012.js');
const A=require('../tools/env-composition-audit.cjs');
const root=path.join(__dirname,'..');
test('ENV012 original valley is finite, budgeted and non-interactive',()=>{
 const g=E.geometry();
 assert.deepEqual(g.map(m=>m.name),['gorge_floor','west_terraces','east_terraces']);
 assert.equal(g.reduce((n,m)=>n+m.indices.length/3,0),7776);
 for(const m of g){
  assert.ok(m.positions.every(Number.isFinite));
  assert.ok(m.colors.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert.equal(m.positions.length/3,m.colors.length/4);
  assert.ok(m.indices.every(i=>i>=0&&i<m.positions.length/3));
 }
 const code=fs.readFileSync(path.join(root,'combat-environment-012.js'),'utf8');
 assert.match(code,/isPickable=false/);
 assert.doesNotMatch(code,/runRenderLoop|setInterval|CombatCore|game\.js/);
});
test('ENV012 floor and banks share exact 3D boundary coordinates at every slice',()=>{
 const [floor,west,east]=E.geometry();
 const point=(mesh,row,col)=>mesh.positions.slice((row*19+col)*3,(row*19+col)*3+3);
 for(let i=0;i<=72;i++){
  assert.deepEqual(point(floor,i,0),point(west,i,0));
  assert.deepEqual(point(floor,i,18),point(east,i,0));
 }
});
test('ENV012 candidate exposes valley floor at both camera radii; audit remains advisory',()=>{
 const meshes=[A.ledge(),A.ravine(),...E.geometry()];
 const near=A.audit(meshes,12),far=A.audit(meshes,19);
 assert.ok(near.coverage_percent.gorge_floor>=5,
  'default framing must expose >=5% geometric floor');
 assert.ok(far.coverage_percent.gorge_floor>=5,
  'far framing must expose >=5% geometric floor');
 assert.ok(near.coverage_percent.living_ledge>40,
  'combat platform must remain large enough for active actors');
});
test('ENV012 is optional; ENV010 loader, photoskin and fixed camera survive',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const env010=fs.readFileSync(path.join(root,'combat-environment-010.js'),'utf8');
 const visual=fs.readFileSync(path.join(root,'combat-visual-007.js'),'utf8');
 assert.ok(html.indexOf('src="combat-environment-012.js"')<html.indexOf('src="combat-environment-010.js"'));
 assert.match(html,/v0\.3\.84.*ENV012/);
 assert.match(env010,/if\(!env012Ready\)loadSculptedRock\(\)/);
 assert.match(env010,/loadLocalRock\(\)/);
 assert.match(visual,/CombatEnvironment010\.build/);
});

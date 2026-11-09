'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {readGlb,ledge,ravine,audit}=require('../tools/env-composition-audit.cjs');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'assets/env010/gorge-strata-v1.glb');

test('ENV012 audit reads the actual ENV010 GLB and projects the unchanged ledge',()=>{
 const meshes=readGlb(source);
 assert.deepEqual(meshes.map(m=>m.name),[
  'front_buttress','middle_terraces','gorge_floor','pale_horizon']);
 assert.equal(meshes.reduce((n,m)=>n+m.indices.length/3,0),13404);
 assert.ok(ledge().positions.length>1000);
 assert.ok(ravine().positions.length>1000);
 for(const m of meshes)assert.ok(m.positions.every(Number.isFinite));
});

test('ENV012 audit measures separately the original and distant framing',()=>{
 const meshes=[ledge(),ravine(),...readGlb(source)];
 const near=audit(meshes,12),far=audit(meshes,19);
 for(const view of [near,far]){
  const pct=view.coverage_percent;
  const total=Object.values(pct).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(total-100)<.1,`coverage does not add up: ${total}`);
  assert.ok(pct.living_ledge>10);
  assert.ok(pct.front_buttress>0&&pct.middle_terraces>0);
  assert.ok(pct.gorge_floor>=0);
 }
 assert.ok(near.coverage_percent.living_ledge>far.coverage_percent.living_ledge);
});

test('ENV012 z-buffer handles occlusion rather than merely counting projected vertices',()=>{
 const alpha=-3*Math.PI/4,beta=.96,r=12;
 const e=[r*Math.sin(beta)*Math.cos(alpha),.9+r*Math.cos(beta),r*Math.sin(beta)*Math.sin(alpha)];
 const f=[-e[0],.9-e[1],-e[2]],len=Math.hypot(...f),forward=f.map(v=>v/len);
 const right=[-forward[2],0,forward[0]]; // cross(forward, up)
 const up=[-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]];
 const quad=(name,depth,scale)=>{
  const pts=[];
  for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])for(let k=0;k<3;k++)
   pts.push(e[k]+forward[k]*depth+right[k]*x*scale+up[k]*y*scale);
  return {name,positions:pts,indices:[0,1,2,0,2,3]};
 };
 const floor=quad('gorge_floor',19,2.0),wall=quad('front_buttress',7,1.2);
 const visible=audit([floor],12).coverage_percent.gorge_floor;
 const covered=audit([floor,wall],12).coverage_percent.gorge_floor;
 assert.ok(visible>0);
 assert.ok(covered<visible,`wall should occlude floor: ${covered} >= ${visible}`);
});

test('ENV012 optional quality gate FAILS the baseline without breaking ordinary CI',()=>{
 const entry=path.join(root,'tools/env-composition-audit.cjs');
 const report=spawnSync(process.execPath,[entry],{encoding:'utf8'});
 assert.equal(report.status,0,report.stderr);
 const baseline=JSON.parse(report.stdout);
 assert.equal(baseline.status,'GEOMETRY_OCCLUDED');
 assert.ok(baseline.report.every(v=>v.coverage_percent.gorge_floor<5));
 const enforce=spawnSync(process.execPath,[entry,'--enforce'],{encoding:'utf8'});
 assert.equal(enforce.status,2,enforce.stderr);
});
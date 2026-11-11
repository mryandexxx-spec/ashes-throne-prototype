"use strict";
const fs=require("node:fs");
const file="assets/ren-wanderer-v1.glb";
const buf=fs.readFileSync(file);
if(buf.toString("ascii",0,4)!=="glTF")throw Error("Invalid GLB");
const gltf=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString("utf8"));
const parents={};
for(let i=0;i<gltf.nodes.length;i++)for(const child of gltf.nodes[i].children||[])parents[child]=i;
const joints=new Set((gltf.skins||[]).flatMap(s=>s.joints));
const nodes=gltf.nodes.map((n,id)=>({id,name:n.name,parent:gltf.nodes[parents[id]]?.name||null,
 t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1]})).filter(n=>joints.has(n.id)||n.name==="wanderer_Rig");
console.log("REN-RIG-AUDIT-014 "+JSON.stringify({nodes,skins:(gltf.skins||[]).map(s=>({joints:s.joints.map(i=>gltf.nodes[i].name),root:gltf.nodes[s.skeleton]?.name})),animations:(gltf.animations||[]).map(a=>a.name)}));

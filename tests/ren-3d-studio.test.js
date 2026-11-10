"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Model=require("../ren-3d-studio.js");
class Vector3 {
 constructor(x,y,z){this.x=x;this.y=y;this.z=z;}
 subtract(v){return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z);}
 add(v){return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z);}
 scale(k){return new Vector3(this.x*k,this.y*k,this.z*k);}
 length(){return Math.hypot(this.x,this.y,this.z);}
 normalize(){const l=this.length();return this.scale(1/l);}
 static Dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
 static Cross(a,b){return new Vector3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
}
const calls=[];
class Mesh{
 constructor(name){this.name=name;this.position=null;this.rotation={};this.scaling=null;this.parent=null;}
}
Mesh.CAP_ALL=3;
const B={
 Vector3,Axis:{Y:new Vector3(0,1,0),X:new Vector3(1,0,0)},
 Quaternion:{Identity:()=>({identity:true}),RotationAxis:(a,angle)=>({axis:a,angle})},
 Color3:class{constructor(r,g,b){this.r=r;this.g=g;this.b=b;}static FromHexString(s){return s;}},
 StandardMaterial:class{constructor(name){this.name=name;}},
 TransformNode:class{constructor(name){this.name=name;}},
 Mesh,MeshBuilder:{}
};
for(const name of ["CreateSphere","CreateBox","CreateCylinder","CreateTube"])
 B.MeshBuilder[name]=(label,opt)=>{calls.push({name,label,opt});return new Mesh(label)};
const scene={};
const root=Model.create(B,scene);
assert.equal(root.name,"Ren_Teren_CONCEPT_001");
assert.ok(calls.length>80,"Expected detailed 3D construction");
assert.ok(calls.some(x=>x.label.startsWith("hair_lock")));
assert.ok(calls.some(x=>x.label.startsWith("rope_loop")));
assert.ok(calls.some(x=>x.label.startsWith("scarf")));
const html=fs.readFileSync(path.join(__dirname,"../ren-3d-studio.html"),"utf8");
assert.match(html,/ren-3d-studio\.js/);
assert.match(html,/GLBAsync/);
assert.match(html,/Сохранить модель GLB/);
console.log("Ren 3D studio: model construction and export UI static checks OK; WebGL/browser export NOT tested");

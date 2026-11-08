/* REN-VISUAL-003: lightweight, presentation-only Babylon.js Ren Teren model.
 * The approved A+B portrait informs its dark hair, worn olive layers, rust scarf,
 * crossed harness and rope. No weapon, faction mark or gameplay data is implied.
 * Instantiated once per arena Scene; Babylon Scene.dispose owns all meshes/materials.
 */
const RenVisualModel=(()=>{
 "use strict";
 function create(B,scene,x,z,index){
  if(!B?.Mesh||!B.MeshBuilder||!B.StandardMaterial||!B.Vector3||!B.Color3||!scene)
   throw Error("REN-VISUAL-003 needs Babylon.js and an active scene");
  const prefix="ren_"+index+"_";
  const mats={};
  function mat(id,r,g,b){
   const m=new B.StandardMaterial(prefix+"mat_"+id,scene);
   m.diffuseColor=new B.Color3(r,g,b);
   m.specularColor=new B.Color3(.045,.045,.045);
   mats[id]=m;
   return m;
  }
  const coat=mat("coat",.24,.27,.22),linen=mat("linen",.59,.54,.43),
   rust=mat("scarf",.45,.23,.17),leather=mat("leather",.24,.16,.11),
   trousers=mat("trousers",.23,.22,.21),dark=mat("dark",.12,.11,.10),
   skin=mat("skin",.56,.39,.30),rope=mat("rope",.59,.49,.32),
   iron=mat("iron",.37,.39,.39);
  const body=new B.Mesh(prefix+"body_anchor",scene);
  const head=new B.Mesh(prefix+"head_anchor",scene);
  body.position=new B.Vector3(x,.8,z);
  head.position=new B.Vector3(x,1.8,z);
  const parts=[];
  function part(parent,shape,name,options,m,px,py,pz,rx=0,ry=0,rz=0){
   const builder=B.MeshBuilder[shape];
   if(typeof builder!=="function")throw Error("Missing Babylon builder "+shape);
   const mesh=builder(prefix+name,options,scene);
   mesh.parent=parent;
   mesh.position=new B.Vector3(px,py,pz);
   mesh.rotation=new B.Vector3(rx,ry,rz);
   mesh.material=m;
   // The current picker climbs parent nodes to the metadata-bearing anchor.
   mesh.isPickable=true;
   parts.push(mesh);
   return mesh;
  }
  const box=(p,n,w,h,d,m,x,y,z,rz=0,ry=0)=>part(p,"CreateBox",n,{width:w,height:h,depth:d},m,x,y,z,0,ry,rz);
  const cyl=(p,n,top,bottom,h,m,x,y,z,rz=0)=>part(p,"CreateCylinder",n,{height:h,diameterTop:top,diameterBottom:bottom,tessellation:8},m,x,y,z,0,0,rz);
  const ball=(p,n,d,m,x,y,z)=>part(p,"CreateSphere",n,{diameter:d,segments:8},m,x,y,z);
  const ring=(p,n,d,t,m,x,y,z,rx=0,rz=0)=>part(p,"CreateTorus",n,{diameter:d,thickness:t,tessellation:12},m,x,y,z,rx,0,rz);
  // Core: narrow cliff-guide silhouette, not the shared broad combat capsule.
  cyl(body,"jacket",.60,.45,.73,coat,0,.31,0);
  box(body,"shirt_front",.29,.43,.045,linen,0,.35,-.283);
  box(body,"lapel_left",.12,.48,.085,coat,-.205,.43,-.305,-.16);
  box(body,"lapel_right",.12,.48,.085,coat,.205,.43,-.305,.16);
  cyl(body,"hips",.43,.45,.25,trousers,0,-.18,0);
  for(const side of [-1,1]){
   const code=side<0?"L":"R";
   cyl(body,"thigh_"+code,.22,.18,.48,trousers,side*.17,-.39,0,side*-.04);
   cyl(body,"shin_"+code,.18,.13,.31,trousers,side*.17,-.61,0);
   box(body,"boot_"+code,.23,.24,.39,dark,side*.17,-.68,-.06);
   cyl(body,"sleeve_"+code,.21,.18,.43,coat,side*.39,.41,0,side*-.21);
   cyl(body,"glove_"+code,.17,.14,.30,dark,side*.44,.06,-.025,side*-.15);
   ball(body,"hand_"+code,.14,skin,side*.46,-.12,-.03);
  }
  // Distinctive, practical outfit details. No armoured plates or insignia.
  box(body,"harness_left",.072,.80,.055,leather,-.12,.39,-.341,-.35);
  box(body,"harness_right",.072,.72,.055,leather,.13,.39,-.346,.37);
  ring(body,"belt",.47,.085,leather,0,-.08,0);
  box(body,"buckle",.14,.11,.065,iron,.02,-.08,-.246);
  box(body,"side_pouch",.22,.28,.16,leather,.36,-.18,-.02);
  box(body,"patch",.12,.19,.029,linen,-.21,.22,-.312,.13);
  // Short coils are stationary pieces of travel gear, never a combat weapon.
  ring(body,"rope_loop_one",.32,.048,rope,.37,.43,-.07,Math.PI/2.4);
  ring(body,"rope_loop_two",.29,.047,rope,.39,.37,-.07,Math.PI/2.4);
  ring(body,"neck_wrap",.49,.19,rust,0,.72,0);
  box(body,"scarf_tail",.23,.56,.075,rust,-.18,.38,-.37,.14);
  box(body,"scarf_knot",.24,.18,.13,rust,-.06,.72,-.29);
  // Head group follows the existing per-fighter hit/lunge/death pose independently.
  ball(head,"face",.49,skin,0,0,-.005);
  ball(head,"hair_cap",.53,dark,0,.16,.07);
  ball(head,"hair_left",.25,dark,-.19,.15,-.09);
  ball(head,"hair_right",.24,dark,.18,.20,-.06);
  box(head,"hair_lock",.09,.24,.11,dark,-.12,.15,-.24,.24);
  box(head,"nose",.075,.09,.10,skin,0,-.045,-.26);
  box(head,"stubble",.23,.09,.045,dark,0,-.18,-.205);
  body.metadata={fighterId:"ren"};
  head.metadata={fighterId:"ren"};
  return {body,head,parts,materials:mats};
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=RenVisualModel;

/* REN-3D-STUDIO-001 — independent experimental 3D maquette; NOT approved character art.
   Browser Babylon.js viewer, independent of combat and saves. Z negative is front. */
(function (global) {
 "use strict";
 function create(B, scene) {
  const root = new B.TransformNode("Ren_Teren_CONCEPT_001", scene);
  const palette = {
   skin:"#a17a60", lightSkin:"#bd9072", hair:"#2e2724", hairLight:"#49382f",
   coat:"#46443c", coatLight:"#595247", linen:"#a39a82",
   scarf:"#82483a", scarfLight:"#a15c47", belt:"#654332", beltLight:"#956b4c",
   pants:"#48443f", boots:"#392e28", rope:"#b9a078", metal:"#a69d87", eyes:"#231e1c"
  };
  const materials={};
  function material(key){
   if(!materials[key]){
    const m=new B.StandardMaterial("ren_"+key,scene);
    m.diffuseColor=B.Color3.FromHexString(palette[key]);
    m.specularColor=new B.Color3(.055,.05,.045);
    materials[key]=m;
   }
   return materials[key];
  }
  let id=0;
  function attach(mesh,key){
   mesh.parent=root;mesh.material=material(key);
   mesh.isPickable=true;
   return mesh;
  }
  function ell(name, pos, scale, key, seg=16){
   const m=attach(B.MeshBuilder.CreateSphere(name+"_"+id++,{diameter:1,segments:seg},scene),key);
   m.position=new B.Vector3(...pos);m.scaling=new B.Vector3(scale[0]*2,scale[2]*2,scale[1]*2);
   return m;
  }
  function box(name,pos,size,key,rz=0,ry=0){
   const m=attach(B.MeshBuilder.CreateBox(name+"_"+id++,{width:size[0],height:size[2],depth:size[1]},scene),key);
   m.position=new B.Vector3(pos[0],pos[2],pos[1]);m.rotation.z=rz;m.rotation.y=ry;
   return m;
  }
  function segment(name,a,b,r1,r2,key,edges=12){
   const start=new B.Vector3(a[0],a[2],a[1]),end=new B.Vector3(b[0],b[2],b[1]);
   const delta=end.subtract(start);
   const m=attach(B.MeshBuilder.CreateCylinder(name+"_"+id++,{
    height:delta.length(),diameterTop:2*r2,diameterBottom:2*r1,tessellation:edges
   },scene),key);
   m.position=start.add(end).scale(.5);
   m.rotationQuaternion=B.Quaternion.FromUnitVectors
    ? B.Quaternion.FromUnitVectors(B.Axis.Y,delta.normalize())
    : B.Quaternion.RotationAxis(B.Vector3.Cross(B.Axis.Y,delta.normalize()).normalize(),Math.acos(B.Vector3.Dot(B.Axis.Y,delta.normalize())));
   return m;
  }
  function tube(name,pts,r,key){
   const points=pts.map(p=>new B.Vector3(p[0],p[2],p[1]));
   return attach(B.MeshBuilder.CreateTube(name+"_"+id++,{path:points,radius:r,tessellation:7,cap:B.Mesh.CAP_ALL},scene),key);
  }
  // Boots, practical fabric legs and climbing straps.
  for(const s of [-1,1]){
   const side=s<0?"left":"right",x=.16*s;
   segment(side+"_shin",[x,0,.32],[x,0,.85],.125,.145,"pants");
   segment(side+"_thigh",[x,0,.86],[.135*s,0,1.12],.15,.165,"pants");
   ell(side+"_boot",[x,-.055,.17],[.14,.215,.17],"boots");
   box(side+"_sole",[x,-.13,.095],[.275,.35,.105],"boots");
   segment(side+"_boot_top",[x,0,.16],[x,0,.42],.14,.12,"boots");
   for(const h of [.24,.29,.34])tube(side+"_laces_"+h,[[x-.06,-.14,h],[x+.06,-.14,h+.018]],.008,"beltLight");
   segment(side+"_knee_strap",[x,0,.61],[x,0,.65],.15,.15,"belt");
   box(side+"_knee_patch",[x,-.145,.645],[.17,.03,.13],"coatLight");
   box(side+"_tunic_tail",[.17*s,0,.92],[.28,.13,.45],"coat",s*.12);
  }
  ell("pelvis",[0,0,1.09],[.33,.205,.22],"coat");
  ell("torso",[0,0,1.4],[.38,.235,.43],"coat");
  ell("linen_front",[0,-.188,1.43],[.27,.105,.32],"linen");
  segment("lapel_left",[-.16,-.25,1.7],[-.04,-.26,1.25],.05,.035,"coatLight");
  segment("lapel_right",[.16,-.25,1.7],[.04,-.26,1.25],.05,.035,"coatLight");
  segment("neck",[0,0,1.68],[0,0,1.84],.11,.09,"skin");
  for(const s of [-1,1]){
   const side=s<0?"left":"right";
   ell(side+"_shoulder",[.40*s,0,1.65],[.20,.21,.20],"coat");
   segment(side+"_arm",[.43*s,0,1.61],[.51*s,-.03,1.32],.18,.145,"coat");
   ell(side+"_elbow",[.51*s,-.03,1.31],[.14,.14,.15],"coatLight");
   segment(side+"_forearm",[.51*s,-.03,1.30],[.49*s,-.12,1.01],.14,.108,"coat");
   segment(side+"_wrist_wrap",[.49*s,-.12,1.12],[.49*s,-.12,1.02],.12,.113,"belt");
   ell(side+"_hand",[.49*s,-.12,.935],[.104,.095,.125],"skin");
   for(let j=0;j<4;j++){
    const px=s*(.432+j*.038);
    segment(side+"_finger"+j,[px,-.176,.92],[px,-.172,.85],.017,.012,"skin",7);
   }
  }
  // Facial identity follows the existing in-game portrait, not a new canonical biography.
  ell("face",[0,-.01,1.93],[.175,.158,.224],"skin",24);
  ell("jaw",[0,-.143,1.867],[.125,.048,.065],"skin");
  ell("nose",[0,-.169,1.936],[.043,.042,.070],"lightSkin");
  ell("unshaven_chin",[0,-.157,1.835],[.11,.018,.036],"hairLight");
  for(const s of [-1,1]){
   ell("eye"+s,[s*.078,-.159,1.970],[.025,.011,.012],"eyes");
   tube("brow"+s,[[s*.042,-.169,2.01],[s*.10,-.148,2.009]],.011,"hair");
   ell("ear"+s,[s*.174,0,1.93],[.035,.046,.068],"skin");
  }
  ell("hair_cap",[0,.014,2.082],[.193,.174,.12],"hair");
  for(let j=0;j<19;j++){
   const t=2*Math.PI*j/19,x=.17*Math.cos(t),z=.14*Math.sin(t),h=2.085+.024*Math.sin(2.1*j);
   tube("hair_lock"+j,[[x,z,h],[x*1.10,z,2.04],[x*1.17+.03*Math.sin(j),z-.015,1.94-(j%4===0?.10:0)]],
     j%3===0?.028:.022,j%3===0?"hairLight":"hair");
  }
  // Weathered rust scarf and travel gear: no invented sword, armour or faction symbol.
  ell("scarf_wrap",[0,-.04,1.759],[.35,.25,.12],"scarf");
  for(let i=0;i<3;i++)tube("scarf_fold"+i,
   [[-.29,-.18,1.79-i*.024],[0,-.28,1.77-i*.023],[.27,-.18,1.78-i*.02]],
   .039,i===1?"scarfLight":"scarf");
  ell("scarf_shoulder",[.37,.02,1.65],[.20,.21,.12],"scarf");
  box("scarf_tail",[.43,.105,1.49],[.30,.105,.37],"scarf",-.25);
  tube("diagonal_harness",[[-.29,-.20,1.67],[-.13,-.26,1.52],[.06,-.27,1.30],[.20,-.20,1.15]],.032,"belt");
  box("strap_buckle",[-.10,-.271,1.51],[.095,.025,.095],"metal",-.5);
  segment("waist_belt",[-.31,-.02,1.19],[.31,-.02,1.19],.052,.052,"belt");
  box("belt_buckle",[0,-.27,1.19],[.10,.05,.085],"metal");
  box("buckle_center",[0,-.304,1.19],[.054,.018,.045],"belt");
  ell("satchel",[-.335,-.15,1.08],[.19,.115,.19],"belt");
  box("satchel_flap",[-.335,-.28,1.12],[.30,.05,.12],"beltLight");
  box("satchel_latch",[-.335,-.31,1.08],[.05,.017,.052],"metal");
  for(let j=0;j<2;j++){
   const pts=[];for(let k=0;k<=32;k++){
    const t=2*Math.PI*k/32;
    pts.push([.31+j*.04+.055*Math.sin(t),-.245-.024*j,1.49+.20*Math.cos(t)]);
   }
   tube("rope_loop"+j,pts,.016,"rope");
  }
  tube("rope_tail",[[.32,-.20,1.64],[.40,-.18,1.43],[.38,-.16,1.29]],.017,"rope");
  return root;
 }
 global.Ren3DStudio=Object.freeze({create});
 if(typeof module!=="undefined")module.exports=global.Ren3DStudio;
})(typeof window!=="undefined"?window:globalThis);

// Authored terrain cross-sections, in metres. Not final chapter geography.
// x, southern edge, southern inner edge, northern inner edge, northern edge
export const sections=[
[-9,-3.3,-1.7,1.4,3.8],[-8,-4.8,-1.9,1.8,5.2],
[-6,-5.7,-2.0,2.0,6.1],[-4,-6.8,-2.15,2.1,6.2],
[-2.8,-6.6,-1.65,1.65,6.7],[-2,-6.2,-2.25,2.4,6.6],
[0,-6.9,-2.6,2.35,6.25],[2,-6.4,-2.15,2.6,6.8],
[2.8,-6.7,-1.7,1.7,6.4],[4,-6.3,-2.0,2.1,5.8],
[6,-5.7,-1.85,1.75,5.0],[8,-4.7,-1.5,1.4,4.0],
[10,-3.6,-1.15,1.2,3.5],[12,-3.2,-1.1,1.1,3.8],
[15,-3.9,-1.3,1.2,4.2],[17,-3.4,-1.2,1.3,3.5],
[19,-2.5,-1.0,1.0,3.1]];
export const height=x=>x<=8?0:x<12?(x-8)/2:2;
export const positions=[],indices=[];
export const outer=sections.map(s=>[s[0],s[1]]).concat([...sections].reverse().map(s=>[s[0],s[4]]));
export const exclusion=sections.filter(s=>s[0]>=-2.8&&s[0]<=2.8).map(s=>[s[0],s[2]]).concat(sections.filter(s=>s[0]>=-2.8&&s[0]<=2.8).reverse().map(s=>[s[0],s[3]]));
for(let a=0;a<sections.length-1;a++){
 const l=sections[a],r=sections[a+1];
 for(let j=1;j<=3;j++){
  if(j===2&&l[0]>=-2.8&&r[0]<=2.8)continue;
  const i=positions.length/3;
  positions.push(l[0],height(l[0]),l[j],l[0],height(l[0]),l[j+1],r[0],height(r[0]),r[j+1],r[0],height(r[0]),r[j]);
  indices.push(i,i+1,i+2,i,i+2,i+3);
 }
}
// Independent cross-section interpolation oracle, not the generated triangles.
export function authoredFloor(x,z){
 if(x<sections[0][0]||x>sections.at(-1)[0])return false;
 const a=sections.findIndex((s,i)=>i<sections.length-1&&x>=s[0]&&x<=sections[i+1][0]);
 if(a<0)return false;const l=sections[a],r=sections[a+1],t=(x-l[0])/(r[0]-l[0]);
 const at=j=>l[j]+t*(r[j]-l[j]);
 if(z<at(1)||z>at(4))return false;
 return !(x>-2.8&&x<2.8&&z>at(2)&&z<at(3));
}

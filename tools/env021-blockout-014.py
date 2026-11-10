"""ENV021 Blockout 014: two distinct authored massing hypotheses.
No scan fusion, texture production or game integration. Six standing zones
remain at s=+-2.45, a=-1.9,0,1.9; camera/gameplay are unchanged.
Option A = cliff-backed lateral shelf; option B = diagonal promontory.
"""
import math
import importlib.util
from pathlib import Path

spec=importlib.util.spec_from_file_location("env021_core010",Path(__file__).with_name("env021-art-pass-010.py"))
core=importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
pos=core.pos
smooth01=core.smooth01

# These are artist-drawn stations in scene authoring coordinates, not
# frequency noise. Stations determine *plan* silhouettes and tectonic steps.
A_NEAR=[
 (-16,-7.7,5.8),(-12,-9.4,4.2),(-9,-8.8,5.7),
 (-6,-8.4,4.9),(-3.2,-7.0,4.4),(0,-6.8,4.3),
 (3.0,-6.5,4.6),(5.4,-7.7,5.2),(8.0,-9.0,4.2),
 (10.8,-8.4,6.9),(14.0,-6.3,7.0),(17.0,-5.2,5.0)]
B_NEAR=[
 (-13,-5.3,9.8),(-10,-6.1,8.5),(-7,-5.4,7.1),
 (-4,-5.9,5.3),(-2.5,-5.8,4.3),(0,-5.6,4.0),
 (2.7,-5.6,4.3),(4.0,-7.7,5.2),(7.4,-10.1,6.1),
 (10.7,-10.9,6.5),(14.2,-8.3,6.3),(17,-6.0,4.8)]
# In both variants the safe battle support column [-3,3] lies within
# the near-surface bulk, not on detachable pieces.

def lerp_table(a,stations,column):
    if a<=stations[0][0]:return stations[0][column]
    if a>=stations[-1][0]:return stations[-1][column]
    for l,r in zip(stations,stations[1:]):
        if l[0]<=a<=r[0]:
            t=(a-l[0])/(r[0]-l[0])
            return l[column]*(1-t)+r[column]*t
    raise ValueError("station interpolation failed")

def outline(a,option):
    stations=A_NEAR if option=="A" else B_NEAR
    return lerp_table(a,stations,1),lerp_table(a,stations,2)

def height(s,a,option):
    # The entire zone -3.05<=s<=3.05 and -2.65<=a<=2.65
    # stays horizontal at z=-0.04 (not just six exact points).
    land=smooth01((-s-3.08)/2.8)
    rim=smooth01((s-3.06)/2.2)
    end=smooth01((abs(a)-2.9)/5.4)
    if option=="A":
        # Broad landward rock mass climbs and then breaks onto two benches.
        highland=2.1*land+1.05*land*end
        exposed=-.9*rim-.75*rim*end
        runoff=-1.4*end*smooth01((s-2.9)/3.9)
        return -.04+highland+exposed+runoff
    # Diagonal promontory: the safe patch sits near one shoulder.
    # At distal positive a, whole rock nose steps downward; the farther
    # opposite end rises as a resistant block above the canyon.
    distal=smooth01((a-3.2)/6.0)
    back=smooth01((-a-4.5)/6.0)
    shoulder=-2.45*distal*max(land,rim,.54*end)
    wall=2.65*land*back-.55*rim*back
    return -.04+shoulder+wall-1.05*rim*(1-.22*back)

def mesh(name,verts,faces):
    return core.mesh(name,verts,faces)

def near_mass(option):
    stations=A_NEAR if option=="A" else B_NEAR
    na,ns,nv=91,45,30
    a0,a1=stations[0][0],stations[-1][0]
    aa=[a0+(a1-a0)*j/(na-1) for j in range(na)]
    vv=[];ff=[]
    def v(s,a,z):
        vv.append(pos(s,a,z));return len(vv)-1
    def q(a,b,c,d):
        ff.extend(((a,b,c),(a,c,d)))
    grid=[];rim=[];back=[];bottom=[]
    for a in aa:
        left,right=outline(a,option)
        line=[]
        for k in range(ns):
            s=left+(right-left)*k/(ns-1)
            line.append(v(s,a,height(s,a,option)))
        grid.append(line)
        # Two visible scarp faces drop sharply below the sculpted ledge.
        # The mid-height fractured bench widens 1.5-3 units in plan, so
        # angled rock faces remain visible even from elevated mobile camera.
        banks=[]
        for side,edge,level in (("rear",left,height(left,a,option)),("front",right,height(right,a,option))):
            row=[line[0] if side=="rear" else line[-1]]
            for k in range(1,nv+1):
                t=k/nv
                down=28*t
                step= (1.9*smooth01((down-4.3)/3.5)
                      -.65*smooth01((down-11.7)/1.7)
                      +2.5*smooth01((down-17.3)/3.1))
                # Different geology on two options, preserving *continuous*
                # silhouette rather than inserting disconnected boulders.
                shift= (-1 if side=="rear" else 1)
                offset=(.38+2.9*t+step)*shift
                row.append(v(edge+offset,a,level-down))
            banks.append(row)
        back.append(banks[0]);rim.append(banks[1])
        under=[]
        for k in range(ns):
            u=k/(ns-1)
            s=back[-1] # only use its location through directly computed outline
            s_pos=left-5.3+(right-left+11.3)*u
            under.append(v(s_pos,a,min(height(left,a,option),height(right,a,option))-28))
        bottom.append(under)
    for j in range(na-1):
        for k in range(ns-1):
            q(grid[j][k],grid[j][k+1],grid[j+1][k+1],grid[j+1][k])
            q(bottom[j+1][k],bottom[j+1][k+1],bottom[j][k+1],bottom[j][k])
        for bank in (back,rim):
            for k in range(nv):
                q(bank[j][k],bank[j+1][k],bank[j+1][k+1],bank[j][k+1])
        q(back[j][-1],bottom[j][0],bottom[j+1][0],back[j+1][-1])
        q(rim[j][-1],rim[j+1][-1],bottom[j+1][-1],bottom[j][-1])
    for k in range(ns-1):
        q(grid[0][k+1],grid[0][k],bottom[0][k],bottom[0][k+1])
        q(grid[-1][k],grid[-1][k+1],bottom[-1][k+1],bottom[-1][k])
    return mesh("ENV021_Blockout14"+option+"_landward_mass",vv,ff)

A_FAR=[(-27,19,-9.0),(-16,20,-6.3),(-8,21,-8.0),
       (-3,24,-13),(2,25,-14.0),(10,23,-10.0),(19,22,-8.2),(29,25,-7.1)]
B_FAR=[(-27,34,-12),(-17,28,-9),(-8,22,-3.8),
       (0,20,-4.5),(7,25,-6.0),(16,34,-11),(28,39,-14)]
def far_mass(option):
    stations=A_FAR if option=="A" else B_FAR
    na,nv,nb=105,48,26
    aa=[stations[0][0]+(stations[-1][0]-stations[0][0])*j/(na-1) for j in range(na)]
    vv=[];ff=[]
    def v(s,a,z):
        vv.append(pos(s,a,z));return len(vv)-1
    def q(a,b,c,d):
        ff.extend(((a,b,c),(a,c,d)))
    walls=[];rears=[]
    for a in aa:
        front=lerp_table(a,stations,1)
        crest=lerp_table(a,stations,2)
        row=[]
        for k in range(nv):
            t=k/(nv-1)
            down=36*t
            # Four handcrafted stratigraphic benches. Faces are sloped,
            # not all repeated per-column smooth walls.
            ledge=(1.4*smooth01((down-3.1)/3.8)
                   -.8*smooth01((down-10.0)/2.0)
                   +2.8*smooth01((down-15.3)/3.9)
                   -1.0*smooth01((down-26.0)/2.6))
            row.append(v(front+2.0*t+ledge,a,crest-down))
        walls.append(row)
        back=[]
        for k in range(nb):
            u=k/(nb-1)
            back.append(v(front+16*u,a,crest-1.8*u-6.7*u*u))
        rears.append(back)
    for j in range(na-1):
        for k in range(nv-1):
            q(walls[j][k],walls[j+1][k],walls[j+1][k+1],walls[j][k+1])
        for k in range(nb-1):
            q(rears[j][k],rears[j][k+1],rears[j+1][k+1],rears[j+1][k])
    return mesh("ENV021_Blockout14"+option+"_opposing_mass",vv,ff)

def build(option,scan_path):
    # CC0 scan is intentionally NOT imported in this blockout: form first.
    # Keep original manifest provenance explicit rather than pretending fusion.
    import bpy
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for a in (-1.9,0,1.9):
        left,right=outline(a,option)
        assert left<-3.15 and right>3.15
        for s in (-2.45,2.45):
            assert abs(height(s,a,option)+.04)<1e-10
    near=near_mass(option)
    far=far_mass(option)
    core.material(near,"ENV021_BLOCKOUT_NEAR_14"+option,(.49,.48,.46,1))
    core.material(far,"ENV021_BLOCKOUT_FAR_14"+option,(.44,.48,.50,1))
    core.markers()
    return {
      "stage":"BLOCKOUT_014"+option+"_UNREVIEWED",
      "source":"hand-placed silhouette station control points in Blender scene axes",
      "form":"cliff-backed shelf" if option=="A" else "diagonal promontory",
      "note":"No CC0 scan used; original scan argument ignored intentionally; not a production asset."
    }

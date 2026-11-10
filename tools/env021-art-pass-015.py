"""ENV021 Art Pass015: near-shelf relief + layered escarpment, with Blockout014A far wall.

Experimental 3D terrain geometry; texture/PBR and runtime deployment pending.
Deliberately retains the entire horizontal fighting corridor and far bank.
"""
import importlib.util
import math
from pathlib import Path

spec=importlib.util.spec_from_file_location("env021_blockout014",Path(__file__).with_name("env021-blockout-014.py"))
previous=importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
core=previous.core
pos=core.pos
smooth01=core.smooth01

def gauss(x,c,w):
    return math.exp(-((x-c)/w)**2)

# A less symmetric shelf edge, no large floating appendage or sudden crop.
def outline(a):
    l,r=previous.outline(a,"A")
    # Remaining entirely outside six fighter bases.
    return l-.7*gauss(a,-5.2,1.5)-.85*gauss(a,5.9,1.7),r-.55*gauss(a,-5.0,.9)-.45*gauss(a,5.9,1.3)

def surface(s,a):
    h=previous.height(s,a,"A")
    # Flat rectangular fighting corridor cannot carry sculpt-level ridges.
    # All displacement fades to zero within the safe base footprint.
    safe=smooth01((max(abs(s)-3.08,abs(a)-2.68))/1.30)
    side=smooth01((abs(s)-3.00)/2.7)
    ends=smooth01((abs(a)-2.60)/3.9)
    # Three *continuous geological fractures* with slanting traces and
    # width variation. These are narrow recessed cuts, not surface noise.
    joint=(.19*gauss(a-.35*s,-5.4,.20)
          +.13*gauss(a+.29*s,5.2,.17)
          +.11*gauss(s+.21*a,-4.3,.17))
    # Macro caprock undulation and resistant bed edges only outside the
    # protected standing stage.
    strata=(.32*math.sin(.66*a-.21*s)+.16*math.sin(.45*s+.32*a))
    cap= -.26*side-.19*ends +.24*ends*side
    return h+safe*(.20*strata*(.25+.75*max(side,ends))-joint*(.3+.7*max(side,ends))+cap)

def near_mass():
    na,ns,nv=137,79,44
    a0,a1=previous.A_NEAR[0][0],previous.A_NEAR[-1][0]
    aa=[a0+(a1-a0)*j/(na-1) for j in range(na)]
    vv=[];ff=[]
    def v(s,a,z):
        vv.append(pos(s,a,z));return len(vv)-1
    def q(a,b,c,d):
        ff.extend(((a,b,c),(a,c,d)))
    grid=[];rear=[];front=[];bottom=[]
    for a in aa:
        left,right=outline(a)
        tops=[]
        for k in range(ns):
            s=left+(right-left)*k/(ns-1)
            tops.append(v(s,a,surface(s,a)))
        grid.append(tops)
        banks=[]
        for side,edge,level in ((-1,left,surface(left,a)),(1,right,surface(right,a))):
            row=[tops[0] if side<0 else tops[-1]]
            for k in range(1,nv+1):
                t=k/nv
                down=30*t
                # Cliff face: hard cap, soft undercut, two resistant benches,
                # a deep talus step, and large vertical joints.
                beds=((0,0), (2.0,.05), (4.4,.38), (7.3,.08),
                      (11.1,1.25), (14.0,.60), (17.0,1.7),
                      (21.3,.88), (25.6,1.75), (30.0,2.25))
                offset=beds[-1][1]
                for (z0,d0),(z1,d1) in zip(beds,beds[1:]):
                    if down<=z1:
                        tbed=smooth01((down-z0)/(z1-z0))
                        offset=d0+(d1-d0)*tbed
                        break
                fissure=(.65+.25*t)*(gauss(a,-5.8,.44)+gauss(a,4.7,.35))
                # No flat rectangular vertical skirt; layers become broader
                # at the base, warped by coherent bedding deformation.
                outward=side*(.12+1.65*t+offset+fissure)
                row.append(v(edge+outward,a,level-down))
            banks.append(row)
        rear.append(banks[0]);front.append(banks[1])
        under=[]
        for k in range(ns):
            u=k/(ns-1)
            under.append(v(left-4.2+(right-left+9.4)*u,a,
                           min(surface(left,a),surface(right,a))-30))
        bottom.append(under)
    for j in range(na-1):
        for k in range(ns-1):
            q(grid[j][k],grid[j][k+1],grid[j+1][k+1],grid[j+1][k])
            q(bottom[j+1][k],bottom[j+1][k+1],bottom[j][k+1],bottom[j][k])
        for wall in (rear,front):
            for k in range(nv):
                q(wall[j][k],wall[j+1][k],wall[j+1][k+1],wall[j][k+1])
        q(rear[j][-1],bottom[j][0],bottom[j+1][0],rear[j+1][-1])
        q(front[j][-1],front[j+1][-1],bottom[j+1][-1],front[j][-1])
    for k in range(ns-1):
        q(grid[0][k+1],grid[0][k],bottom[0][k],bottom[0][k+1])
        q(grid[-1][k],grid[-1][k+1],bottom[-1][k+1],bottom[-1][k])
    # Rock fragments embedded in the bordering shelves. Tiny stones within
    # six footprints intentionally excluded. Each fragment is a low-poly
    # asymmetric clipped block, not an overlapping cylindrical prop.
    for side in (-1,1):
        for i in range(27):
            a=-7.0+i*.56
            edge=outline(a)[0] if side<0 else outline(a)[1]
            s=edge + (-1 if side<0 else -1)*(.55+(.57*(i*7%11)/11))
            if side>0:
                s=edge- (.50+.35*((i*7)%9)/9)
            radius=.20+.18*((i*5)%9)/9
            h=.13+.27*((i*3)%11)/11
            z=surface(s,a)
            # Four irregular corner points around a flat rock upper plane.
            ring=[]
            for k in range(5):
                ang=math.pi*2*k/5
                rr=radius*(.78+.27*math.sin(i*1.9+k*2.1))
                ring.append(v(s+rr*math.cos(ang),a+rr*math.sin(ang),z+h*(.69+.25*math.sin(k+i))))
            root=v(s,a,z+.025)
            top=v(s,a,z+h)
            for k in range(5):
                q(root,ring[(k+1)%5],ring[k],top)
    return core.mesh("ENV021_015_near_layered_shelf",vv,ff)

def build(scan_path=None):
    import bpy
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for a in (-1.9,0,1.9):
        left,right=outline(a)
        assert left < -3.15 and right > 3.15
        for s in (-2.45,2.45):
            assert abs(surface(s,a)+.04)<1e-9
    near=near_mass()
    far=previous.far_mass("A")  # Preserve the far wall that owner likes.
    core.material(near,"ENV021_015_NearWeatheredStone",(.47,.42,.38,1))
    core.material(far,"ENV021_014A_FarPreserved",(.44,.48,.50,1))
    core.markers()
    return {
      "stage":"ART_PASS_015_UNREVIEWED",
      "source":"Derived from Blockout014A; sculpted near-bank bedding and inset fragments",
      "far_wall":"UNCHANGED_BLOCKOUT_014A",
      "sky":"REAL_TIME_TEST_ONLY_ATMOSPHERE",
      "safe_fighter_zone":"s ±2.45; a -1.9,0,1.9; flat +0.04 correction",
      "note":"No CC0 scan imported; 3D mesh and Babylon sky experiment; NOT approved for game."
    }

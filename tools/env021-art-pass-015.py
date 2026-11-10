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
    # Flat rectangular fighting corridor cannot carry sculpt-level ridges.
    # All displacement fades to zero within the safe base footprint.
    safe=smooth01((max(abs(s)-3.08,abs(a)-2.68))/1.30)
    h=-.04+(previous.height(s,a,"A")+.04)*safe
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
    """Sculpt the verified Blockout014A mesh without altering its topology.

    This avoids reintroducing experimental loose geometry in a GLB exporter
    that has already passed native Babylon checks for the same mesh indices.
    """
    ob=previous.near_mass("A")
    # The base comprises 91 x 45 contiguous top vertices, then 30 rear-wall,
    # 30 front-wall and 45 floor vertices per longitudinal sample. No index
    # or face count changes, so the known valid mesh topology is preserved.
    top_count=91*45
    per_row=30+30+45
    touched=0
    for i,vert in enumerate(ob.data.vertices):
        p=vert.co
        s=-(p.x*core.RIGHT[0]+p.y*core.RIGHT[1])
        a=-(p.x*core.AWAY[0]+p.y*core.AWAY[1])
        if i<top_count:
            before=previous.height(s,a,"A")
            after=surface(s,a)
            vert.co.z+=after-before
            # Keep the six battle footprints as flat as the source.
            touched+=abs(after-before)>1e-9
        else:
            local=(i-top_count)%per_row
            left,right=previous.outline(a,"A")
            side=left if local<30 else right
            offset=surface(side,a)-previous.height(side,a,"A")
            vert.co.z+=offset
            # The visible front scarp gets joints and uneven bed faces,
            # but only as controlled deformation of its native vertices.
            if 30<=local<60:
                t=((local-30)+1)/30
                cut=(.32*gauss(a,-5.0,.65)+.43*gauss(a,5.5,.65))
                indent=t*(.18*math.sin(.57*a+2.7*t)-cut)
                new_s=s+indent
                coords=pos(new_s,a,float(vert.co.z))
                vert.co.x,vert.co.y=coords[0],coords[1]
    ob.data.update()
    print("ENV021_PASS015_PROVEN_BASE_RESCULPT",len(ob.data.vertices),
          len(ob.data.polygons),"top displaced",touched,flush=True)
    ob.name="ENV021_015_near_layered_shelf"
    return ob

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

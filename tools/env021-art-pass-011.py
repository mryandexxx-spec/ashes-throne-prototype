"""ENV021 Art Pass 011 — macroform-first canyon study. UNAPPROVED CLAY.
Uses Pass010 as a fixed reproducible baseline, overriding the large-scale
shelf, fractured boundary and opposing escarpment. No gameplay changes.
"""
import importlib.util
import math
from pathlib import Path

spec=importlib.util.spec_from_file_location("env021_pass010",Path(__file__).with_name("env021-art-pass-010.py"))
base=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
smooth01=base.smooth01
pos=base.pos

def gauss(a,center,width):
    return math.exp(-((a-center)/width)**2)

def lip(a):
    """An overhanging, interrupted bedrock crown, outside all six standing zones."""
    # Two offset breakaway bays, with nonperiodic long-axis variations.
    return (4.30 + .33*math.sin(a*.22-.3) + .26*math.sin(a*.58+1.5)
            - .48*gauss(a,-6.7,2.0) - .66*gauss(a,7.4,2.1)
            + .48*gauss(a,1.7,1.55))

def left_edge(a):
    return (-4.16 - .27*math.sin(a*.23+.8)
            + .20*gauss(a,-8.1,2.2)-.16*gauss(a,8.9,2.5))

def surface(s,a):
    """Level battle footprints transition into stepped ripped rock plates.

    Form controls operate outside s=3.05 and outside landward s=-3.15,
    preserving the six fighter cylinders and their immediate approach.
    """
    land=smooth01((-s-3.22)/2.2)
    crown=smooth01((s-3.07)/max(.75,lip(a)-3.07))
    # Massive geological rolls are not high-frequency displacement noise.
    ramp=.40*land**1.6*(.85+.16*math.sin(a*.28))
    bedrock=-.66*crown**1.2
    # Two collapsed sheet-rock slabs, staggered longitudinally rather than
    # a single shallow sinusoid running along the entire rim.
    break_one=crown*(.60*gauss(a,-5.5,2.4)+.36*gauss(a,7.0,2.9))
    fracture=crown*(.15*math.sin(a*.43+s*.28)-.14*abs(math.sin(a*.62-.35*s)))
    # Localised step-downs across caprock bedding; fade completely before
    # combat standing zones and give the broad stage a rougher shoulder.
    step=crown*(.31*smooth01((s-3.52)/.65)+.23*smooth01((s-3.91)/.55))
    terrace=crown*.17*math.sin(a*.27+s*.56)
    far_ends=(.40*smooth01((a-6.8)/5.0)
              +.27*smooth01((-a-8.0)/3.5))
    # Small foot-level undulation is absent on purpose.
    return (-.04+ramp+far_ends*land
            +bedrock-break_one-step+fracture+terrace)

def opposite_bank():
    """A deep, broad continuous landmass, not a narrow artificial ribbon.

    Its leading wall is carved by 3 large gullies and bedding-controlled
    buttresses; a broad back slope gives readable mass beyond its crown.
    """
    vertices=[];faces=[]
    def add(s,a,z):
        vertices.append(pos(s,a,z))
        return len(vertices)-1
    def quad(i,j,k,l):
        faces.extend(((i,j,k),(i,k,l)))
    na,nv,nb=105,61,27
    front_rows=[];rear_rows=[]
    for j in range(na):
        a=-24+j*52/(na-1)
        ravines=(3.0*gauss(a,-12.0,3.1)+4.2*gauss(a,3.5,3.8)
                 +2.6*gauss(a,17.6,3.0))
        front=(22.6+1.55*math.sin(a*.14+.4)+ravines)
        joints=sum(1.0*gauss(a,q,.77) for q in (-17.3,-5.6,8.6,22.1))
        crest=(-10.0+1.75*math.sin(a*.12+.6)+.59*math.sin(a*.37)
               -joints-1.8*gauss(a,3.5,3.8))
        wall=[]
        for k in range(nv):
            t=k/(nv-1);down=34*t
            # Broad bedding contacts yield resistant projecting shelves and
            # retreating beds, with a visible lower buttress below the crown.
            contacts=((0,.0),(4,.22),(9,1.55),(14,.63),
                      (20,2.3),(27,1.05),(34,2.15))
            retreat=contacts[-1][1]
            for (d0,v0),(d1,v1) in zip(contacts,contacts[1:]):
                if down<=d1:
                    u=smooth01((down-d0)/(d1-d0))
                    retreat=v0+(v1-v0)*u
                    break
            lateral=.50*math.sin(a*.19+down*.045)
            # Joint cuts widen along the weakened middle layers.
            cut=sum(.68*gauss(a,q+.03*down,.64) for q in (-17.3,-5.6,8.6,22.1))
            wall.append(add(front+.13*down+retreat+cut+lateral,
                            a,crest-down))
        front_rows.append(wall)
        rear=[]
        for k in range(nb):
            u=k/(nb-1)
            s=front+14*u
            # Behind the lip the hillside gains area and recedes downwards;
            # unlike Pass010 it is not a five-unit-wide strip.
            z=crest-1.0*u-6.5*u*u +.3*math.sin(a*.22)*u
            rear.append(add(s,a,z))
        rear_rows.append(rear)
    for j in range(na-1):
        for k in range(nv-1):
            quad(front_rows[j][k],front_rows[j+1][k],
                 front_rows[j+1][k+1],front_rows[j][k+1])
        for k in range(nb-1):
            quad(rear_rows[j][k],rear_rows[j][k+1],
                 rear_rows[j+1][k+1],rear_rows[j+1][k])
    return base.mesh("ENV021_far_broad_fractured_escarpment",vertices,faces)

def build(scan_path):
    # Reuse vetted Blender conversion, scan placement and mesh extrusion.
    # Pass010 near cliff's stratified walls inherit this changed lip/surface.
    base.lip=lip
    base.left_edge=left_edge
    base.surface=surface
    base.opposite_bank=opposite_bank
    result=base.build(scan_path)
    result["stage"]="ART_PASS_011_NOT_APPROVED"
    result["form"]="fractured rim transition, collapsing caprock sheets, broad recessed far landmass"
    result["note"]="Macroform proposal only; source scan remains unwelded; check actual Babylon HUD frames"
    return result

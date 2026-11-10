"""ENV021 Art Pass 013: fractured landward headland, not a road-strip.
PROPOSAL ONLY. Hard fighter footprints unchanged. Extends the near landmass
with broad asymmetrical shoulders and erosion terraces beyond anchor zones.
Pass012 is retained for exact visual comparison.
"""
import importlib.util
import math
from pathlib import Path

spec=importlib.util.spec_from_file_location("env021_pass012",Path(__file__).with_name("env021-art-pass-012.py"))
previous=importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
core=previous.core
smooth01,pos=core.smooth01,core.pos

def gauss(a,c,w):
    return math.exp(-((a-c)/w)**2)

def lip(a):
    # Uneven scarp in the longitudinal direction. Protected fighter row a±1.9.
    return (previous.lip(a)+.64*gauss(a,4.4,1.85)
            -.83*gauss(a,9.0,2.3)-.56*gauss(a,-7.3,2.3)
            +.42*gauss(a,-12.0,2.8))

def left_edge(a):
    # Off-centre eroded headland: preserve ally column around a=-1.9..1.9.
    return (previous.left_edge(a)-2.65*smooth01((a-4.0)/8.2)
            -1.43*smooth01((-a-5.1)/6.2)
            -.32*gauss(a,11.8,1.9))

def surface(s,a):
    # Six cylinders see exactly the old flat surface at their a coordinates.
    initial=previous.surface(s,a)
    peripheral=smooth01((abs(a)-3.5)/3.3)
    land=smooth01((-s-3.15)/1.9)
    rim=smooth01((s-3.00)/max(.68,lip(a)-3.00))
    # A wide geological hinge at the far shoulder prevents the endless
    # flat road toward screen top. Changes are layered, not repeated noise.
    incline= -.71*peripheral**1.35
    fallen_bed= (-1.27*smooth01((a-5.3)/3.5)
                 -.66*smooth01((-a-6.7)/3.1))
    # Large interrupted caprock blocks descend into the abyss on the
    # unsafe right edge; no deformation within fighter footprints.
    collapsed=(.48*gauss(a,8.1,2.3)+.42*gauss(a,-8.0,2.4))
    cut=(.32*gauss(a,6.6,.85)+.26*gauss(a,-8.9,1.05))
    shoulder= .43*land*peripheral + .18*math.sin(a*.29)*peripheral
    return (initial+incline+fallen_bed*(.38+.62*smooth01((s+2.6)/4.8))
            -collapsed*rim-cut*(.45*land+.7*rim)+shoulder)

def near_land():
    """Continuous sculpt volume, asymmetrical distant fan and stepped edge.

    The native mesh's horizontal top, lower volume and rim side all share
    regular longitudinal sampling. There are no disconnected decorative rocks.
    """
    na,ns,depth=105,63,44
    av=[-16.0+j*39.0/(na-1) for j in range(na)]
    verts=[];faces=[]
    def add(s,a,z):
        verts.append(pos(s,a,z));return len(verts)-1
    def quad(i,j,k,l):
        faces.extend(((i,j,k),(i,k,l)))
    for a in av:
        left,right=left_edge(a),lip(a)
        for i in range(ns):
            t=i/(ns-1)
            s=left+(right-left)*t
            add(s,a,surface(s,a))
    for j in range(na-1):
        for i in range(ns-1):
            q=j*ns+i
            quad(q,q+1,q+ns+1,q+ns)
    walls=[]
    for j,a in enumerate(av):
        cap=(j*ns+ns-1)
        ztop=verts[cap][2]
        row=[cap]
        for k in range(1,depth+1):
            t=k/depth
            down=(33.5+1.2*math.sin(a*.12))*t
            profile=((0.,0.),(4.,.18),(8.5,1.25),(12.7,.43),
                     (18.1,1.67),(24.4,.75),(33.5,1.2))
            retreat=profile[-1][1]
            for (d0,r0),(d1,r1) in zip(profile,profile[1:]):
                if down<=d1:
                    h=smooth01((down-d0)/(d1-d0))
                    retreat=r0*(1-h)+r1*h
                    break
            joint=(.35+.6*t)*(gauss(a,-9,.6)+gauss(a,6.6,.85)+gauss(a,12,.8))
            # Wider broken bench directly below the rim (structural layer).
            s=lip(a)+.48+2.8*t+retreat+joint
            row.append(add(s,a,ztop-down))
        walls.append(row)
    for j in range(na-1):
        for k in range(depth):
            quad(walls[j][k],walls[j][k+1],walls[j+1][k+1],walls[j+1][k])
    bottoms=[]
    for a in av:
        base_z=surface(lip(a),a)-33.5-1.2*math.sin(a*.12)
        row=[]
        for i in range(ns):
            t=i/(ns-1)
            s=left_edge(a)+(lip(a)+3.28-left_edge(a))*t
            row.append(add(s,a,base_z))
        bottoms.append(row)
    for j in range(na-1):
        for i in range(ns-1):
            quad(bottoms[j+1][i],bottoms[j+1][i+1],
                 bottoms[j][i+1],bottoms[j][i])
        quad(j*ns,(j+1)*ns,bottoms[j+1][0],bottoms[j][0])
        quad(walls[j][-1],bottoms[j][-1],
             bottoms[j+1][-1],walls[j+1][-1])
    for i in range(ns-1):
        quad(i+1,i,bottoms[0][i],bottoms[0][i+1])
        q=(na-1)*ns+i
        quad(q,q+1,bottoms[-1][i+1],bottoms[-1][i])
    return core.mesh("ENV021_near_broken_headland",verts,faces)

def build(scan_path):
    core.lip=lip
    core.left_edge=left_edge
    core.surface=surface
    core.near_land=near_land
    core.opposite_bank=previous.opposite_bank
    result=core.build(scan_path)
    result["stage"]="ART_PASS_013_NOT_APPROVED"
    result["form"]="connected asymmetric headland, stepped peripheral erosion, near rim and Pass012 opposite bank"
    result["note"]="Combat safe zones preserved; un-welded CC0 scan; judge only real Babylon HUD screenshots"
    return result

"""ENV021 Art Pass 010: reference-guided layered cliff planes and structurally cut apron. CLAY WIP, not approved."""
import math
import bpy
from mathutils import Vector
A=-3*math.pi/4
RIGHT=(-math.sin(A),math.cos(A))
AWAY=(-math.cos(A),-math.sin(A))
def pos(s,a,h):
    # Native Babylon glTF importer flips the scene-root X/Z orientation.
    # The Blender authoring coordinates therefore face 180 degrees opposite
    # the legacy inaccurate clay reference camera. See Pass006 QA previews.
    return (-RIGHT[0]*s-AWAY[0]*a,-RIGHT[1]*s-AWAY[1]*a,h)
def smooth01(x):
    t=max(0.0,min(1.0,x))
    return t*t*(3.0-2.0*t)

def lip(a):
    # Two broad bends + rock-cut recesses, not a mathematically straight ledge.
    # Protect the enemy fighter row: lip must remain beyond s=+2.45
    # with room for a 0.575-radius base. Beyond that corridor cut
    # asymmetrical bays and remove the old broad flat right-side apron.
    notch=(.78*math.exp(-((a-6.1)/1.45)**2)
           +.54*math.exp(-((a+6.8)/1.6)**2))
    return (4.35+.52*math.sin(a*.28+.35)+.32*math.sin(a*.81-1.1)
            -.20*math.sin(a*1.65+.6)-notch)

def left_edge(a):
    # Narrow the landward plateau, keep ally bases at s=-2.45 untouched.
    return (-5.25-.68*math.sin(.33*a+.4)-.34*math.cos(.68*a)
            +.68*math.exp(-((a-7.7)/1.8)**2)
            +.40*math.exp(-((a+7.2)/1.7)**2))

def ridge_noise(s,a):
    # Large independent geological folds; small ripples cannot rescue silhouette.
    n=(.54*math.sin(s*.58+a*.31)+.32*math.sin(a*.85-s*.24)
       +.18*math.sin(s*1.32+a*1.11))
    return n

def surface(s,a):
    # Preserve the entire fighter footprint while shaping only peripheral rock.
    # Landward uplift is visible in clay. The apron around the rim is fractured.
    land=smooth01((-s-3.9)/2.2)
    back=smooth01((a-6.0)/5.0)
    distant_end=smooth01((-a-8.0)/4.0)
    rim_distance=max(0,lip(a)-s)
    rim=smooth01((2.5-rim_distance)/2.5)
    # Directional rock terraces, drainage shelves and a fractured ledge beyond
    # the combat formation. Fade out the deformation around fighting positions.
    outer=smooth01((abs(s)-3.2)/2.0)
    long_folds=(.48*math.sin(a*.44+s*.29)+.30*math.sin(a*.98-s*.41))
    incisions=outer*(.38*long_folds-.28*abs(math.sin(a*.9+s*.56)))
    # A broad eroded rim: descending terraces START outside occupied positions,
    # and become camera-readable sloping cuts toward the vertical wall.
    rim_grade=smooth01((s-2.95)/max(.8,lip(a)-2.95))
    terraces=(-.55*rim_grade**1.6
              -.26*rim_grade*abs(math.sin(a*.72+s*.40))
              +.16*rim_grade*math.cos(a*1.18-s*.52))
    # Readable weathering along the landward shoulder and near rim; retain
    # continuous, gentle footfall terrain around all fighter anchor points.
    outside=smooth01((abs(s)-3.20)/1.35)
    cliff_bands=outside*(.46*math.sin(a*.62+s*.43)
                         -.38*abs(math.sin(a*1.18-s*.56)))
    # A resistant rim bed lies over weathered/retreating lower beds.
    # Structural bedding and a handful of broad joints, not random ripples.
    cut=smooth01((s-2.95)/1.30)
    joint_grooves=sum(
        .24*math.exp(-((a-center-.15*s)/width)**2)
        for center,width in ((-8.3,.47),(-3.8,.33),(4.4,.45),(9.0,.38)))
    runoff=-cut*joint_grooves
    # Irregular weathering pockets along the rim, smoothly integrated with
    # the combat surface while keeping every base's 0.575 radius protected.
    mantle=smooth01((-s-3.2)/1.65)*(
        -.21*math.exp(-((a+6.2)/2.1)**2)
        +.24*math.exp(-((a-5.8)/2.5)**2))
    h=(-.04+1.23*land**1.5+.58*back+.38*distant_end
       +land*(.19*ridge_noise(s,a))
       +back*(.14*math.sin(a*.8+s*.41))
       -.35*rim*abs(math.sin(a*.64+s*.37))
       +.11*rim*math.sin(a*1.8+s*.3)+incisions+terraces+cliff_bands+runoff+mantle)
    return h

def mesh(name,verts,faces):
    me=bpy.data.meshes.new(name+"_geo")
    me.from_pydata(verts,[],faces)
    me.update()
    ob=bpy.data.objects.new(name,me)
    bpy.context.collection.objects.link(ob)
    return ob

def near_land():
    # Dense enough to keep real stratification, not oversized for Blender CI.
    na,ns,depth=89,57,42
    av=[-11+j*26/(na-1) for j in range(na)]
    verts=[]
    faces=[]
    def add(p):
        verts.append(p)
        return len(verts)-1
    def quad(a,b,c,d):
        faces.extend(((a,b,c),(a,c,d)))
    for a in av:
        edge=left_edge(a)
        for i in range(ns):
            t=i/(ns-1)
            s=edge+(lip(a)-edge)*t
            add(pos(s,a,surface(s,a)))
    for j in range(na-1):
        for i in range(ns-1):
            q=j*ns+i
            quad(q,q+1,q+ns+1,q+ns)
    cliff=[]
    for j,a in enumerate(av):
        rim_idx=j*ns+ns-1
        top=verts[rim_idx][2]
        row=[rim_idx]
        for k in range(1,depth+1):
            t=k/depth
            # Lithological sequence with persistent benches at layer contacts.
            # Strong beds resist retreat, weak beds undercut the ledge.
            z=top-(31+1.2*math.sin(a*.12))*t
            depth=z-top
            # These contacts are shared along the entire exposed escarpment.
            strata=((.0, .0),(-4.2,.10),(-8.7,.72),
                    (-12.9,.20),(-18.5,.95),(-24.4,.35),(-31.0,.55))
            profile=0.0
            for (z0,d0),(z1,d1) in zip(strata,strata[1:]):
                if depth>=z1:
                    u=smooth01((depth-z1)/(z0-z1))
                    profile=d1*(1-u)+d0*u
                    break
            # Major joints in the upper resistant layer; cuts intensify below
            # the lip where blocks have detached along fracture planes.
            joints=sum(.44*math.exp(-((a-center+.025*depth)/width)**2)
                       for center,width in ((-8.3,.55),(-3.8,.40),(4.4,.52),(9.0,.42)))
            local=math.sin(a*.30+.1)*.11
            s=lip(a)+1.0+2.1*t+profile+joints*(.35+.65*t)+local
            row.append(add(pos(s,a,z)))
        cliff.append(row)
    for j in range(na-1):
        for k in range(depth):
            quad(cliff[j][k],cliff[j][k+1],cliff[j+1][k+1],cliff[j+1][k])
    # Close bottom/landward/end faces; valid manifold for later sculpt processing.
    lower=[]
    for a in av:
        row=[]
        edge=left_edge(a)
        low=surface(lip(a),a)-31-1.2*math.sin(a*.12)
        for i in range(ns):
            t=i/(ns-1)
            s=edge+(lip(a)+2.0-edge)*t
            row.append(add(pos(s,a,low)))
        lower.append(row)
    for j in range(na-1):
        for i in range(ns-1):
            quad(lower[j+1][i],lower[j+1][i+1],lower[j][i+1],lower[j][i])
        quad(j*ns,(j+1)*ns,lower[j+1][0],lower[j][0])
        # Last column of bottom is identical in location to last cliff vertex,
        # but separate indices; close the side in geometry to avoid a visual slit.
        quad(cliff[j][-1],lower[j][-1],lower[j+1][-1],cliff[j+1][-1])
    for i in range(ns-1):
        quad(i+1,i,lower[0][i],lower[0][i+1])
        q=(na-1)*ns+i
        quad(q,q+1,lower[-1][i+1],lower[-1][i])
    return mesh("ENV021_near_fissured_landward_shelf",verts,faces)

def opposite_bank():
    """Layered continuous escarpment, drawn from bedding/joint relationships.

    The long face remains connected. Differential retreat creates persistent
    horizontal ledges; structural joints break the crown into irregular slabs.
    Reference-driven clay silhouette only, NOT a model of a canonical rock type.
    """
    verts=[]
    faces=[]
    def add(s,a,z):
        verts.append(pos(s,a,z))
        return len(verts)-1
    def quad(i,j,k,l):
        faces.extend(((i,j,k),(i,k,l)))
    na,nv,nb=91,57,14
    front_rows=[]
    rear_rows=[]
    for j in range(na):
        a=-18+j*40/(na-1)
        main_ravine=sum(
            depth*math.exp(-((a-center)/width)**2)
            for center,width,depth in ((-10.6,2.4,2.0),(-1.0,2.7,2.7),(11.8,2.0,1.9)))
        front=16.0+1.15*math.sin(a*.19+.2)+main_ravine
        # Distinct block-breaks at joints instead of an inflated sinusoidal dome.
        joint_lines=(-13.0,-7.2,-.8,5.9,13.5)
        joint_drop=sum(
            .95*math.exp(-((a-center)/.56)**2) for center in joint_lines
        )
        # Long benches and rockfall notches establish uneven broken rim.
        crest=(-7.8+.65*math.sin(a*.22)
               +.42*math.sin(a*.56+.6)-joint_drop
               -1.2*math.exp(-((a-8.7)/2.1)**2))
        wall=[]
        for k in range(nv):
            t=k/(nv-1)
            depth=-28.0*t
            z=crest+depth
            # Resistant cap, two weak beds, then resistant middle bench.
            # Changes are anchored to elevation, not periodic face ripples.
            contacts=((.0,.0),(-3.9,.12),(-7.8,1.55),
                      (-11.9,.42),(-16.2,1.9),(-22.4,.60),(-28.0,1.28))
            retreat=0
            for (z0,d0),(z1,d1) in zip(contacts,contacts[1:]):
                if depth>=z1:
                    u=smooth01((depth-z1)/(z0-z1))
                    retreat=d1*(1-u)+d0*u
                    break
            # Fractures widen down the wall; do not form separate objects.
            joints=sum(.55*math.exp(-((a-line-.015*depth)/.5)**2)
                       for line in joint_lines)
            s=front+.45*t+retreat+joints*t
            wall.append(add(s,a,z))
        front_rows.append(wall)
        rear=[]
        for k in range(nb):
            t=k/(nb-1)
            s=front+5.6*t
            # Weathered inclined surface follows the same bedding.
            z=crest-.45*t-2.6*t*t+.22*math.sin(a*.42)*t
            rear.append(add(s,a,z))
        rear_rows.append(rear)
    for j in range(na-1):
        for k in range(nv-1):
            quad(front_rows[j][k],front_rows[j+1][k],
                 front_rows[j+1][k+1],front_rows[j][k+1])
        for k in range(nb-1):
            quad(rear_rows[j][k],rear_rows[j][k+1],
                 rear_rows[j+1][k+1],rear_rows[j+1][k])
    return mesh("ENV021_far_stratified_continuous_rock_face",verts,faces)

def scan_relief(path,base):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    scans=[o for o in bpy.data.objects if o not in before and o.type=="MESH"]
    if not scans:raise RuntimeError("Missing CC0 scan geometry")
    world=[o.matrix_world@v.co for o in scans for v in o.data.vertices]
    mn=Vector(tuple(min(p[i] for p in world) for i in range(3)))
    mx=Vector(tuple(max(p[i] for p in world) for i in range(3)))
    mid=(mn+mx)*.5;span=mx-mn
    for o in scans:
        mat=o.matrix_world.copy()
        for v in o.data.vertices:
            p=mat@v.co
            a=1.0+(p.x-mid.x)/span.x*6.5
            s=lip(a)+.60+(p.z-mid.z)/max(span.z,.01)*.29
            v.co=pos(s,a,-5.5+(p.y-mid.y)/span.y*4.2)
        o.matrix_world.identity()
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    for o in scans:o.select_set(True)
    bpy.context.view_layer.objects.active=base
    bpy.ops.object.join()
    # Art Pass 010 evaluates silhouette before a fragile voxel fusion/bake.
    # The imported relief shares one Blender object but is NOT yet watertight.
    # A proper manifold and baking pass will follow approved composition.
def material(obj,name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=color
    obj.data.materials.clear();obj.data.materials.append(m)
def markers():
    for team,x,color in (("ally",-2.45,(.23,.39,.51,1)),("enemy",2.45,(.58,.34,.26,1))):
        for i,z in enumerate((-1.9,0,1.9)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.28,depth=1.4,location=(-x,-z,.72))
            ob=bpy.context.object
            ob.name="REF_only_fighter_"+team+str(i)
            material(ob,ob.name+"_mat",color)
def build(scan_path):
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    # QA invariant: leave the six standing zones uninterrupted.
    for a in (-1.9,0,1.9):
        assert left_edge(a)<-3.1 and lip(a)>3.1, "Fighter base clearance lost"
        for side in (-2.45,2.45):
            assert abs(surface(side,a))<.30, "Fighter base standing plane deformed"
    print("ENV021_STAGE: near landmass",flush=True)
    near=near_land()
    print("ENV021_STAGE: opposite bank",flush=True)
    far=opposite_bank()
    print("ENV021_STAGE: import/reposition source scan (no remesh)",flush=True)
    scan_relief(scan_path,near)
    print("ENV021_STAGE: clay materials",flush=True)
    material(near,"ENV021_near_clay",(.55,.53,.49,1))
    material(far,"ENV021_far_clay",(.48,.52,.54,1))
    markers()
    print("ENV021_STAGE: Pass010 bedding planes and structural fractures created",flush=True)
    return {"stage":"ART_PASS_010_NOT_APPROVED","source":"CC0 Poly Haven Coastal Cliff 02",
            "form":"fighter-safe shelf, resistant cap rock, undercut beds and joint-controlled cliff planes",
            "note":"Scan is NOT welded; native Babylon/WebGL camera test required; art unapproved"}

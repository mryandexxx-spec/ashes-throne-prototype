"""ENV021 Art Pass 009: coherent stepped canyon geology with connected far ridge. CLAY WIP, not approved."""
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
    # Discontinuous erosional fans gradually descend toward the gorge lip:
    # the protected combat corridor stays a single flat, navigable surface.
    cut=smooth01((s-2.80)/1.15)
    runoff=(.22*math.cos(a*.48+s*.71)
            -.30*abs(math.sin(a*1.03-s*.38)))*cut
    # Landward rock folds merge into the terrain rather than hovering as props.
    mantle=smooth01((-s-3.15)/2.1)*(
        .29*math.cos(a*.44+s*.47)-.21*abs(math.sin(a*.77-s*.33)))
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
            # Longitudinal fractures, directionally coherent horizontal layers,
            # and several broad ledge breaks with no loose block geometry.
            fracture=(.86*math.sin(a*.57+t*5.2)
                      +.35*math.sin(a*1.30-t*4.8))
            layers=(.68*math.sin(t*21+a*.13)
                    +.25*math.sin(t*47-a*.27))
            # Broad wall bulges and narrow erosion gullies break the profile
            # without inserting independent low-poly scenic props.
            gullies=-.65*(math.sin(a*.37+t*3.3)**8)*math.sin(t*math.pi)
            # Broad stepped bands fracture the wall on several vertical levels.
            band=(.30*math.sin(t*17+a*.16)+.20*math.sin(t*33-a*.23))*math.sin(t*math.pi)
            s=(lip(a)+2.0*t+.34*math.sin(t*7+a*.33)+gullies+band
               +(fracture+layers)*(t*(1-t))*2.4)
            z=top-(31+1.2*math.sin(a*.12))*t
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
    """Coherent erosion model: continuous scarred wall and rising rear ridge.

    Deliberately preview topology, not welded production topology. One continuous
    cliff relief replaces Pass008's three disconnected curtain pieces; broad
    erosion lobes become a shared rock body, not isolated decorative boulders.
    """
    verts=[]
    faces=[]
    def add(s,a,z):
        verts.append(pos(s,a,z))
        return len(verts)-1
    def quad(a,b,c,d):
        faces.extend(((a,b,c),(a,c,d)))
    na, nv, nb = 89, 43, 20
    front_rows=[]
    back_rows=[]
    for j in range(na):
        a=-18.0+j*40/(na-1)
        # Shoreline follows independent large-scale bends.
        # Three rocky spurs are incised in one connected front wall.
        lobes=(1.9*math.exp(-((a+10.8)/3.0)**2)
               +2.5*math.exp(-((a-1.4)/3.5)**2)
               +1.7*math.exp(-((a-13.6)/3.6)**2))
        recessed=(1.5*math.exp(-((a+5.8)/2.1)**2)
                  +1.1*math.exp(-((a-8.1)/2.5)**2))
        front=16.7+1.6*math.sin(a*.16+.3)-lobes+recessed
        # A continuous uneven spine. Drainage basins cut lower crests.
        crest=(-7.6+2.2*math.sin(a*.16+.7)
               +1.65*math.sin(a*.46-.25)
               +.95*math.cos(a*.82+.35)
               -.95*math.exp(-((a-7.5)/2.4)**2)
               -1.6*math.exp(-((a+6.2)/1.45)**2)
               -1.25*math.exp(-((a-3.8)/1.35)**2))
        face=[]
        for k in range(nv):
            t=k/(nv-1)
            bend=(1.2*math.sin(t*6.4+a*.28)
                  +.55*math.sin(t*16+a*.58))*t*(1-t)*3.0
            strata=(.55*math.sin(t*24+a*.18)
                    +.27*math.cos(t*39-a*.34))*math.sin(math.pi*t)
            gullies=-.85*(math.sin(a*.42+t*1.7)**8)*math.sin(math.pi*t)
            s=front+1.3*t+bend+strata+gullies
            z=crest-(25.0+1.5*math.sin(a*.23))*t
            face.append(add(s,a,z))
        front_rows.append(face)
        back=[]
        for k in range(nb):
            t=k/(nb-1)
            # A falling geological apron, continuous with the crest in geometry;
            # uneven cross-cuts keep the rear profile from being a flat deck.
            s=front+6.5*t+.65*math.sin(a*.34+t*5)*t
            # Tilt away sharply: no broad hemispherical dome over the gorge.
            # Erosion troughs split high flanks into several coherent ridges.
            rill=(.7*math.cos(a*.43+t*3)
                  -1.0*abs(math.sin(a*.60+t*4.2)))
            z=(crest+.85*math.sin(math.pi*t)
               +rill*t-3.5*t*t
               +.35*math.sin(a*.91+t*7)*math.sin(math.pi*t))
            back.append(add(s,a,z))
        back_rows.append(back)
    for j in range(na-1):
        for k in range(nv-1):
            quad(front_rows[j][k],front_rows[j+1][k],
                 front_rows[j+1][k+1],front_rows[j][k+1])
        for k in range(nb-1):
            quad(back_rows[j][k],back_rows[j][k+1],
                 back_rows[j+1][k+1],back_rows[j+1][k])
    # Edges between the cliff and the rear slope have coincident coordinates,
    # separate topology until silhouette approval and watertight remeshing.
    return mesh("ENV021_far_coherent_erosion_spine",verts,faces)

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
    # Art Pass 008 evaluates silhouette before a fragile voxel fusion/bake.
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
    print("ENV021_STAGE: Pass009 revised ridge silhouette and narrowed shelf created",flush=True)
    return {"stage":"ART_PASS_009_NOT_APPROVED","source":"CC0 Poly Haven Coastal Cliff 02",
            "form":"fighter-safe shelf, continuous far erosion spine and integrated runoff apron",
            "note":"Scan is NOT welded; native Babylon/WebGL camera test required; art unapproved"}

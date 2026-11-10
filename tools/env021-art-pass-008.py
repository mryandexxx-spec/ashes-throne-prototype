"""ENV021 Art Pass 008: separated distant geology and broken near-shelf perimeter. CLAY WIP, not approved."""
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
    return (-5.7-.65*math.sin(.33*a+.4)-.31*math.cos(.68*a)
            +.44*math.exp(-((a-7.7)/1.8)**2))

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
    h=(-.04+1.23*land**1.5+.58*back+.38*distant_end
       +land*(.19*ridge_noise(s,a))
       +back*(.14*math.sin(a*.8+s*.41))
       -.35*rim*abs(math.sin(a*.64+s*.37))
       +.11*rim*math.sin(a*1.8+s*.3)+incisions+terraces+cliff_bands)
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
    """Three separated rock shoulders with layered depth, not one continuous wall.

    They share a single Blender mesh object for the narrow GLB QA contract;
    their disconnected faces are intentional silhouette gaps, NOT welded
    production topology. Far surfaces are clay concept geometry only.
    """
    vertices=[]
    faces=[]
    def vertex(s,a,z):
        vertices.append(pos(s,a,z))
        return len(vertices)-1
    def quad(a,b,c,d):
        faces.append((a,b,c))
        faces.append((a,c,d))
    # Receding ledges overlap in perspective without becoming a curtain.
    # Intervals retain open air between the main shoulders.
    shoulders=[
        (-15.0,-4.1,13.8,-5.6,1.25),
        (-2.7,8.8,16.4,-7.1,1.65),
        (9.1,19.1,20.0,-9.5,1.95),
    ]
    for order,(begin,end,depth,crest,erosion) in enumerate(shoulders):
        na,nv,nt=34,25,12
        rows=[]
        cap=[]
        for j in range(na):
            a=begin+(end-begin)*j/(na-1)
            u=j/(na-1)
            # Narrow at both ends; no rectangular top or parallel vertical sides.
            taper=math.sin(math.pi*u)**.7
            front=depth+.9*math.sin(a*.37+order*.9)+.7*math.sin(a*.91-order*.4)
            crown=(crest+2.1*taper
                   +1.2*math.sin(a*.46+order*.8)*taper
                   +.55*math.sin(a*1.25-order)*taper)
            face=[]
            for k in range(nv):
                t=k/(nv-1)
                # Strong erosion at several heights, with deep banding.
                fold=(.90*math.sin(t*15+a*.32)
                      +.43*math.sin(t*37-a*.41))*t*(1-t)*4.0
                runoff=-erosion*(math.sin(a*.66+t*2.7)**8)*math.sin(math.pi*t)
                s=front+(1.0+1.5*order/2)*t+fold+runoff
                z=crown-(20.0+2.0*order)*t
                face.append(vertex(s,a,z))
            rows.append(face)
            caprow=[]
            for k in range(nt):
                t=k/(nt-1)
                # Broad fractured ridge slopes away from the front edge.
                s=front+(4.0+1.5*order)*t+.40*math.sin(a*.53+t*5)
                z=crown+.65*math.sin(math.pi*t)*math.sin(a*.3+order)-2.8*t*t
                caprow.append(vertex(s,a,z))
            cap.append(caprow)
        for j in range(na-1):
            for k in range(nv-1):
                quad(rows[j][k],rows[j+1][k],rows[j+1][k+1],rows[j][k+1])
            for k in range(nt-1):
                quad(cap[j][k],cap[j][k+1],cap[j+1][k+1],cap[j+1][k])
        # At the ridge front, cap and face occupy the same coordinates but
        # separate indices; this is a clay-only mesh and not watertight.
    return mesh("ENV021_far_three_recessed_rock_shoulders",vertices,faces)
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
    print("ENV021_STAGE: Pass008 separated rock shoulders and sculpted shelf created",flush=True)
    return {"stage":"ART_PASS_008_NOT_APPROVED","source":"CC0 Poly Haven Coastal Cliff 02",
            "form":"one near shelf and three spaced distant cliff shoulders in one GLB mesh",
            "note":"Scan is NOT welded; native Babylon/WebGL camera test required; art unapproved"}

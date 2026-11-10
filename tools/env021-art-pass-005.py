"""ENV021 Art Pass 005: separated chasm profiles and restrained left landmass. CLAY WIP, not approved."""
import math
import bpy
from mathutils import Vector
A=-3*math.pi/4
RIGHT=(-math.sin(A),math.cos(A))
AWAY=(-math.cos(A),-math.sin(A))
def pos(s,a,h):return (RIGHT[0]*s+AWAY[0]*a,RIGHT[1]*s+AWAY[1]*a,h)
def smooth01(x):
    t=max(0.0,min(1.0,x))
    return t*t*(3.0-2.0*t)

def lip(a):
    # Two broad bends + rock-cut recesses, not a mathematically straight ledge.
    return (5.15 + .56*math.sin(a*.28+.35)
            + .25*math.sin(a*.81-1.1) - .54*math.exp(-((a-5.2)/1.6)**2)
            - .30*math.exp(-((a+5.8)/1.25)**2))

def left_edge(a):
    return -8.1-.56*math.sin(.33*a+.4)-.24*math.cos(.68*a)

def ridge_noise(s,a):
    # Large independent geological folds; small ripples cannot rescue silhouette.
    n=(.54*math.sin(s*.58+a*.31)+.32*math.sin(a*.85-s*.24)
       +.18*math.sin(s*1.32+a*1.11))
    return n

def surface(s,a):
    # Both fighter rows (-2.45/+2.45, z=-1.9..1.9) stay on a walkable shelf.
    # Landward uplift is visible in clay. The apron around the rim is fractured.
    land=smooth01((-s-4.4)/4.0)
    back=smooth01((a-6.0)/5.0)
    distant_end=smooth01((-a-8.0)/4.0)
    rim_distance=max(0,lip(a)-s)
    rim=smooth01((2.5-rim_distance)/2.5)
    h=(-.04+.95*land**1.5+.50*back+.33*distant_end
       +land*(.19*ridge_noise(s,a))
       +back*(.14*math.sin(a*.8+s*.41))
       -.35*rim*abs(math.sin(a*.64+s*.37))
       +.11*rim*math.sin(a*1.8+s*.3))
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
            fracture=(.60*math.sin(a*.57+t*5.2)
                      +.35*math.sin(a*1.30-t*4.8))
            layers=(.45*math.sin(t*21+a*.13)
                    +.25*math.sin(t*47-a*.27))
            s=(lip(a)+2.3*t+.26*math.sin(t*7+a*.33)
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
            s=edge+(lip(a)+2.3-edge)*t
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
    # A distinct scarred face beyond the void, not a horizontal stadium slab.
    na,nd=59,41
    av=[-13+j*30/(na-1) for j in range(na)]
    verts=[]
    faces=[]
    def add(p):
        verts.append(p)
        return len(verts)-1
    def quad(a,b,c,d):
        faces.extend(((a,b,c),(a,c,d)))
    for a in av:
        front=18.5+.92*math.sin(a*.19+.6)+.31*math.cos(a*.62)
        upper=(-7.3+1.25*math.sin(a*.20+.8)
               +.75*math.sin(a*.45-.6)+.32*math.cos(a*.9+.1))
        for k in range(nd):
            t=k/(nd-1)
            # A real cliff face descends, with horizontal strata and vertical
            # runoff channels; its lip is crenellated by erosion.
            side=(front+1.65*t+.28*math.sin(t*11+a*.24)
                  +.52*math.sin(t*20-a*.3)*t*(1-t))
            z=upper-27*t
            add(pos(side,a,z))
    for j in range(na-1):
        for k in range(nd-1):
            q=j*nd+k
            quad(q,q+nd,q+nd+1,q+1)
    # Behind the face, a sloped, broken ridge rather than a flat raised panel.
    nback=14
    back_start=len(verts)
    for a in av:
        front=18.5+.92*math.sin(a*.19+.6)+.31*math.cos(a*.62)
        upper=(-7.3+1.25*math.sin(a*.20+.8)
               +.75*math.sin(a*.45-.6)+.32*math.cos(a*.9+.1))
        for k in range(nback):
            t=k/(nback-1)
            side=front+7.5*t+.44*math.sin(a*.31+t*5)
            z=(upper+2.2*t + .6*math.sin(a*.34+t*2)
               +.3*math.cos(a*.78+t*3))
            add(pos(side,a,z))
    for j in range(na-1):
        for k in range(nback-1):
            q=back_start+j*nback+k
            quad(q,q+1,q+nback+1,q+nback)
    return mesh("ENV021_far_eroded_opposite_wall",verts,faces)
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
    # Art Pass 002 evaluates silhouette before a fragile voxel fusion/bake.
    # The imported relief shares one Blender object but is NOT yet watertight.
    # A proper manifold and baking pass will follow approved composition.
def material(obj,name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=color
    obj.data.materials.clear();obj.data.materials.append(m)
def markers():
    for team,x,color in (("ally",-2.45,(.23,.39,.51,1)),("enemy",2.45,(.58,.34,.26,1))):
        for i,z in enumerate((-1.9,0,1.9)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.28,depth=1.4,location=(x,z,.72))
            ob=bpy.context.object
            ob.name="REF_only_fighter_"+team+str(i)
            material(ob,ob.name+"_mat",color)
def build(scan_path):
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
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
    print("ENV021_STAGE: Pass005 separation/sculpt created",flush=True)
    return {"stage":"ART_PASS_005_NOT_APPROVED","source":"CC0 Poly Haven Coastal Cliff 02",
            "form":"shelf and cliff in a single Blender object; distant opposite bank separated",
            "note":"Scan is NOT welded yet; fighter references excluded from GLB; game HUD not tested"}

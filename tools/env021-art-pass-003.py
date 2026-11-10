"""ENV021 Art Pass 003: close-camera composition corrective sculpt. CLAY WIP, not approved."""
import math
import bpy
from mathutils import Vector
A=-3*math.pi/4
RIGHT=(-math.sin(A),math.cos(A))
AWAY=(-math.cos(A),-math.sin(A))
def pos(s,a,h):return (RIGHT[0]*s+AWAY[0]*a,RIGHT[1]*s+AWAY[1]*a,h)
def lip(a):return 4.7+.32*math.sin(a*.27+.4)+.23*math.sin(a*.73-.6)
def surface(s,a):
    dist=max(0,-s-5.2);end=max(0,abs(a)-6.0)
    return -.04 + .09*min(dist,8) - .13*min(end,7) + .06*math.sin(a*.72+s*.31)*min(1,dist*.20)
def mesh(name,verts,faces):
    me=bpy.data.meshes.new(name+"_geo");me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);return ob
def near_land():
    na,ns,depth=47,36,25
    av=[-11+j*24/(na-1) for j in range(na)]
    vertices=[]
    for a in av:
        for i in range(ns):
            s=-9+(lip(a)+9)*i/(ns-1)
            vertices.append(pos(s,a,surface(s,a)))
    faces=[]
    def add(v):vertices.append(v);return len(vertices)-1
    def quad(a,b,c,d):faces.extend(((a,b,c),(a,c,d)))
    for j in range(na-1):
        for i in range(ns-1):
            q=j*ns+i;quad(q,q+1,q+ns+1,q+ns)
    walls=[]
    for j,a in enumerate(av):
        row=[j*ns+ns-1]
        for k in range(1,depth+1):
            t=k/depth
            strata=.36*math.sin(18*t+a*.16)+.15*math.sin(35*t-a*.11)
            side=lip(a)+2.0*t+.28*math.sin(6*t+a*.12)+2.2*strata*t*(1-t)
            row.append(add(pos(side,a,-29*t-.04)))
        walls.append(row)
    for j in range(na-1):
        for k in range(depth):
            quad(walls[j][k],walls[j][k+1],walls[j+1][k+1],walls[j+1][k])
    # Volumetric bottom, rear and ends so remesher can weld source geometry.
    bottom=[]
    for a in av:
        bottom.append([add(pos(-9+(lip(a)+11)*i/(ns-1),a,-29))
                       for i in range(ns)])
    for j in range(na-1):
        for i in range(ns-1):
            quad(bottom[j+1][i],bottom[j+1][i+1],bottom[j][i+1],bottom[j][i])
        quad(j*ns,(j+1)*ns,bottom[j+1][0],bottom[j][0])
    for i in range(ns-1):
        quad(i+1,i,bottom[0][i],bottom[0][i+1])
        q=(na-1)*ns+i;quad(q,q+1,bottom[-1][i+1],bottom[-1][i])
    # Lower edge of front wall: join bottom to keep the landmass manifold.
    for j in range(na-1):
        quad(walls[j][-1],bottom[j][-1],bottom[j+1][-1],walls[j+1][-1])
    return mesh("ENV021_near_continuous_shelf",vertices,faces)
def opposite_bank():
    na,ns=32,9
    vertices=[];faces=[]
    for j in range(na):
        a=-12+j*30/(na-1)
        for i in range(ns):
            t=i/(ns-1);s=12.4+12*t+.65*math.sin(a*.22+1.3)*(1-t)
            ridge=1.7+1.3*math.sin(.21*a+.7)+1.2*math.sin(.48*a-.8)+.65*math.cos(.76*a+.1)
            vertices.append(pos(s,a,-7+ridge*t**.75+.3*math.sin(a*.7+t*4)))
    for j in range(na-1):
        for i in range(ns-1):
            q=j*ns+i;faces.extend(((q,q+1,q+ns+1),(q,q+ns+1,q+ns)))
    start=len(vertices)
    for j in range(na):
        a=-10+j*38/(na-1)
        for k in range(1,10):
            t=k/9
            vertices.append(pos(12.4+1.2*t+.65*math.sin(a*.22+1.3),a,-7-21*t))
    for j in range(na-1):
        for k in range(9):
            p=j*ns if k==0 else start+j*9+k-1
            q=(j+1)*ns if k==0 else start+(j+1)*9+k-1
            r=start+(j+1)*9+k;t=start+j*9+k
            faces.extend(((p,q,r),(p,r,t)))
    return mesh("ENV021_far_different_bank",vertices,faces)
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
            a=2.0+(p.x-mid.x)/span.x*6.8
            s=lip(a)+.38+(p.z-mid.z)/max(span.z,.01)*.30
            v.co=pos(s,a,-6.3+(p.y-mid.y)/span.y*4.2)
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
    material(far,"ENV021_far_clay",(.38,.43,.46,1))
    markers()
    print("ENV021_STAGE: full composition created",flush=True)
    return {"stage":"ART_PASS_003_NOT_APPROVED","source":"CC0 Poly Haven Coastal Cliff 02",
            "form":"shelf and cliff in a single Blender object; distant opposite bank separated",
            "note":"Scan is NOT welded yet; fighter references excluded from GLB; game HUD not tested"}

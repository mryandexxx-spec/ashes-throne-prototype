"""03B v3: actual continuous authored terrain, no 02 fixture decoration.
Run after existing Blender export and Recast bake. Original geometry, CC0 diffuse maps.
Coordinates X/Y-up/Z; all visible art in ART, navigation untouched after bake.
"""
import bpy,bmesh,math,random,json,sys,pathlib,hashlib
import numpy as np
from mathutils import Vector
root=pathlib.Path(sys.argv[1]).resolve();geo=json.loads(pathlib.Path('fixture.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(root/'source.blend'))
art=bpy.data.collections['ART']; rng=random.Random(310303)
def h(x):return 0 if x<=8 else (x-8)/2 if x<12 else 2
def bl(p):return (p[0],-p[2],p[1])
def mat(name,c,asset=None,mix=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1)
    n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.94
    if asset:
        im=bpy.data.images.load(str(pathlib.Path('materials',asset+'_diff.jpg').resolve()),check_existing=False);im.scale(512,512)
        # Tint and compress local contrast; no costly normal map. Original CC0 source retained in receipt.
        a=np.empty(512*512*4,dtype=np.float32);im.pixels.foreach_get(a);a=a.reshape(-1,4)
        l=a[:,:3].mean(axis=1);a[:,:3]=np.clip(np.asarray(c)[None,:]+(l[:,None]-np.median(l))*mix,0,1)
        im.pixels.foreach_set(a.ravel());im.pack();t=n.new('ShaderNodeTexImage');t.image=im;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m
rock=[mat('limestone '+str(i),c,'rock_06',.29) for i,c in enumerate([(.53,.49,.42),(.47,.45,.40),(.59,.55,.47)])]
earth=mat('compacted warm earth',(.59,.52,.40),'stone_floor',.16)
pave=[mat('worn pale paving '+str(i),c,'stone_floor',.22) for i,c in enumerate([(.71,.64,.50),(.64,.59,.48)])]
masonry=[mat('dressed stone '+str(i),c) for i,c in enumerate([(.69,.61,.48),(.60,.54,.43),(.76,.67,.53)])]
wood=mat('aged dark timber',(.27,.20,.14));cloth=mat('ochre linen',(.65,.43,.24));dark=mat('recess',(.12,.10,.08));soil=mat('garden soil',(.34,.26,.17))
leaf=[mat('olive foliage '+str(i),c) for i,c in enumerate([(.25,.34,.15),(.39,.46,.20),(.49,.53,.27)])]
far=mat('distant atmospheric stone',(.34,.45,.50))
def mesh(name,verts,faces,material,scale=3,closed=False):
    m=bpy.data.meshes.new(name);m.from_pydata([bl(p) for p in verts],[],faces);m.update()
    if closed:
        bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
    o=bpy.data.objects.new(name,m);art.objects.link(o);m.materials.append(material)
    uv=m.uv_layers.new(name='SurfaceUV')
    for poly in m.polygons:
        axis=max(range(3),key=lambda j:abs(poly.normal[j]));a,b=[i for i in range(3) if i!=axis]
        for j in poly.loop_indices:
            p=m.vertices[m.loops[j].vertex_index].co;uv.data[j].uv=(p[a]/scale,p[b]/scale)
    return o
def prism(name,x,y,z,w,H,d,m,rot=0):
    c,s=math.cos(rot),math.sin(rot)
    v=[(x+u*c-v*s,y+t*H,z+u*s+v*c) for u,v,t in [(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0),(-w/2,-d/2,1),(w/2,-d/2,1),(w/2,d/2,1),(-w/2,d/2,1)]]
    return mesh(name,v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],m,2,True)
def slab(name,poly,y,m):
    return mesh(name,[(x,y(x,z),z) for x,z in poly],[tuple(range(len(poly)-1,-1,-1))],m,2)
def split(poly,step=1.3):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        k=max(1,math.ceil(math.dist(a,b)/step));out.extend((a[0]+(b[0]-a[0])*i/k,a[1]+(b[1]-a[1])*i/k) for i in range(k))
    return out
def massif(name,poly,top,depth,material=rock[0],cap=True,spread=1):
    # Continuous non-vertical strata. Side faces triangulated; repeated broad layer, not upright cubes.
    poly=split(poly);n=len(poly);cx=sum(x for x,z in poly)/n;cz=sum(z for x,z in poly)/n;v=[]
    layers=[(0,0),(.07,.22),(.19,.62),(.33,.31),(.49,1.1),(.67,.72),(1,1.8)]
    for j,(d,s) in enumerate(layers):
        for i,(x,z) in enumerate(poly):
            dx=x-cx;dz=z-cz;l=max(.01,math.hypot(dx,dz));k=(s+.18*math.sin(i*1.9+j))*spread if j else 0
            v.append((x+dx/l*k,top(x,z)-d*depth+(rng.uniform(-.17,.17) if j else 0),z+dz/l*k))
    faces=[]
    for j in range(len(layers)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n;faces.extend([(a,b,c),(a,c,d)])
    faces.append(tuple(range((len(layers)-1)*n,len(layers)*n)))
    if cap:faces.append(tuple(range(n-1,-1,-1)))
    o=mesh(name,v,faces,material,5,True)
    if material in rock:
        for m in rock:
            if m!=material:o.data.materials.append(m)
        for p in o.data.polygons:p.material_index=(p.index//(n*2))%len(o.data.materials)
    return o
for o in list(art.objects):
    if o.name!='walkable_visual':bpy.data.objects.remove(o,do_unlink=True)
floor=bpy.data.objects['walkable_visual'];floor.data.materials.clear();floor.data.materials.append(earth)
uv=floor.data.uv_layers.new(name='SurfaceUV')
for p in floor.data.polygons:
    for li in p.loop_indices:
        v=floor.data.vertices[floor.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/2.5,v.y/2.5)
# One ground mass follows authored boundary; no isolated spur and no rectangular platform cap.
massif('continuous natural terrace',geo['outer'],lambda x,z:h(x)-.025,20,cap=False)
# Connect terrace to the mountain across the entire northern edge, with broad irregular land behind.
back=[(s[0],s[4]-.03) for s in geo['sections']]
back+= [(24,8),(25,14),(20,19),(11,21),(2,19),(-8,20),(-15,15),(-14,7)]
massif('mountain foundation behind inhabited terraces',back,lambda x,z:h(x)-.06,22)
# Large connected escarpment, rising from behind facades, extends outside camera.
massif('mountain escarpment',[(-15,11),(-11,10),(-7,12),(-2,10.5),(4,12.5),(10,9),(16,10.5),(22,8),(27,13),(26,26),(-17,28)],lambda x,z:9+2.7*math.sin(x*.31)+.17*z,30,rock[1],spread=1.4)
# Entrance and exit naturally continue as inaccessible scenic continuation, not another floating island.
for poly in [[(-16,-1.7),(-12,-3.5),(-9,-3.3),(-9,3.8),(-13,6),(-16,7)],[(19,-2.5),(23,-3.7),(27,-1.5),(27,7),(23,8),(19,3.1)]]:
    massif('scenic rock continuation',poly,lambda x,z:h(x)-.15,21,rock[1])
# Far atmospheric forms beyond the immediate mountain and gorge.
for i,(x,z) in enumerate([(-38,-19),(-30,34),(0,40),(35,30),(42,-23)]):
    massif('distant massif '+str(i),[(x-12,z-7),(x-3,z-10),(x+9,z-7),(x+15,z+5),(x+2,z+12),(x-13,z+6)],lambda xx,zz:3+5*math.sin(xx*.13+i),38,far,spread=1.8)
# Paths are wider continuous paved shapes, then hand-set irregular flat stones at the edges.
def ribbon(name,pts,w,material):
    v=[]
    for i,(x,z) in enumerate(pts):
        a=pts[max(0,i-1)];b=pts[min(len(pts)-1,i+1)];dx=b[0]-a[0];dz=b[1]-a[1];l=math.hypot(dx,dz)
        for t in [-1,1]:
            width=w*(.46+.055*math.sin(i*2.7+t))
            xx=x-t*dz/l*width;zz=z+t*dx/l*width;v.append((xx,h(xx)+.026,zz))
    return mesh(name,v,[(i,i+1,i+3,i+2) for i in range(0,len(v)-2,2)],material,2.4)
north=[(-8.1,.1),(-6,1.1),(-4.5,3.2),(-2.8,4.2),(-.7,4.25),(1.6,4.6),(3.8,3.8),(5.5,1.9),(7.5,0)]
south=[(-8.1,.1),(-6,-1.5),(-4.5,-3.3),(-2.6,-4.3),(-.5,-4.6),(2,-4.45),(4,-3.7),(5.7,-1.8),(7.5,0)]
upper=[(7.5,0),(8,0),(10,.25),(12,.35),(15,.55),(17,.2),(18.3,.1)]
ribbon('main stone lane',north,2.05,pave[0]);ribbon('garden lane',south,1.8,pave[1]);ribbon('upper ascending lane',upper,2.15,pave[0])
# Angular but hand-shaped inset paving, different scales, no repeated checkerboard.
for pts in [north,south,upper]:
    for a,b in zip(pts,pts[1:]):
        if 8<a[0]<12 or 8<b[0]<12:continue
        for t in [.22,.72]:
            x=a[0]+(b[0]-a[0])*t;z=a[1]+(b[1]-a[1])*t
            dx=b[0]-a[0];dz=b[1]-a[1];l=math.hypot(dx,dz);side=rng.choice([-1,1]);x-=side*dz/l*.64;z+=side*dx/l*.64
            rad=rng.uniform(.25,.43);poly=[(x+rad*math.cos(j*math.tau/6+rng.uniform(-.15,.15)),z+rad*.67*math.sin(j*math.tau/6)) for j in range(6)]
            slab('worn inset flagstone',poly,lambda x,z:h(x)+.041,rng.choice(pave))
# A planted terrace fills the excluded natural ridge, rather than a lonely rock in a square plaza.
garden=[(-2.65,-1.46),(-1.6,-2.0),(.3,-2.12),(2,-1.7),(2.62,-1.15),(2.55,1.25),(1.1,2.04),(-1,1.92),(-2.5,1.16)]
massif('garden terrace stone foundation',garden,lambda x,z:.37,3.6,rock[2],spread=.2)
slab('garden soil bed',[(-2.25,-1.05),(-1.4,-1.6),(.2,-1.65),(1.8,-1.3),(2.1,1),(0.9,1.58),(-1,1.5),(-2.1,.85)],lambda x,z:.40,soil)
def segment(name,a,b,y,H,d,m):
    x,z=(a[0]+b[0])/2,(a[1]+b[1])/2;return prism(name,x,y,z,math.dist(a,b),H,d,m,math.atan2(b[1]-a[1],b[0]-a[0]))
for a,b in zip(garden,garden[1:]+garden[:1]):
    segment('garden rim',a,b,.36,.25,.23,rng.choice(masonry))
# Leaves as grouped low-poly lobes, one modest tree rather than dense alpha billboards.
def foliage(name,x,y,z,sx,sy,sz,m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=bl((x,y,z)))
    o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy)
    for c in list(o.users_collection):c.objects.unlink(o)
    art.objects.link(o);o.data.materials.append(m);return o
for x,z in [(-1.65,-.9),(-.85,-1.0),(.1,-1.15),(1.15,-.85),(-1.25,.65),(.7,.82),(1.55,.55)]:
    for j in range(4):
        a=j*1.57+rng.random()*.4;foliage('herb foliage',x+.19*math.cos(a),.58+rng.random()*.12,z+.19*math.sin(a),.22,.19,.16,rng.choice(leaf))
prism('tree trunk',.1,.38,.1,.18,1.55,.18,wood,.4)
for x,y,z,s in [(.1,2.05,.1,.66),(-.43,1.82,.15,.52),(.53,1.93,.36,.57),(.14,1.78,-.44,.50)]:
    foliage('tree crown',x,y,z,s,s*.66,s*.85,rng.choice(leaf))
# Cliffside architecture is an integrated row of recessed bays with shared stepped terraces.
# Each bay is behind authored northern edge (z>=6.8 here), with actual openings and masonry.
def bay(x,z,w,H,depth):
    base=h(x);front=z;back=z+depth
    prism('foundation masonry',x,base-.24,z+depth*.5,w+.18,.48,depth+.2,masonry[1])
    door=.78;left=w*.5-door*.5
    for side in (-1,1):
        cx=x+side*(door/2+left/2)
        for j in range(round(H/.32)):
            yy=base+.24+j*.32
            if yy>=base+H:break
            # individual stones, staggered joints, not a featureless box
            n=max(1,round(left/.48));bw=left/n
            for k in range(n):
                xx=cx-left/2+bw*(k+.5)
                prism('facade stone',xx,yy,front,bw-.018,.306,.47,rng.choice(masonry))
        prism('return wall',x+side*(w*.5-.16),base+.2,z+depth/2,.32,H,depth,masonry[1])
    prism('interior shadow back',x,base+.24,back-.16,w-.25,H-.1,.22,dark)
    prism('door lintel',x,base+1.93,front,1.02,.24,.63,masonry[2])
    prism('upper wall',x,base+2.17,front,door,max(.12,H-1.9),.47,masonry[0])
    prism('terrace roof',x,base+H+.12,z+depth*.5,w+.28,.23,depth+.25,masonry[2])
    for side in (-1,1):
        prism('roof parapet side',x+side*w*.5,base+H+.35,z+depth*.5,.20,.33,depth+.2,masonry[1])
    prism('roof parapet front',x,base+H+.35,front,w+.2,.33,.23,masonry[0])
    # Timber shutter & frame on a recessed upper wall, small visual break.
    if H>2.65:
        prism('upper shutter',x,base+2.36,front-.26,.57,.45,.09,wood)
        prism('upper shutter sill',x,base+2.31,front-.31,.76,.10,.22,masonry[2])
for x,z,w,H,d in [(-5.6,7.15,2.9,2.8,3.1),(-2.65,7.28,2.9,3.5,3.4),(.45,7.25,3,3.05,3.1),(3.55,7.15,3.1,3.8,3.5),(6.6,6.35,2.8,3.1,3.0),(10.2,4.7,3.2,3.25,3.5),(14,5.25,3.6,3.55,3.7)]:
    bay(x,z,w,H,d)
# Workshop awning off the walking area, short cloth span and functional objects.
for x in [-5.5,-3.55]:prism('awning post',x,0,6.75,.12,1.95,.12,wood)
mesh('workshop canopy',[(-5.7,1.9,6.73),(-3.35,1.9,6.73),(-3.35,2.45,7.65),(-5.7,2.45,7.65)],[(0,1,2,3)],cloth)
for x,z in [(-5.15,7),(-4.2,7.1),(3.55,6.9)]:prism('storage chest',x,.04,z,.53,.48,.48,wood,.12)
# Low edge masonry follows selected exposed parts, leaving view of cliff and not crossing NAV.
for a,b in zip(geo['sections'],geo['sections'][1:]):
    if a[0]<-7 or a[0]>7 or -2.9<a[0]<2.9:continue
    u=(a[0],a[1]-.23);v=(b[0],b[1]-.23)
    segment('low cliff parapet',u,v,h(a[0])-.05,.42,.33,masonry[1])
# Batch repeated art by material and role, keep editable major groups in source.
bpy.ops.object.select_all(action='DESELECT')
for prefix in ['facade stone','foundation masonry','return wall','roof parapet','terrace roof','worn inset flagstone','garden rim','herb foliage','tree crown','low cliff parapet']:
    objs=[o for o in art.objects if o.name.startswith(prefix)]
    if not objs:continue
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=prefix+' batch';bpy.ops.object.select_all(action='DESELECT')
for o in art.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'level.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source.blend'))
receipt={'scope':'03B v3 new authored terrain, not visually accepted','blender':bpy.app.version_string,'provenance':'Original geometry, diffuse-only modified Poly Haven CC0 rock_06 and stone_floor, no external models','files':{}}
for name in ['level.glb','art-source.blend','nav.json','level.json','navmesh.bin']:
    p=root/name;receipt['files'][name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(root/'art-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))

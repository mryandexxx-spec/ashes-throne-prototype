"""MAP-3D-03B: original environment candidate over the frozen 02 NAV/MARKERS.
All meshes and textures authored here; no external assets. RH game coordinates.
The preserved proxy is a constraint for this first visual slice, not final chapter geography.
"""
import bpy, math, random, sys, json, hashlib, pathlib
import numpy as np
from mathutils import Vector
root=pathlib.Path(sys.argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(root/'source.blend'))
art=bpy.data.collections['ART']
rng=random.Random(3103)
def bl(p): return (p[0],-p[2],p[1])
def mesh(name,verts,faces,material,scale=3):
    m=bpy.data.meshes.new(name);m.from_pydata([bl(p) for p in verts],[],faces);m.update()
    o=bpy.data.objects.new(name,m);art.objects.link(o);m.materials.append(material)
    uv=m.uv_layers.new(name='SurfaceUV')
    for poly in m.polygons:
        n=poly.normal;axis=max(range(3),key=lambda j:abs(n[j]))
        axes=[j for j in range(3) if j!=axis]
        for i in poly.loop_indices:
            p=m.vertices[m.loops[i].vertex_index].co
            uv.data[i].uv=(p[axes[0]]/scale,p[axes[1]]/scale)
    return o
def material(name,col,grain=.09):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*col,1)
    n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=.94
    if grain:
        # Original periodic multiscale noise; explicitly baked into glTF-compatible image.
        N=256; gen=np.random.default_rng(sum(ord(c) for c in name))
        f=np.zeros((N,N),dtype=np.float32)
        for k,a in [(4,.48),(16,.27),(64,.16),(256,.09)]:
            v=gen.random((k,k)).astype(np.float32);coord=np.arange(N)*k/N
            i=np.floor(coord).astype(int);t=coord-i;t=t*t*(3-2*t)
            q=v[i[:,None],i[None,:]]*(1-t[:,None])*(1-t[None,:])+v[(i[:,None]+1)%k,i[None,:]]*t[:,None]*(1-t[None,:])+v[i[:,None],(i[None,:]+1)%k]*(1-t[:,None])*t[None,:]+v[(i[:,None]+1)%k,(i[None,:]+1)%k]*t[:,None]*t[None,:]
            f+=q*a
        rgba=np.ones((N,N,4),dtype=np.float32)
        for j,c in enumerate(col):rgba[:,:,j]=np.clip(c+(f-.5)*grain*3,0,1)
        img=bpy.data.images.new(name+' baked grain',width=N,height=N,alpha=False);img.colorspace_settings.name='sRGB'
        img.pixels.foreach_set(rgba.ravel());img.pack()
        t=n.new('ShaderNodeTexImage');t.image=img;t.extension='REPEAT';m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m
stone=[material('stratum '+str(i),c,.045) for i,c in enumerate([(.48,.47,.43),(.42,.43,.42),(.53,.49,.43),(.38,.40,.41),(.56,.52,.45)])]
road=material('earthy terrace ground',(.42,.37,.28),.035)
paving=[material('paving '+str(i),c,.035) for i,c in enumerate([(.68,.61,.49),(.61,.55,.44),(.71,.64,.53)])]
mortar=material('weathered masonry joints',(.43,.39,.33),.10)
blocks=[material('quarried stone '+str(i),c,.08) for i,c in enumerate([(.66,.59,.47),(.59,.53,.44),(.73,.65,.53),(.55,.50,.42)])]
wood=material('aged timber',(.36,.25,.16),.11);roof=material('muted clay roof',(.43,.29,.21),.09)
dark=material('recess shadow',(.19,.17,.14),.025);linen=material('undyed canvas',(.68,.59,.42),.07)
soil=material('cultivated soil',(.39,.30,.21),.12)
greens=[material('leaf '+str(i),c,.025) for i,c in enumerate([(.29,.39,.18),(.37,.45,.22),(.47,.52,.26)])]
# Remove neutral landmark cubes, preserve original floor geometry and navigation.
for o in list(art.objects):
    if o.name!='walkable_visual':bpy.data.objects.remove(o,do_unlink=True)
floor=bpy.data.objects['walkable_visual'];floor.data.materials.clear();floor.data.materials.append(road)
uv=floor.data.uv_layers.new(name='SurfaceUV')
for p in floor.data.polygons:
    for li in p.loop_indices:
        v=floor.data.vertices[floor.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/3,v.y/3)
def box(name,x,y,z,w,h,d,m,bevel=0):
    # y is base elevation.
    v=[(x+sx*w/2,y+sy*h,z+sz*d/2) for sx,sy,sz in [(-1,0,-1),(1,0,-1),(1,0,1),(-1,0,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    o=mesh(name,v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],m)
    if bevel:
        mod=o.modifiers.new('chipped edges','BEVEL');mod.width=bevel;mod.segments=1
    return o
def ground(x):return 0 if x<=8 else (x-8)/2 if x<12 else 2
# Use actual CC0 photographic materials rather than noisy procedural stand-ins.
# Files fetched from the individual asset download links at build time, downscaled offline.
def scanned(name,asset,normal=True):
    m=material(name,(.6,.6,.6),0);nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    for kind in (['diff','nor_gl'] if normal else ['diff']):
        file=pathlib.Path('materials')/(asset+'_'+kind+'.jpg')
        im=bpy.data.images.load(str(file.resolve()),check_existing=True)
        if kind!='diff':im.colorspace_settings.name='Non-Color'
        im.scale(1024,1024);im.pack();t=nodes.new('ShaderNodeTexImage');t.image=im
        if kind=='diff':links.new(t.outputs['Color'],p.inputs['Base Color'])
        else:
            n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.65;links.new(t.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs['Normal'])
    return m
cliff_surface=scanned('natural stratified cliff','rock_06')
path_surface=scanned('worn stone paving','stone_floor')
# Material strips are actual terrain surfaces, kept within the proven walking footprint.
def ribbon(name,points,width,m):
    v=[]
    for i,(x,z) in enumerate(points):
        a=points[max(0,i-1)];c=points[min(len(points)-1,i+1)];dx=c[0]-a[0];dz=c[1]-a[1];l=math.hypot(dx,dz)
        for side in (-1,1):
            xx=x-side*dz/l*width*.5;zz=z+side*dx/l*width*.5
            v.append((xx,ground(xx)+.032,zz))
    return mesh(name,v,[(i,i+1,i+3,i+2) for i in range(0,len(v)-2,2)],m,1.8)
ribbon('north route worn paving',[(-6.9,0),(-5.4,2.7),(-3.3,4),(0,4.35),(3.1,4.1),(5.5,2.6),(6.7,0)],2.3,path_surface)
ribbon('south route worn paving',[(-6.9,0),(-5.6,-2.5),(-3.5,-4),(0,-4.4),(3.5,-4.1),(5.6,-2.6),(6.7,0)],2.1,path_surface)
ribbon('upper route worn paving',[(6.7,0),(8,0),(10,0),(12,0),(15,0),(17.2,0)],2.8,path_surface)

def ring_rock(name,outline,top,depth):
    # Irregular layered walls with shared vertices; upper edge meets the playable surface.
    n=len(outline);v=[]
    cx=sum(x for x,z in outline)/n;cz=sum(z for x,z in outline)/n
    for layer,(down,spread) in enumerate([(0,0),(.10,.24),(.22,.85),(.36,.43),(.52,1.35),(.68,.65),(.83,1.85),(1,1.3)]):
        for i,(x,z) in enumerate(outline):
            k=0 if layer==0 else .30*math.sin(i*1.6)+rng.uniform(-.23,.23)
            dx=x-cx;dz=z-cz;l=max(.01,math.hypot(dx,dz))
            v.append((x+dx/l*(spread+k),top(x)-down*depth+(rng.uniform(-.22,.22) if layer else 0),z+dz/l*(spread+k)))
    f=[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    for j in range(1,7):
        f.extend((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n) for i in range(n))
    f.append(tuple(range(n-1,-1,-1)));f.append(tuple(range(7*n,8*n)))
    o=mesh(name,v,f,cliff_surface,2.5)
    # Blender mesh winding recalculated outside, since rock is closed.
    return o
# Outline clockwise in game X/Z; subdivide long edges for geological variation.
def subdiv(poly,step=1.5):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        k=max(1,math.ceil(math.dist(a,b)/step))
        out.extend((a[0]+(b[0]-a[0])*i/k,a[1]+(b[1]-a[1])*i/k) for i in range(k))
    return out
# Backing cap kept 5cm below NAV, including central exclusion. No art on valid path.
main=[(-8,-6),(8,-6),(8,-3),(12,-3),(18,-3),(18,3),(12,3),(8,3),(8,6),(-8,6)]
# Cap on sloped and concave outline would bridge the ramp at wrong height:
# remove the upper cap of the rock, leaving NAV surface itself as the top.
o=ring_rock('continuous cliff strata',subdiv(main),lambda x:ground(x)-.06,17)
import bmesh
def remove_top(o):
    bm=bmesh.new();bm.from_mesh(o.data);face=max(bm.faces,key=lambda f:len(f.verts))
    # first largest n-gon is top, bottom can tie; select via higher mean Z
    n=len(face.verts);tops=[f for f in bm.faces if len(f.verts)==n]
    face=max(tops,key=lambda f:sum(v.co.z for v in f.verts)/len(f.verts))
    bmesh.ops.delete(bm,geom=[face],context='FACES_ONLY');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
remove_top(o)
ring_rock('central natural outcrop',subdiv([(-1.55,-.85),(-.95,-1.5),(.7,-1.45),(1.45,-.5),(1.15,1.35),(-.6,1.45),(-1.4,.65)],.55),lambda x:1.55+.45*math.sin(x*1.8),3.7)
# Rock shoulders below the nav edge break the rectangular platform silhouette.
for i,poly in enumerate([[(-10,-5.7),(-8,-5.9),(-8,2),(-10.2,3.8),(-12,1)], [(-8,-6),(-6,-8.7),(-3,-8.5),(-1,-6)],[(2,-6),(4,-8.1),(7.7,-7.2),(8,-6)],[(9,-3),(12,-4.8),(16,-5.2),(18,-3)],[(16,3),(18,3),(21,4.5),(24,3),(25,6),(20,9),(15,7)]]):
    ring_rock('irregular shoulder '+str(i),subdiv(poly,1),lambda x:ground(x)-1.0,17)
# Connecting rock below both spurs hides the floating-island silhouette without making it walkable.
ring_rock('deep rock connection',subdiv([(16,-4),(25,-4),(27,1),(24,6),(17,5)],1.2),lambda x:-5+.2*math.sin(x),15)

ring_rock('separated natural spur',subdiv([(20,-3),(24,-3),(24,3),(20,3)]),lambda x:1.93,19)
# Distant mass, not walkable: layered horizon along far side of the abyss.
for i,(x,z,w,h) in enumerate([(-25,20,15,12),(-11,24,17,15),(4,25,19,14),(23,23,18,18),(42,30,20,17)]):
    poly=[(x-w*.5,z-5),(x-w*.2,z-7),(x+w*.37,z-5),(x+w*.5,z+4),(x,z+7),(x-w*.5,z+3)]
    ring_rock('distant cliff '+str(i),subdiv(poly,3.8),lambda xx:h-6+math.sin(xx*.3)*1.6,32)
# Masonry set along outside far boundary; staggered courses, no walkable obstruction.
def wall(x0,x1,z,y,height):
    courses=max(1,round(height/.34))
    for j in range(courses):
        x=x0; k=0
        while x<x1-.04:
            w=min(x1-x,rng.uniform(.65,1.15))
            box('retaining masonry',x+w/2,y+j*.34,z,w-.025,.32,.5,rng.choice(blocks),.035);x+=w;k+=1
    box('coping', (x0+x1)/2,y+courses*.34,z,x1-x0,.18,.66,blocks[2],.025)
wall(-8,-2.8,6.27,0,.68);wall(2.6,8,6.27,0,.68)
# Attached lived-in facade on natural backing behind the far path.
def house(x,z,w,d,h):
    box('house foundation',x,-.15,z,w+.45,.45,d+.35,blocks[1],.04)
    box('stone house',x,.25,z,w,h,d,blocks[0],.07)
    front=z-d/2-.035
    box('recessed doorway',x-w*.24,.25,front,.7,1.65,.08,dark,.03)
    for wx in [x+w*.23]:
        box('window shadow',wx,1.25,front,.66,.68,.07,dark,.02)
        box('window lintel',wx,1.95,front,.85,.13,.23,wood,.025)
        box('window sill',wx,1.12,front,.88,.15,.25,blocks[2],.02)
    for y in [.67,1.42,2.18]:
        if y<h:box('facade stone course',x,y,front+.02,w,.055,.05,mortar)
    v=[(x-w*.58,.25+h,z-d*.58),(x+w*.58,.25+h,z-d*.58),(x+w*.58,.25+h,z+d*.58),(x-w*.58,.25+h,z+d*.58),(x-w*.58,.25+h+.82,z),(x+w*.58,.25+h+.82,z)]
    mesh('sloping clay roof',v,[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(0,3,2,1)],roof)
    for k in range(1,5):
        dz=k*d*.58/5
        for sign in [-1,1]:box('roof batten',x,.25+h+.82*(1-k/5),z+sign*dz,w*1.17,.045,.055,wood)
# Place the houses fully beyond nav, on added solid rock support.
ring_rock('habitation backing',subdiv([(-8,6),(7.7,6),(7.7,11),(-8,11)]),lambda x:-.04,17)
# Tall irregular continuous cliff behind houses (outside NAV), not a freestanding stage.
for i,poly in enumerate([[(-11,10),(-7,10.6),(-4.2,10.9),(-3,16),(-12,17)], [(-4.4,11),(.5,10.8),(4,12),(3,17),(-6,18)],[(4,10.5),(8,10.7),(12,14),(10,19),(4,17)]]):
    ring_rock('backing escarpment '+str(i),subdiv(poly,1.0),lambda x:5.7+i*1.1+1.1*math.sin(x*.65),23)
house(-5.4,8.35,3.4,3.5,2.65);house(.5,8.6,4.2,3.4,3.65)
# Architectural articulation: jambs, timber lintels, uneven repair bands, rail and workshop.
for x,z,w,h in [(-5.4,6.53,3.4,2.65),(.5,6.83,4.2,3.65)]:
    for side in (-1,1):
        box('facade timber',x+side*w*.44,.25,z,.15,h,.17,wood,.018)
        box('door jamb',x-w*.24+side*.39,.25,z-.065,.12,1.7,.16,wood,.014)
        box('window shutter',x+w*.23+side*.41,1.25,z-.06,.16,.66,.12,wood,.018)
    box('door lintel',x-w*.24,1.94,z-.07,.95,.16,.2,wood,.02)
    box('facade beam',x,.25+h-.24,z,w,.16,.18,wood,.02)
    if h>3:
        for xx in [x-.7,x+.7]:
            box('upper recessed window',xx,2.58,z,.64,.72,.10,dark,.02)
            box('upper sill',xx,2.47,z-.10,.8,.13,.24,wood,.018)

# Awning within backing, not across player path.
for x in [4.1,6.5]:box('awning upright',x,0,6.65,.16,2.05,.16,wood,.02)
mesh('canvas awning',[(3.9,2,6.5),(6.7,2,6.5),(6.7,2.55,8.25),(3.9,2.55,8.25)],[(0,1,2,3)],linen)
box('workbench',5.3,0,7.55,1.9,.86,.7,wood,.045)
for x,z in [(4.25,7.3),(6.15,7.8),(-7,7.0)]:box('storage crate',x,0,z,.55,.5,.5,wood,.035)
# Garden alcove outside the southern walkable strip, physically supported.
ring_rock('garden natural pocket',subdiv([(-5.8,-8.7),(1.5,-8.7),(2.1,-6),(-5.8,-6)]),lambda x:-.04,13)
wall(-5.7,1.5,-8.5,0,.34)
wall(-5.7,1.5,-6.27,0,.34)
for x in [-4.7,-2.5,-.3]:
    box('garden soil',x,0,-7.2,1.7,.1,1.65,soil,.03)
    for z in [-7.95,-6.45]:box('garden stone edging',x,.04,z,1.8,.22,.16,blocks[1],.025)
    for xx in [x-.86,x+.86]:box('garden stone edging',xx,.04,-7.2,.16,.22,1.65,blocks[1],.025)
    for j in range(7):
        px=x+rng.uniform(-.66,.66);pz=-7.2+rng.uniform(-.58,.58)
        # clustered broad leaves modeled as solid angled ellipsoids, no alpha planes.
        for k in range(3):
            ang=k*2.094+rng.uniform(-.3,.3);rr=.12
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=bl((px+rr*math.cos(ang),.24,pz+rr*math.sin(ang))))
            o=bpy.context.object;o.name='garden leaf cluster';o.scale=(.18,.13,.12);o.rotation_euler.z=ang
            for c in list(o.users_collection):c.objects.unlink(o)
            art.objects.link(o);o.data.materials.append(rng.choice(greens))
# Sparse irregular inlaid paving accents, flush with floor, deliberately not a checkerboard.
for z in [-5.2,5.2]:
    for k in range(7):
        x=-7.1+k*1.25+rng.uniform(-.16,.16)
        if x>7.5:continue
        box('worn inset slab',x,.005,z+rng.uniform(-.33,.33),rng.uniform(.68,1.03),.025,rng.uniform(.55,.82),rng.choice(paving),.012)
# The central rock's narrower upper outline keeps the above-ground layers inside the excluded region.
# Recalculate normals for meshes except original exported ground; apply bevels and merge by material.
for o in list(art.objects):
    if o.type!='MESH' or o==floor:continue
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
# Preserve separate meaningful architectural assemblies in .blend; merge only repeated small props.
bpy.ops.object.select_all(action='DESELECT')
for prefix in ['retaining masonry','garden leaf cluster','garden stone edging','worn inset slab','roof batten','facade stone course','facade timber','door jamb','window shutter','upper sill']:
    objs=[o for o in art.objects if o.name.startswith(prefix)]
    if not objs:continue
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=prefix+' batch'
    bpy.ops.object.select_all(action='DESELECT')
for o in art.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'level.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source.blend'))
receipt={'scope':'03B original art candidate; not visually accepted','blender':bpy.app.version_string,'provenance':'Original authored geometry; Poly Haven CC0 rock_06 and stone_floor photographic textures plus original secondary materials; see material receipt','files':{}}
for name in ['level.glb','art-source.blend','nav.json','level.json','navmesh.bin']:
    p=root/name;receipt['files'][name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(root/'art-receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt))

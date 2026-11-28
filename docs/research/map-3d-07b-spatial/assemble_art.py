"""Art pass over the exact approved spatial GLB. No new terrain layout or gameplay.
Source art is verified original Wildfire Games CC BY-SA 3.0 via CodePawl.
"""
import bpy, math, json, pathlib, hashlib, sys, shutil, urllib.request
from mathutils import Vector, Matrix
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from shapely.geometry import Polygon, Point, LineString, MultiPoint
from shapely.ops import unary_union
root=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
src=root/'preview/map-3d/level';layout=root/'docs/research/map-3d-07b-spatial/layout.json'
raw=root/'preview/map-3d-07b-spatial/gardens_spatial_02.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(layout)=='8948f06fbc6d86bbc0df62964fb660ae635e51af44eddd66bd422938167e3f02'
assert sha(raw)=='87c16e287faa6509b6292777e37486673f82630af529c1b54453f34d1eed62bc'
D=json.loads(layout.read_text())
records={r['id']:{**r,'sha256':r['files'][0]['sha256'],'bytes':r['files'][0]['bytes']} for r in json.loads((src/'source-receipt.json').read_text())}
records.update({r['id']:r for r in json.loads((src/'supplemental-receipt.json').read_text())})
cache=out.parent/'art-sources';cache.mkdir(exist_ok=True)
def fetch(name,rec,ext):
    p=cache/(name+ext)
    if not p.exists():
        with urllib.request.urlopen(urllib.request.Request(rec['sourceURL'],headers={'User-Agent':'AshesThrone-07B-art/1'}),timeout=120) as f:p.write_bytes(f.read(rec['bytes']+1))
    assert p.stat().st_size==rec['bytes'] and sha(p)==rec['sha256'],name
    return p
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(raw));bpy.context.view_layer.update()
base=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(base)==103,len(base)
art=bpy.data.collections.new('AUTHORED art - CC BY-SA 3.0');bpy.context.scene.collection.children.link(art)
templates={};originals=[];proof=[]
def bounds(entries):
    pts=[m@Vector(c) for o,m in entries for c in o.bound_box]
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
for name in ['house','farmstead','storehouse','market','cliff','cliff2','olive','scrub','boulder']:
    path=fetch(name,records[name],'.glb');before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
    imported=[o for o in bpy.data.objects if o not in before]
    entries=[(o,o.matrix_world.copy()) for o in imported if o.type=='MESH']
    assert entries and all(o.data.materials for o,_ in entries),name
    templates[name]=entries;originals.extend(imported)
    for o in imported:
        for c in list(o.users_collection):c.objects.unlink(o)
def normalized(asset):
    e=templates[asset];lo,hi=bounds(e)
    local=Matrix.Translation(-(lo+hi)/2)
    if hi.y-lo.y>hi.x-lo.x:local=Matrix.Rotation(math.pi/2,4,'Z')@local
    return [(o,local@m) for o,m in e]
def place(name,asset,x,y,z,w,d,h,yaw,top=False,limit=1.6):
    e=normalized(asset);lo,hi=bounds(e);dim=hi-lo
    # Fit the whole actual model inside the approved oriented footprint.
    rawscale=[w/dim.x,d/dim.y,h/dim.z];low=min(rawscale)
    scale=[min(v,low*limit) for v in rawscale]
    tr=Matrix.Rotation(yaw,4,'Z')@Matrix.Diagonal(Vector((*scale,1)))
    e=[(o,tr@m) for o,m in e];lo,hi=bounds(e)
    move=Matrix.Translation(Vector((x-(lo.x+hi.x)/2,y-(lo.y+hi.y)/2,z-(hi.z if top else lo.z))))
    placed=[]
    for j,(o,m) in enumerate(e):
        c=o.copy();c.parent=None;c.animation_data_clear();c.name=name+'_'+str(j);art.objects.link(c);c.matrix_world=move@m;placed.append((c,c.matrix_world.copy()))
    lo,hi=bounds(placed)
    hull=MultiPoint([(v.x,v.y) for o,m in placed for v in [m@Vector(q) for q in o.bound_box]]).convex_hull
    tris=0
    for o,_ in placed:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    proof.append({'name':name,'asset':asset,'sourceSHA256':records[asset]['sha256'],'bounds':[list(lo),list(hi)],'triangles':tris,'scale':scale})
    return hull,lo,hi,placed
levels={k:Polygon(v['poly']) for k,v in D['levels'].items()}
routes={k:unary_union([LineString(r['points']).buffer(r['width']/2+.25) for r in D['routes'] if r['level']==k]) for k in levels}
links=unary_union([LineString([p[:2] for p in r['points']]).buffer(r['width']/2+.35,join_style=2) for r in D['routes'] if r['level']=='link'])
walk=unary_union([*levels.values(),links])
# Same 25 building lots, real authored structures. No massing boxes left visible.
for i,rec in enumerate(D['buildings']):
    q=Polygon(rec['footprint']);a,b,c,d=rec['footprint'];w=math.dist(a,b);dep=math.dist(b,c);yaw=math.atan2(b[1]-a[1],b[0]-a[0])
    x,y=q.centroid.coords[0];z=D['levels'][rec['level']]['z']
    if dep>w:w,dep=dep,w;yaw+=math.pi/2
    # Two distinct residential silhouettes; service buildings use utility models.
    asset='storehouse' if rec['style']=='store' else ('farmstead' if rec['style']=='shed' else ('house' if i%4!=3 else 'storehouse'))
    # Alternate entrances within the same lot, with the warehouse facing its main courtyard.
    if rec['id']=='warehouse' or i%3==1:yaw+=math.pi
    hull,lo,hi,_=place('building_art_'+rec['id'],asset,x,y,z-.025,w*.98,dep*.98,rec['height'],yaw)
    assert q.buffer(.015).covers(hull),(rec['id'],'model outside footprint')
    assert abs(lo.z-(z-.025))<.002 and hi.z<=z+rec['height']+.01,rec['id']
    old=[o for o in base if o.name in ('building_'+rec['id']+'_top','building_'+rec['id']+'_sides')]
    assert len(old)==2,(rec['id'],[o.name for o in old])
    for o in old:o.hide_render=True;o.hide_set(True)
# Authored geology: a continuous base remains, decorated with overlapping real rock
# silhouettes only where they cannot overhang a playable terrace or link.
ridge=Polygon(D['rock']).difference(walk.buffer(.4))
ridge_lots=[(72,10,12,8,7,18),(85,12,13,9,8,43),(98,14,12,9,7,72),(105,24,10,8,7,105),(92,27,15,12,8,15),(78,29,12,9,6,82),(86,38,10,7,5,120),(102,39,9,7,6,30)]
def rectangle(x,y,w,d,yaw):
    cs,sn=math.cos(yaw),math.sin(yaw)
    return Polygon([(x+u*cs-v*sn,y+u*sn+v*cs) for u,v in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]])
for i,(x,y,w,d,h,angle) in enumerate(ridge_lots):
    yaw=math.radians(angle)
    while w>=3 and not ridge.covers(rectangle(x,y,w,d,yaw)):w*=.85;d*=.85
    if w<3:continue
    z=17+5*math.exp(-((x-86)/26)**2-((y-23)/23)**2)
    hull,lo,hi,_=place('ridge_art_%02d'%i,'cliff' if i%2 else 'cliff2',x,y,z-4,w,d,h,yaw,limit=2.4)
    assert ridge.buffer(.02).covers(hull)
# Staggered rock strata in the gorge below the shared support. No isolated pillars
# at walk height. Shape follows the actual outer lip; stays below all playing levels.
for i,(x,y,w,d,h,angle) in enumerate([(10,48,16,10,19,65),(18,77,18,11,21,30),(38,88,17,12,23,12),(57,108,22,12,24,9),(81,112,23,15,26,-8),(104,104,19,13,23,-25),(130,85,21,12,24,-15),(149,68,16,10,20,80),(153,40,17,11,19,85),(151,16,19,12,19,35),(110,8,19,12,23,-20),(42,3,22,11,19,5)]):
    place('gorge_stratum_%02d'%i,'cliff2' if i%2 else 'cliff',x,y,-1.0,w,d,h,math.radians(angle),top=True,limit=2.8)
# Gardens are actual planted pockets, not obstacles scattered through routes.
for i,(key,coords) in enumerate(D['gardens']):
    q=Polygon(coords);safe=q.intersection(levels[key]).difference(routes[key].union(links))
    if safe.is_empty:continue
    p=safe.representative_point();rad=min(1.7,p.distance(safe.boundary)*.88);z=D['levels'][key]['z']
    if rad>.65:
        asset='olive' if rad>1.05 else 'scrub'
        hull,lo,hi,_=place('plant_%02d'%i,asset,p.x,p.y,z-.02,rad*1.35,rad*1.35,3.8 if asset=='olive' else 1.3,0,limit=1.5)
        assert safe.buffer(.02).covers(hull)
    # Low shrubs, fitted entirely into the remaining bed.
    for j,t in enumerate((.25,.75)):
        x=p.x+(q.centroid.x-p.x)*t+(-1 if j==0 else 1)*.65;y=p.y+(q.centroid.y-p.y)*t
        if not safe.covers(Point(x,y).buffer(.48)) or math.hypot(x-p.x,y-p.y)<rad*.65+.35:continue
        hull,_,_,_=place('plant_%02d_%d'%(i,j),'scrub',x,y,z,.6,.6,.75,0)
        assert safe.buffer(.02).covers(hull)
assert len([p for p in proof if p['name'].startswith('building_art_')])==25
# Textured surfaces replace flat colour while the original mesh positions remain.
# Every generated texture is adapted from the verified licensed source image.
gr=json.loads((src/'ground-receipt.json').read_text());groundfile=fetch('ground',gr,'.png')
ground=Image.open(groundfile).convert('RGB')
def tint(im,factors,sat=1):
    im=ImageEnhance.Color(im).enhance(sat)
    return Image.merge('RGB',tuple(c.point(lambda v:min(255,round(v*f))) for c,f in zip(im.split(),factors)))
def material(name,imgpath,rough=.95):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;nt=mat.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(imgpath));tex.extension='REPEAT'
    bsdf=nt.nodes.get('Principled BSDF');nt.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=rough
    return mat
def uv_project(o,func,mat):
    mesh=o.data;uv=mesh.uv_layers.active or mesh.uv_layers.new(name='World UV')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            p=o.matrix_world@mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=func(p,poly)
    mesh.materials.clear();mesh.materials.append(mat)
    for poly in mesh.polygons:poly.material_index=0
def image_variant(name,factors,sat):
    p=out/(name+'.jpg');tint(ground.resize((512,512)),factors,sat).save(p,quality=90);return material(name,p)
stone=image_variant('weathered_stone',(.72,.74,.72),.25)
stairs=image_variant('worn_steps',(.94,.92,.86),.32)
soil=image_variant('planting_soil',(.48,.57,.40),.7)
# Select an actual authored rock material for the continuous terrain sides.
rockmat=next((m for o,_ in templates['cliff'] for m in o.data.materials if m and m.use_nodes and any(n.type=='TEX_IMAGE' and n.image for n in m.node_tree.nodes)),None)
assert rockmat is not None,'No actual rock texture'
for key,q in levels.items():
    xmin,ymin,xmax,ymax=q.bounds;W=1024;H=max(256,round(W*(ymax-ymin)/(xmax-xmin)))
    H=min(1024,H)
    tile=ground.resize((max(24,round(3.2*W/(xmax-xmin))),max(24,round(3.2*H/(ymax-ymin)))))
    im=Image.new('RGB',(W,H))
    for yy in range(0,H,tile.height):
        for xx in range(0,W,tile.width):im.paste(tile,(xx,yy))
    # A softer, desaturated warm stone surface, paths naturally worn lighter.
    under=tint(im,((.82,.81,.76) if key!='garden' else (.65,.72,.56)),.55)
    mask=Image.new('L',(W,H));draw=ImageDraw.Draw(mask)
    def pix(p):return (round((p[0]-xmin)/(xmax-xmin)*(W-1)),round((ymax-p[1])/(ymax-ymin)*(H-1)))
    for r in D['routes']:
        if r['level']!=key:continue
        pts=[pix(p) for p in r['points']];width=max(2,round(r['width']*W/(xmax-xmin)))
        draw.line(pts,fill=235,width=width,joint='curve')
        for px,py in pts:draw.ellipse((px-width/2,py-width/2,px+width/2,py+width/2),fill=235)
    im=Image.composite(tint(im,(1.02,.99,.92),.30),under,mask.filter(ImageFilter.GaussianBlur(6)))
    p=out/('terrace_'+key+'.jpg');im.save(p,quality=91,subsampling=0)
    mat=material('Ground '+key,p)
    obj=next(o for o in base if o.name=='terrace_'+key+'_top')
    uv_project(obj,lambda p,poly:((p.x-xmin)/(xmax-xmin),(p.y-ymin)/(ymax-ymin)),mat)
# The coloured line overlays from the massing are no longer rendered.
for o in base:
    if o.name.startswith('building_'):continue
    if o.name.startswith('street_paving_'):o.hide_render=True;o.hide_set(True);continue
    if o.name.startswith('terrace_') and o.name.endswith('_top'):continue
    if o.name.startswith('garden_'):mat=soil
    elif o.name.endswith('_walking_surface') or o.name.endswith('_risers'):mat=stairs
    elif o.name.endswith('_sides') or o.name.endswith('_support') or o.name.startswith('high_rock_rib') or o.name.startswith('shoulder_') or o.name.startswith('continuous_bedrock'):mat=rockmat
    else:mat=stone
    def proj(p,poly):
        if abs(poly.normal.z)>.5:return (p.x/3.5,p.y/3.5)
        return ((p.x if abs(poly.normal.y)>.5 else p.y)/4.5,p.z/4.5)
    uv_project(o,proj,mat)
# Remove replaced masses and obsolete coloured road overlays, not the original terrain.
removed=[o for o in base if o.hide_render]
assert len([o for o in removed if o.name.startswith('building_')])==50
for o in removed:bpy.data.objects.remove(o,do_unlink=True)
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
# Strip any orphan glTF roots, but retain real mesh transforms.
bpy.context.view_layer.update()
# Freeze all texture inputs with portable packed bytes. Source images are original
# licensed art; resample only oversized images, never manufacture fake models.
for im in list(bpy.data.images):
    if im.users<1 or im.size[0]<1 or im.size[1]<1:continue
    if max(im.size)>1024:
        k=1024/max(im.size);im.scale(max(1,round(im.size[0]*k)),max(1,round(im.size[1]*k)))
        path=out/('tex_'+hashlib.sha256(im.name.encode()).hexdigest()[:14]+'.png')
        im.filepath_raw=str(path);im.file_format='PNG';im.save();im.pack()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'gardens_art_01.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'gardens_art_01.glb'),export_format='GLB',export_copyright='Environment art Wildfire Games CC BY-SA 3.0, converted by CodePawl, adapted by Ashes Throne')
# Read exported GLB JSON for actual render budget, not source object counts.
import struct
g=out/'gardens_art_01.glb';rawbytes=g.read_bytes();n,kind=struct.unpack_from('<II',rawbytes,12);assert kind==0x4e4f534a
j=json.loads(rawbytes[20:20+n]);assert j['asset']['version']=='2.0'
tris=sum(j['accessors'][p['indices']]['count']//3 if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']//3 for node in j['nodes'] if 'mesh' in node for p in j['meshes'][node['mesh']]['primitives'])
assert 10000<tris<150000,tris
assert g.stat().st_size<35*1024*1024,g.stat().st_size
report={'layoutSHA256':sha(layout),'baselineGLBSHA256':sha(root/'preview/map-3d-07b-spatial/gardens_spatial_02.glb'),'artGLBSHA256':sha(g),'bytes':g.stat().st_size,'trianglesWithInstances':tris,'images':len(j.get('images',[])),'placements':proof,'removedMasses':50,'scope':'Art preview only; exact baseline retained separately; no navmesh or actual traversal.'}
(out/'art-manifest.json').write_text(json.dumps(report,indent=2))
for n in ['ATTRIBUTION.txt','LICENSE-upstream.txt','README-source.md','source-receipt.json','supplemental-receipt.json','ground-receipt.json','dataset-revision.json']:shutil.copyfile(src/n,out/n)
with (out/'ATTRIBUTION.txt').open('a') as f:f.write('\n07B art 01: adapted layout, UV surfaces, model transforms and texture resolution. Adapted environment art remains CC BY-SA 3.0; exact source and recipe in docs/research/map-3d-07b-spatial.\n')
print(json.dumps({k:v for k,v in report.items() if k!='placements'},indent=2))

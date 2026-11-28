"""One real upper-street A/B pilot, not a new layout and not final art.
Use original CC0 modular mesh pieces, not procedural primary architecture.
"""
import bpy, json, math, sys, pathlib, hashlib, urllib.request, urllib.parse, zipfile, re, shutil
from mathutils import Vector, Matrix
from shapely.geometry import Polygon, MultiPoint
root=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
layout=root/'docs/research/map-3d-07b-spatial/layout.json'
base=root/'preview/map-3d-07b-art/gardens_art_01.glb'
assert sha(layout)=='8948f06fbc6d86bbc0df62964fb660ae635e51af44eddd66bd422938167e3f02'
assert sha(base)=='e5fda84d3e07e0f2fab44bb1a5a5d03faf0f9984908507d8585df1a93204e620'
D=json.loads(layout.read_text())
url='https://opengameart.org/sites/default/files/medieval_village_megakitstandard.zip'
cache=out.parent/'modular-source';cache.mkdir(exist_ok=True)
archive=cache/'standard.zip'
if not archive.exists():
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AshesThrone-ART03/1.0'}),timeout=120) as response:
        assert urllib.parse.urlparse(response.geturl()).hostname in {'opengameart.org','www.opengameart.org'}
        with archive.open('wb') as f:
            n=0
            while chunk:=response.read(1024*1024):
                n+=len(chunk);assert n<180_000_000;f.write(chunk)
src=cache/'extracted';src.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    infos=z.infolist();assert len(infos)<10000 and sum(i.file_size for i in infos)<800_000_000
    for i in infos:
        dest=(src/i.filename).resolve();assert dest.is_relative_to(src)
        assert not (i.external_attr>>16)&0o170000==0o120000
        if not i.is_dir():
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(i))
files=sorted(p for p in src.rglob('*') if p.suffix.lower() in {'.gltf','.glb'})
# Prefer GLB if both representations of the same model exist.
by={}
for p in files:
    k=p.stem.lower()
    if k not in by or p.suffix.lower()=='.glb':by[k]=p
files=list(by.values())
receipt={'sourcePage':'https://opengameart.org/content/medieval-village-megakit','authorPage':'https://quaternius.com/packs/medievalvillagemegakit.html','author':'Quaternius','license':'CC0-1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/','downloadURL':url,'archiveSHA256':sha(archive),'archiveBytes':archive.stat().st_size,'gltfInventory':[str(p.relative_to(src)) for p in files]}
(out/'source-receipt.json').write_text(json.dumps(receipt,indent=2))
assert len(files)>20,'No individual modular glTF files; inspect source receipt'
# Actual source inventory, not invented file paths. Match exact semantic roles.
def name(p):return re.sub(r'[^a-z0-9]+',' ',p.stem.lower())
def role(p,kind):
    n=name(p);wall='wall' in n
    bad=any(t in n for t in ['broken','ruin','corner','diagonal','curved','fence','interior','half','trim','roof','gable','top','pillar'])
    if kind=='wall':return wall and not bad and not any(t in n for t in ['door','window','arch','hole'])
    if kind=='doorwall':return wall and not bad and ('door' in n or 'doorway' in n)
    if kind=='windowwall':return wall and not bad and 'window' in n
    if kind=='roof':return 'roof' in n and not any(t in n for t in ['corner','end','gable','cap','ridge','chimney','trim','broken','hole','transition','half'])
    if kind=='door':return 'door' in n and not wall and not any(t in n for t in ['frame','handle','double','broken','arch'])
    if kind=='window':return 'window' in n and not wall and not any(t in n for t in ['frame','broken','arch'])
    return False
def rank(p,kind):
    n=name(p)
    return (0 if ('stone' in n or 'plaster' in n) else 1,0 if any(t in n for t in ['straight','plain','standard','basic']) else 1,len(n),n)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(base));bpy.context.view_layer.update()
scene=bpy.context.scene
original=[o for o in scene.objects if o.type=='MESH']
assert len(original)>150
# Fixed comparison cameras; actual scene at character-adjacent scale.
cams=[('street',(32,2,23),(24,25,14.4),25),('crossroads',(48,44,28),(32,25,14.0),34)]
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=932;scene.render.resolution_y=430;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review sky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.42,.48,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.rotation_euler=Vector((-.5,.65,-1)).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.8;sun.data.angle=.13
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.clip_end=350
def render(stage):
    for k,p,t,width in cams:
        camera.location=Vector(p);camera.rotation_euler=(Vector(t)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=width
        scene.render.filepath=str(out/(stage+'-'+k+'.png'));bpy.ops.render.render(write_still=True)
render('baseline')
# Keep source models off scene while using linked original mesh data.
art=bpy.data.collections.new('CC0 modular upper-street pilot');scene.collection.children.link(art)
templates={};source_objects=[];selected={}
def bounds(e):
    pts=[m@Vector(c) for o,m in e for c in o.bound_box]
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
def acquire(kind,required=True):
    candidates=sorted([p for p in files if role(p,kind)],key=lambda p:rank(p,kind))
    diagnostics=[]
    for p in candidates[:12]:
        before=set(bpy.data.objects)
        try:
            bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
            objects=[o for o in bpy.data.objects if o not in before]
            e=[(o,o.matrix_world.copy()) for o in objects if o.type=='MESH']
            if not e:raise ValueError('no meshes')
            lo,hi=bounds(e)
            if hi.y-lo.y>hi.x-lo.x:e=[(o,Matrix.Rotation(math.pi/2,4,'Z')@m) for o,m in e]
            lo,hi=bounds(e);dim=hi-lo
            if min(dim)<.015 or not all(o.data.materials for o,_ in e):raise ValueError('invalid dimensions/materials')
            if kind in {'wall','doorwall','windowwall','door','window'} and (dim.y>dim.x*.65 or dim.y>dim.z*.65):raise ValueError('not a vertical panel')
            if kind=='roof' and (dim.z>max(dim.x,dim.y)*1.25 or dim.z<.05):raise ValueError('not roof profile')
            templates[kind]=e;source_objects.extend(objects)
            for o in objects:
                for c in list(o.users_collection):c.objects.unlink(o)
            selected[kind]={'path':str(p.relative_to(src)),'sha256':sha(p),'dimensions':list(dim),'triangles':sum(len(o.data.polygons) for o,_ in e)}
            return True
        except Exception as exc:
            diagnostics.append({'path':str(p.relative_to(src)),'error':str(exc)})
            for o in [o for o in bpy.data.objects if o not in before]:bpy.data.objects.remove(o,do_unlink=True)
    selected[kind]={'missing':True,'candidates':diagnostics}
    if required:
        (out/'selected-modules.json').write_text(json.dumps(selected,indent=2));raise RuntimeError('No valid authored '+kind+' module; inspect inventory')
    return False
acquire('wall');acquire('roof')
has_door=acquire('doorwall',False)
if not has_door:acquire('door')
has_window=acquire('windowwall',False)
if not has_window:acquire('window')
(out/'selected-modules.json').write_text(json.dumps(selected,indent=2))
placements=[]
def fit(kind,name,x,y,z,w,d,h,yaw,lot):
    e=templates[kind];lo,hi=bounds(e);dim=hi-lo
    tr=Matrix.Rotation(yaw,4,'Z')@Matrix.Diagonal(Vector((w/dim.x,d/dim.y,h/dim.z,1)))@Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
    tr=Matrix.Translation(Vector((x,y,z)))@tr
    copies=[]
    for i,(o,m) in enumerate(e):
        c=o.copy();c.parent=None;c.animation_data_clear();c.name=name+'_'+str(i);art.objects.link(c);c.matrix_world=tr@m;copies.append((c,c.matrix_world.copy()))
    hull=MultiPoint([(v.x,v.y) for o,m in copies for v in [m@Vector(q) for q in o.bound_box]]).convex_hull
    assert lot.buffer(.025).covers(hull),(name,'outside accepted footprint')
    lo,hi=bounds(copies);placements.append({'role':kind,'name':name,'bounds':[list(lo),list(hi)]})
# A single source roof panel may be a sloping half roof; inspect the actual high
# vertex position, then compose paired authored pieces if needed.
roof=templates['roof'];rlo,rhi=bounds(roof);rd=rhi-rlo
high=[m@v.co for o,m in roof for v in o.data.vertices if (m@v.co).z>rhi.z-.10*rd.z]
high_y=sum(p.y for p in high)/max(1,len(high));relative=(high_y-(rhi.y+rlo.y)/2)/rd.y
half_roof=abs(relative)>.20
selected['roof']['profile']='paired authored halves' if half_roof else 'single authored roof'
# Five existing building footprints on the upper street, nothing outside the
# accepted lot and no change to the original terrain/stair/link meshes.
ids={'home01','home02','home03','home04','home06'}
# Resolve all original objects before any removal; Blender invalidates RNA handles.
original_by_lot={lot:[o for o in original if o.name.startswith('building_art_'+lot+'_')] for lot in sorted(ids)}
assert all(original_by_lot.values()),('Missing ART02 lots',[lot for lot,objects in original_by_lot.items() if not objects])
replaced=[]
for b in D['buildings']:
    if b['id'] not in ids:continue
    q=Polygon(b['footprint']);a,c,d,e=b['footprint']
    w=math.dist(a,c);dep=math.dist(c,d);yaw=math.atan2(c[1]-a[1],c[0]-a[0])
    x,y=q.centroid.coords[0];z=D['levels'][b['level']]['z'];H=b['height']
    if dep>w:w,dep=dep,w;yaw+=math.pi/2
    # Distinct roof proportions and facade panel layouts within the accepted mass.
    roofh=min(1.7,H*.30);wallh=H-roofh;th=.33
    cs,sn=math.cos(yaw),math.sin(yaw)
    def world(u,v):return x+u*cs-v*sn,y+u*sn+v*cs
    def facade(length,offset,angle,front=False):
        n=max(1,round(length/2.5));panel=length/n
        for j in range(n):
            pos=(j+.5)*panel-length/2
            # The outward-facing facade has the actual door/window source models.
            kind='doorwall' if front and j==n//2 and has_door else ('windowwall' if has_window and j%2==0 else 'wall')
            if front and j==n//2 and not has_door:
                # Reserve a true doorway rather than overlay a door on solid wall.
                gap=min(.95,panel*.55);side=(panel-gap)/2
                for sign in (-1,1):
                    xx,yy=world(*offset(pos+sign*(gap+side)/2))
                    fit('wall','mod_'+b['id']+'_doorjamb_'+str(sign),xx,yy,z,side*.995,th,wallh,yaw+angle,q)
                xx,yy=world(*offset(pos));fit('door','mod_'+b['id']+'_door',xx,yy,z,gap,th*.75,min(wallh,2.2),yaw+angle,q)
                continue
            xx,yy=world(*offset(pos));fit(kind,'mod_'+b['id']+'_wall_'+str(angle)+'_'+str(j),xx,yy,z,panel*.997,th,wallh,yaw+angle,q)
    facade(w-.25,lambda u:(u,-dep/2+.24),0,True)
    facade(w-.25,lambda u:(-u,dep/2-.24),math.pi)
    facade(dep-.85,lambda u:(w/2-.24,u),math.pi/2)
    facade(dep-.85,lambda u:(-w/2+.24,-u),-math.pi/2)
    if half_roof:
        for side in (-1,1):
            xx,yy=world(0,side*dep/4)
            turn=0 if side*relative<0 else math.pi
            fit('roof','mod_'+b['id']+'_roof_'+str(side),xx,yy,z+wallh-.04,w*.99,dep*.495,roofh,yaw+turn,q)
    else:fit('roof','mod_'+b['id']+'_roof',x,y,z+wallh-.04,w*.99,dep*.99,roofh,yaw,q)
    replaced.append(b['id'])
# Finish all replacements and footprint assertions before removing baseline art.
assert set(replaced)==ids and len(replaced)==len(ids),replaced
for lot in sorted(ids):
    for o in original_by_lot[lot]:bpy.data.objects.remove(o,do_unlink=True)
for o in source_objects:bpy.data.objects.remove(o,do_unlink=True)
assert not any(o.name.startswith(tuple('building_art_'+lot+'_' for lot in ids)) for o in scene.objects), 'Baseline replacements remain'
bpy.context.view_layer.update()
(out/'selected-modules.json').write_text(json.dumps(selected,indent=2))
(out/'placement-report.json').write_text(json.dumps({'layoutSHA256':sha(layout),'baselineSHA256':sha(base),'replacedLots':sorted(ids),'placements':placements,'scope':'Same camera, five building lots; unapproved candidate only'},indent=2))
render('candidate')
# Editable source and exact GLB for independent inspection; never publish to main.
bpy.data.objects.remove(camera,do_unlink=True);bpy.data.objects.remove(sun,do_unlink=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'modular-street.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'modular-street.glb'),export_format='GLB',export_copyright='Existing adapted Wildfire Games CC BY-SA 3.0 art; new Quaternius modular source CC0')
g=out/'modular-street.glb'
import struct
data=g.read_bytes();n,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a
j=json.loads(data[20:20+n]);tris=sum(j['accessors'][p['indices']]['count']//3 if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']//3 for node in j['nodes'] if 'mesh' in node for p in j['meshes'][node['mesh']]['primitives'])
(out/'candidate-metrics.json').write_text(json.dumps({'bytes':len(data),'triangles':tris,'sha256':sha(g),'images':len(j.get('images',[])),'replacedLots':len(ids),'artStatus':'unreviewed'},indent=2))
assert tris<180000 and len(data)<45*1024*1024,'Candidate outside provisional mobile budget'
shutil.copyfile(root/'preview/map-3d-07b-art/ATTRIBUTION.txt',out/'ATTRIBUTION.txt')
with (out/'ATTRIBUTION.txt').open('a') as f:f.write('\nNew pilot modules: Quaternius, Medieval Village MegaKit Standard, CC0 1.0; '+receipt['authorPage']+'; original archive and module hashes in source-receipt.json and selected-modules.json.\n')

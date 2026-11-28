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
for name in ['house','farmstead','storehouse','cliff','cliff2','olive','scrub','market','boulder']:
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
    tr=Matrix.Diagonal(Vector((*scale,1)))
    e=[(o,tr@m) for o,m in e];lo,hi=bounds(e)
    # Centre BEFORE yaw: asymmetric authored silhouettes must not shift out of
    # their approved oriented rectangle when their world-axis AABB changes.
    center=Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-(hi.z if top else lo.z))))
    e=[(o,Matrix.Rotation(yaw,4,'Z')@center@m) for o,m in e]
    move=Matrix.Translation(Vector((x,y,z)))
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
    asset='storehouse' if rec['style']=='store' else ('farmstead' if rec['style']=='shed' else 'house')
    # Alternate entrances within the same lot, with the warehouse facing its main courtyard.
    if rec['id']=='warehouse' or i%3==1:yaw+=math.pi
    hull,lo,hi,_=place('building_art_'+rec['id'],asset,x,y,z-.025,w*.98,dep*.98,rec['height'],yaw,limit=2.1 if rec['id']=='warehouse' else 1.65)
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
# ART-02: add actual authored set pieces in manually selected residual lots,
# preserving the established buildings, planned streets, gardens and links.
lots={k:unary_union([Polygon(o['footprint']).buffer(.5) for o in D['buildings'] if o['level']==k]) for k in levels}
beds={k:unary_union([Polygon(c).buffer(.2) for l,c in D['gardens'] if l==k]) for k in levels}
safe_by_level={k:q.buffer(-.5).difference(routes[k].buffer(.25).union(links.buffer(.15)).union(lots[k]).union(beds[k])) for k,q in levels.items()}
detail_plan=[
 ('upper','market',55,14,5,4,3.8,0),('upper','farmstead',15,39,4,3,3.2,0),('upper','olive',39,34,2.4,1.8,4.0,0),
 ('work','market',55,73,6,4,3.9,0),('work','market',20,53,5,4,3.5,0),('work','farmstead',30,77,5,3,3.2,0),('work','boulder',87,53,3.2,2.4,1.6,0),
 ('garden','olive',75,85,4.5,3,5.1,0),('garden','olive',91,101,3.8,2.8,4.7,0),('garden','olive',87,89,2.8,1.8,3.8,0),
 ('east','market',112,73,5,4,3.7,0),('east','olive',134,72,2.7,1.9,3.9,0),('exit','olive',122,33,2.7,1.9,3.5,0),('exit','boulder',150,33,2.7,1.9,1.4,0)
]
detail_hulls={k:[] for k in levels}
for i,(key,asset,x,y,w,d,h,yaw) in enumerate(detail_plan):
    safe=safe_by_level[key];angle=math.radians(yaw);q=rectangle(x,y,w,d,angle)
    assert safe.covers(q),(key,'detail lot obstructs planned route',i)
    assert all(not q.intersects(other) for other in detail_hulls[key]),('detail overlap',i)
    hull,lo,hi,_=place('detail_%02d_%s'%(i,asset),asset,x,y,D['levels'][key]['z']-.02,w,d,h,angle,limit=1.8)
    assert q.buffer(.02).covers(hull),('detail model outside lot',i)
    detail_hulls[key].append(hull.buffer(.25))
# Extra authored natural strata dress the actual exposed terrain faces.
# They are entirely below the respective walking surface, never generate
# collision or alter the frozen geometry. Reject any overlap at a lower terrace.
for i,(key,x,y,w,d,h,ang) in enumerate([
 ('upper',17,43,12,5,8,15),('upper',43,47,10,5,8,-8),
 ('work',21,74,13,6,9,38),('work',69,81,12,6,7,-4),
 ('garden',47,100,11,6,12,35),('garden',76,109,14,7,15,0),('garden',98,98,12,6,14,-40),
 ('east',109,78,10,5,10,30),('east',136,76,11,6,11,-45),
 ('exit',151,39,11,6,9,-65)]):
    z=D['levels'][key]['z'];angle=math.radians(ang);q=rectangle(x,y,w,d,angle)
    lower=unary_union([p for k,p in levels.items() if D['levels'][k]['z']<z-.65])
    if q.intersects(lower.buffer(.35)) or q.intersects(links.buffer(.2)):continue
    place('face_stratum_%02d'%i,'cliff2' if i%2 else 'cliff',x,y,z-.65,w,d,h,angle,top=True,limit=2.6)
# Gardens are actual planted pockets, not obstacles scattered through routes.
for i,(key,coords) in enumerate(D['gardens']):
    q=Polygon(coords);safe=q.intersection(levels[key]).difference(routes[key].union(links))
    if safe.is_empty:continue
    p=safe.representative_point();rad=min(2.2,p.distance(safe.boundary)*.9);z=D['levels'][key]['z']
    if rad>.65:
        asset='olive' if rad>1.05 else 'scrub'
        hull,lo,hi,_=place('plant_%02d'%i,asset,p.x,p.y,z-.02,rad*1.4,rad*1.4,4.5 if asset=='olive' else 1.5,0,limit=1.5)
        assert safe.buffer(.02).covers(hull)
    # Low shrubs, fitted entirely into the remaining bed.
    for j,t in enumerate((.15,.42,.68,.85)):
        x=p.x+(q.centroid.x-p.x)*t+(-1 if j%2==0 else 1)*(.75+j*.35);y=p.y+(q.centroid.y-p.y)*t
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
# Secondary hand-authored architectural trim. Main buildings and cliff meshes
# remain sourced art; these low masonry pieces are functional level geometry.
# Build all trim as one mesh per material, not hundreds of individual draw calls.
from shapely.geometry.polygon import orient
trim_v=[];trim_f=[];trim_uv=[];coping_v=[];coping_f=[];coping_uv=[]
def add_prism(poly,z0,z1,vs,fs):
    p=orient(poly,sign=1);pts=list(p.exterior.coords)[:-1];assert len(pts)==4
    idx=len(vs);vs.extend([(x,y,z) for z in (z0,z1) for x,y in pts])
    fs.extend([(idx+4,idx+5,idx+6,idx+7),(idx+3,idx+2,idx+1,idx)])
    for i in range(4):j=(i+1)%4;fs.append((idx+i,idx+j,idx+4+j,idx+4+i))
def wall(a,b,z,width,height):
    line=LineString([a,b]);l=line.length
    if l<.65:return False
    x,y=line.interpolate(.5,normalized=True).coords[0];yaw=math.atan2(b[1]-a[1],b[0]-a[0])
    body=rectangle(x,y,l,width,yaw);cap=rectangle(x,y,l+.025,width+.08,yaw)
    add_prism(body,z-.02,z+height-.12,trim_v,trim_f);add_prism(cap,z+height-.12,z+height,coping_v,coping_f)
    return True
# Garden bed borders emphasize cultivated plots, with open access on one side.
planter_count=0;parapet_count=0;wall_footprints=[]
for i,(key,coords) in enumerate(D['gardens']):
    p=Polygon(coords);z=D['levels'][key]['z'];edges=list(zip(coords,coords[1:]+coords[:1]))
    for j,(a,b) in enumerate(edges):
        if j==i%4:continue
        # Exact boundary, inset .14m; keep the path margin unobstructed.
        a=tuple(a);b=tuple(b);line=LineString([a,b]);cap=line.buffer(.21,cap_style=2)
        if not levels[key].buffer(-.025).covers(cap) or cap.intersects(routes[key].union(links).union(lots[key])):continue
        if wall(a,b,z,.25,.32):planter_count+=1;wall_footprints.append((key,cap))
# Low retaining/guard walls on exposed ledges only. Omit links and entrances.
# Sample the true top surfaces rather than fence across ramps or other levels.
deps=bpy.context.evaluated_depsgraph_get();bpy.context.view_layer.update()
for key in ['upper','work','garden','east','exit']:
    q=orient(levels[key],sign=1);z=D['levels'][key]['z'];pts=list(q.exterior.coords)
    exclusion=routes[key].union(links).union(lots[key]).union(beds[key]).union(unary_union(detail_hulls[key]))
    for a,b in zip(pts,pts[1:]):
        dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
        if L<3:continue
        nx,ny=-dy/L,dx/L
        # Avoid walls facing directly into an adjacent terrace or high bedrock.
        n=max(1,int(L/4.5))
        for j in range(n):
            t0=(j+.06)/n;t1=(j+.94)/n
            A=(a[0]+dx*t0+nx*.65,a[1]+dy*t0+ny*.65);B=(a[0]+dx*t1+nx*.65,a[1]+dy*t1+ny*.65)
            line=LineString([A,B]);cap=line.buffer(.25,cap_style=2)
            if not q.buffer(-.05).covers(cap) or cap.intersects(exclusion):continue
            if any(k==key and cap.intersects(c) for k,c in wall_footprints):continue
            mid=line.interpolate(.5,normalized=True);outside=Point(mid.x-nx*1.9,mid.y-ny*1.9)
            if any(k!=key and p.covers(outside) and D['levels'][k]['z']>=z-.8 for k,p in levels.items()):continue
            if Polygon(D['rock']).covers(outside):continue
            # Actual physical top must be at that height at both ends and middle.
            valid=True
            for x,y in [A,B,(mid.x,mid.y)]:
                hit,loc,normal,index,obj,matrix=bpy.context.scene.ray_cast(deps,Vector((x,y,z+.5)),Vector((0,0,-1)),distance=.85)
                if not hit or abs(loc.z-z)>.06 or obj.name!='terrace_'+key+'_top':valid=False;break
            if not valid:continue
            if wall(A,B,z,.38,.88):parapet_count+=1;wall_footprints.append((key,cap))
def trim_object(name,vs,fs,mat):
    if not fs:return
    m=bpy.data.meshes.new(name);m.from_pydata(vs,[],fs);m.update()
    o=bpy.data.objects.new(name,m);art.objects.link(o)
    uv_project(o,lambda p,poly:((p.x+p.y)/2.3,p.z/1.6) if abs(poly.normal.z)<.5 else (p.x/2.3,p.y/2.3),mat)
trim_object('secondary_masonry',trim_v,trim_f,rockmat)
trim_object('secondary_coping',coping_v,coping_f,stone)
assert planter_count>=8 and parapet_count>=8,(planter_count,parapet_count)
# Remove replaced masses and obsolete coloured road overlays, not the original terrain.
removed=[o for o in base if o.hide_render]
assert len([o for o in removed if o.name.startswith('building_')])==50
for o in removed:bpy.data.objects.remove(o,do_unlink=True)
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
# Strip any orphan glTF roots, but retain real mesh transforms.
bpy.context.view_layer.update()
# Adapt the specific source market player-colour atlas, using the earlier
# accepted C3 palette operation. Keep source neutral stone and alpha intact.
import array,colorsys
palette=[]
for im in bpy.data.images:
    if 'iber_struct_player_28588' not in im.name:continue
    pix=array.array('f',[0])*len(im.pixels);im.pixels.foreach_get(pix);count=0
    for i in range(0,len(pix),4):
        r,g,b=pix[i:i+3]
        if b>r*1.25 and b>g*1.15 and b-r>.12:
            h,ss,v=colorsys.rgb_to_hsv(max(0,r),max(0,g),max(0,b))
            nr,ng,nb=colorsys.hsv_to_rgb(.087,min(.46,ss*.7),v*.94)
            pix[i:i+3]=array.array('f',[nr,ng,nb]);count+=1
    if count:
        im.pixels.foreach_set(pix);im.update()
        p=out/'market-cloth-adapted.png';im.filepath_raw=str(p);im.file_format='PNG';im.save();im.pack()
        palette.append({'image':im.name,'recoloredPixels':count,'sha256':sha(p)})
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
report={'artRevision':2,'planterSegments':planter_count,'parapetSegments':parapet_count,'detailLots':len(detail_plan),'palette':palette,'layoutSHA256':sha(layout),'baselineGLBSHA256':sha(root/'preview/map-3d-07b-spatial/gardens_spatial_02.glb'),'artGLBSHA256':sha(g),'bytes':g.stat().st_size,'trianglesWithInstances':tris,'images':len(j.get('images',[])),'placements':proof,'removedMasses':50,'scope':'Art preview only; exact baseline retained separately; no navmesh or actual traversal.'}
(out/'art-manifest.json').write_text(json.dumps(report,indent=2))
for n in ['ATTRIBUTION.txt','LICENSE-upstream.txt','README-source.md','source-receipt.json','supplemental-receipt.json','ground-receipt.json','dataset-revision.json']:shutil.copyfile(src/n,out/n)
with (out/'ATTRIBUTION.txt').open('a') as f:f.write('\n07B art 02: additional authored set pieces, masonry trim, adapted layout, UV surfaces, model transforms and texture resolution. Adapted environment art remains CC BY-SA 3.0; exact source and recipe in docs/research/map-3d-07b-spatial.\n')
print(json.dumps({k:v for k,v in report.items() if k!='placements'},indent=2))

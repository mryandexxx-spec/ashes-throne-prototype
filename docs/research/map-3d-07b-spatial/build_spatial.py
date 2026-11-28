"""Translate accepted 07A sketch coordinates into actual metric 3D massing.
No story, battle logic, art assets or procedural final art. Y-up GLB output.
"""
import argparse, json, math, hashlib
from pathlib import Path
import numpy as np
import trimesh
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

ap=argparse.ArgumentParser();ap.add_argument('layout',type=Path);ap.add_argument('out',type=Path);args=ap.parse_args()
D=json.loads(args.layout.read_text());out=args.out;out.mkdir(parents=True,exist_ok=True)
scene=trimesh.Scene(); surfaces=[]; floors=[]; report={'source_sha256':hashlib.sha256(args.layout.read_bytes()).hexdigest(),'levels':{},'links':{},'buildings':{},'warnings':[]}

def polys(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for a in getattr(g,'geoms',[]) for p in polys(a)]
def rgba(c):
    if isinstance(c,str):return tuple(bytes.fromhex(c.lstrip('#')))+(255,)
    return tuple(c)+(255,) if len(c)==3 else tuple(c)
def mesh(name,verts,faces,color):
    v=np.asarray(verts,float); f=np.asarray(faces,int)
    m=trimesh.Trimesh(vertices=np.column_stack([v[:,0],v[:,2],-v[:,1]]),faces=f,process=False)
    # RH coordinate transform determinant +1. Uniform material per blockout object.
    m.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(baseColorFactor=np.asarray(rgba(color))/255.,metallicFactor=0,roughnessFactor=.94,doubleSided=True))
    scene.add_geometry(m,node_name=name,geom_name=name)
    return m

def shell(name,poly,h,bottom,topcolor,wallcolor):
    # Flat or piecewise-linear top over a valid polygon; walls to shared bedrock depth.
    vv=[];ff=[];wv=[];wf=[]
    for p in polys(poly):
        if p.area<1e-6:continue
        p=orient(p,sign=1)
        for tri in constrained_delaunay_triangles(p).geoms:
            if tri.area<1e-8:continue
            q=list(orient(tri,sign=1).exterior.coords)[:3];i=len(vv)
            vv.extend([(x,y,h(x,y)) for x,y in q]);ff.append((i,i+1,i+2))
        for ring in [p.exterior,*p.interiors]:
            c=list(ring.coords)
            for (x,y),(u,v) in zip(c,c[1:]):
                i=len(wv);wv.extend([(x,y,h(x,y)),(u,v,h(u,v)),(u,v,bottom),(x,y,bottom)])
                wf.extend([(i,i+2,i+1),(i,i+3,i+2)])
    if ff:mesh(name+'_top',vv,ff,topcolor)
    if wf:mesh(name+'_sides',wv,wf,wallcolor)

def top_surface(name,poly,z,color):
    v=[];f=[]
    for p in polys(poly):
        for tri in constrained_delaunay_triangles(p).geoms:
            if tri.area<1e-8:continue
            q=list(orient(tri,sign=1).exterior.coords)[:3];i=len(v);v.extend([(x,y,z) for x,y in q]);f.append((i,i+1,i+2))
    if f:mesh(name,v,f,color)

levels={k:Polygon(v['poly']) for k,v in D['levels'].items()}
links=[r for r in D['routes'] if r['level']=='link']
# Mitered cross sections yield one continuous strip; exactly share the endpoint
# boundaries with the corresponding terrace cutout. Do not scatter platforms.
strips={}
for r in links:
    p=np.asarray(r['points'],float)
    if r['name']=='ramp_w':
        # Preserve the accepted footprint, but flatten 1.8m at the street junction.
        # Original ramp crossed the entry street at a 0.13m depression.
        a,b=p[0],p[1];landing=a+(b-a)*(1.8/np.linalg.norm(b[:2]-a[:2]));landing[2]=a[2]
        p=np.insert(p,1,landing,axis=0)
    dirs=np.diff(p[:,:2],axis=0);dirs/=np.linalg.norm(dirs,axis=1)[:,None]
    normals=np.column_stack([-dirs[:,1],dirs[:,0]]); cross=[]
    for i,pt in enumerate(p):
        if i==0:n=normals[0]
        elif i==len(p)-1:n=normals[-1]
        else:
            n=normals[i-1]+normals[i]; n/=np.dot(n,normals[i])
        cross.append((pt[:2]+n*r['width']/2,pt[:2]-n*r['width']/2))
    poly=Polygon([tuple(a) for a,b in cross]+[tuple(b) for a,b in reversed(cross)])
    assert poly.is_valid and poly.area>0,r['name'];strips[r['name']]=(poly,p,cross)
link_mask=unary_union([v[0] for v in strips.values()]);rock=Polygon(D['rock']).difference(link_mask)
# The bedrock base physically joins the ledges, including the intervening slopes;
# only the lower mass, not a walkable surface or another level.
base=unary_union([*levels.values(),* [v[0] for v in strips.values()],Polygon(D['rock']),*[Polygon(s[1]) for s in D['slopes']]]).buffer(0)
assert base.geom_type=='Polygon',base.geom_type
shell('continuous_bedrock',base,lambda x,y:-7,-30,'#666c63','#4c5654')
# Non-walkable transitional rock shoulders, below the traversable terraces.
occupied=unary_union([*levels.values(),link_mask,rock])
for name,coords,z in D['slopes']:
    shape=Polygon(coords).difference(occupied);shell('shoulder_'+name,shape,lambda x,y,z=z:z,-7,'#8e9282','#777d73')
# High ridge belongs to the terrain; clipped from all playable road surfaces.
rock=rock.difference(unary_union([levels[k].buffer(0) for k in levels]))
def ridge_height(x,y):
    return 17.0+5.0*math.exp(-((x-86)/26)**2-((y-23)/23)**2)
shell('high_rock_rib',rock,ridge_height,-7,'#7f867d','#6d766d')
# Level overlap resolved in favour of the upper terrace, excluding physical link strips.
cleared={};cover=Polygon()
for key in sorted(levels,key=lambda k:D['levels'][k]['z'],reverse=True):
    q=levels[key].difference(link_mask).difference(cover);cleared[key]=q;cover=cover.union(levels[key])
    z=D['levels'][key]['z'];shell('terrace_'+key,q,lambda x,y,z=z:z,-7,D['levels'][key]['color'],'#85877b')
    floors.append((q,z,key));report['levels'][key]={'elevation':z,'top_area_m2':round(q.area,2)}
# Physical streets are full walkable surfaces, not navigation lines or mandatory rails.
for key,shape in cleared.items():
    rr=[LineString(r['points']).buffer(r['width']/2,cap_style=1,join_style=1) for r in D['routes'] if r['level']==key]
    if rr:top_surface('street_paving_'+key,unary_union(rr).intersection(shape),D['levels'][key]['z']+.015,'#d7c8aa')
# Actual stairs and ramps (solid underside and side faces) with no overlap into upper terraces.
for r in links:
    name=r['name'];poly,p,cross=strips[name];vv=[];ff=[];sides=[];sf=[];ris=[];rf=[];steps=0
    stair=name.startswith('stairs_')
    for i in range(len(p)-1):
        a,b=p[i],p[i+1];l0,r0=cross[i];l1,r1=cross[i+1];n=max(1,math.ceil(abs(b[2]-a[2])/.18)) if stair else 1
        for j in range(n):
            t,u=j/n,(j+1)/n;z0=a[2]+(b[2]-a[2])*t;z1=a[2]+(b[2]-a[2])*u
            A=l0+(l1-l0)*t;B=r0+(r1-r0)*t;C=r0+(r1-r0)*u;E=l0+(l1-l0)*u
            top0=z0;top1=z0 if stair else z1
            idx=len(vv);vv.extend([(*A,top0),(*B,top0),(*C,top1),(*E,top1)]);ff.extend([(idx,idx+1,idx+2),(idx,idx+2,idx+3)])
            for P,Q,h0,h1 in [(A,E,top0,top1),(C,B,top1,top0)]:
                k=len(sides);sides.extend([(*P,h0),(*Q,h1),(*Q,-7),(*P,-7)]);sf.extend([(k,k+1,k+2),(k,k+2,k+3)])
            if stair:
                k=len(ris);ris.extend([(*E,top1),(*C,top1),(*C,z1),(*E,z1)]);rf.extend([(k,k+1,k+2),(k,k+2,k+3)]);steps+=1
    mesh(name+'_walking_surface',vv,ff,'#c7b89a');mesh(name+'_support',sides,sf,'#85877b')
    if ris:mesh(name+'_risers',ris,rf,'#a99a7c')
    report['links'][name]={'width_m':r['width'],'start_z':float(p[0,2]),'end_z':float(p[-1,2]),'steps':steps,'landing_adjustment_m':1.8 if name=='ramp_w' else 0,'max_grade_pct':round(max(abs(b[2]-a[2])/np.linalg.norm(b[:2]-a[:2])*100 for a,b in zip(p,p[1:])),1)}
    # Endpoint center belongs to the corresponding existing terrace; cutout has its exact shared cap.
    for pt in [p[0],p[-1]]:
        candidates=[k for k in levels if abs(D['levels'][k]['z']-pt[2])<1e-5 and levels[k].covers(Point(pt[:2]))]
        assert candidates,(name,'no terrace endpoint',pt.tolist())
# Massing only: exact building outlines and heights, no decorative invented assets.
for b in D['buildings']:
    q=Polygon(b['footprint']);z=D['levels'][b['level']]['z'];h=b['height'];name=b['id'];assert cleared[b['level']].buffer(.03).covers(q),(name,'overhang/route intersection')
    col={'home':'#c3b397','store':'#b29a79','shed':'#b5a68e'}.get(b['style'],'#b5a68e')
    shell('building_'+name,q,lambda x,y:z+h,z,'#967a60',col)
    report['buildings'][name]={'level':b['level'],'height_m':h,'area_m2':round(q.area,2)}
for i,(key,p) in enumerate(D['gardens']):
    q=Polygon(p).intersection(cleared[key]);z=D['levels'][key]['z']
    if not q.is_empty:top_surface('garden_%02d'%i,q,z+.025,'#82946d')
# Verify no building occupies the accepted street footprints or vertical connectors.
for b in D['buildings']:
    q=Polygon(b['footprint']);assert q.intersection(link_mask).area<1e-5,b['id']
    for r in D['routes']:
        if r['level']==b['level']:
            assert q.intersection(LineString(r['points']).buffer(r['width']/2)).area<1e-5,(b['id'],r['name'])
report['mesh_count']=len(scene.geometry);report['triangles']=sum(len(m.faces) for m in scene.geometry.values());report['bounds_y_up']=scene.bounds.tolist();report['scope']='Geometry only. No navigable runtime, no final art, no battle assignment. Stair treads require independent navigation proxy in game.'
path=out/'gardens_spatial_02.glb';path.write_bytes(scene.export(file_type='glb'));report['glb_sha256']=hashlib.sha256(path.read_bytes()).hexdigest();report['glb_bytes']=path.stat().st_size
# Independent GLB roundtrip validation.
loaded=trimesh.load(path,force='scene');assert len(loaded.geometry)==len(scene.geometry);assert np.allclose(loaded.bounds,scene.bounds,atol=.001);assert all(np.isfinite(m.vertices).all() for m in loaded.geometry.values());report['roundtrip']='PASS';(out/'geometry-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps({k:report[k] for k in ['source_sha256','mesh_count','triangles','bounds_y_up','glb_bytes','roundtrip']},indent=2))

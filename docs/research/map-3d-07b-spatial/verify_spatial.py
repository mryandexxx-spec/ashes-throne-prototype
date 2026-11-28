import sys,json,math,numpy as np,trimesh,pathlib
root=pathlib.Path(sys.argv[1]);D=json.loads(pathlib.Path(sys.argv[2]).read_text());s=trimesh.load(root/'gardens_spatial_02.glb',force='scene');tri=[];names=[]
for n in s.graph.nodes_geometry:
    if n.endswith('_sides') or n.endswith('_support') or n.endswith('_risers'):continue
    tf,g=s.graph[n];m=s.geometry[g].copy();m.apply_transform(tf);a=m.vertices[m.faces];tri.extend(a);names.extend([n]*len(a))
a=np.array(tri);p,q,r=a[:,0],a[:,1],a[:,2];det=(q[:,2]-r[:,2])*(p[:,0]-r[:,0])+(r[:,0]-q[:,0])*(p[:,2]-r[:,2]);mask=np.abs(det)>1e-8;p,q,r,det=p[mask],q[mask],r[mask],det[mask];names=np.asarray(names)[mask]
def floor(x,y):
    z=-y;u=((q[:,2]-r[:,2])*(x-r[:,0])+(r[:,0]-q[:,0])*(z-r[:,2]))/det;v=((r[:,2]-p[:,2])*(x-r[:,0])+(p[:,0]-r[:,0])*(z-r[:,2]))/det;w=1-u-v;m=(u>=-1e-6)&(v>=-1e-6)&(w>=-1e-6);ys=u*p[:,1]+v*q[:,1]+w*r[:,1];ys[~m]=-np.inf;i=int(np.argmax(ys));return float(ys[i]),names[i]
results=[];fail=[];transition_samples=[]
for route in D['routes']:
    a=np.asarray(route['points'],float);stair=route['name'].startswith('stairs_');link=route['level']=='link';count=0;worst=0
    if not link:a=np.column_stack([a,np.full(len(a),D['levels'][route['level']]['z'])])
    for i,(p0,p1) in enumerate(zip(a,a[1:])):
        length=np.linalg.norm(p1[:2]-p0[:2]);n=max(2,math.ceil(length/.25));norm=np.array([-(p1[1]-p0[1]),p1[0]-p0[0]])/length
        for t in np.linspace(0,1,n+1):
            c=p0+(p1-p0)*t
            for off in [-.3,0,.3]:
                x,y=c[:2]+norm*off;z,name=floor(x,y);error=abs(z-c[2]);count+=1;worst=max(worst,error)
                # At the endpoint cut cap, the side-offset sample can be a little off the center height.
                # Only an actual stair tread at a terrace connection may differ by one riser.
                allowed=.26 if link else .18 if name.startswith('stairs_') else .06
                if not link and name.startswith('stairs_') and error>.06:transition_samples.append([route['name'],round(float(x),2),round(float(y),2),round(error,4),str(name)])
                if error>allowed:fail.append([route['name'],round(float(x),2),round(float(y),2),round(float(c[2]),3),round(z,3),str(name)])
    results.append({'route':route['name'],'samples':count,'max_error_m':round(worst,4)})
print('samples',sum(r['samples'] for r in results),'fail',len(fail));print(fail[:35]);(root/'route-surface-report.json').write_text(json.dumps({'samples':sum(r['samples'] for r in results),'failures':fail,'actual_stair_tread_junction_samples':transition_samples,'routes':results,'scope':'GLB top-surface height and occlusion at route center and 0.3m side probes, not physics or navmesh'},indent=2));sys.exit(bool(fail))

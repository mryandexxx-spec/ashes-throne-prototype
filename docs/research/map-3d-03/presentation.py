"""Apply presentation-only changes to a temporary copy of frozen 02 lab."""
from pathlib import Path
def edit(path, replacements):
    p=Path(path);s=p.read_text()
    for a,b in replacements:
        assert s.count(a)==1,(path,a,s.count(a))
        s=s.replace(a,b)
    p.write_text(s)
edit('explorer.mjs',[
("scene.clearColor=new B.Color4(.10,.14,.17,1);","scene.clearColor=new B.Color4(.44,.55,.62,1);scene.fogMode=B.Scene.FOGMODE_LINEAR;scene.fogColor=new B.Color3(.44,.55,.62);scene.fogStart=38;scene.fogEnd=95;"),
("new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene).intensity=1.6;","const ambient=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);ambient.intensity=.85;ambient.diffuse=new B.Color3(.86,.91,1);ambient.groundColor=new B.Color3(.40,.39,.37);const sun=new B.DirectionalLight('sun',new B.Vector3(.55,-.85,.35),scene);sun.intensity=2.1;sun.diffuse=new B.Color3(1,.88,.72);"),
("check();metrics.artReadyMs=performance.now()-start;","check();metrics.artReadyMs=performance.now()-start;const shadow=new B.ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.bias=.0008;shadow.normalBias=.025;for(const m of scene.meshes){if(m.getTotalVertices()>0){m.receiveShadows=true;shadow.addShadowCaster(m,false);}}"),
("const root=hero.meshes[0];","for(const m of hero.meshes){if(m.getTotalVertices()>0){m.receiveShadows=true;shadow.addShadowCaster(m,false);}}const root=hero.meshes[0];")
])
edit('browser-test.mjs',[
("await page.locator('#overview').tap();await shot('overview');","await shot('spawn-art');await page.locator('#overview').tap();await shot('overview');"),
("assert.equal(s.arrivals,1);","assert.equal(s.arrivals,1);await shot('north-art');"),
("assert(s.visited.includes('lab.exit'));","assert(s.visited.includes('lab.exit'));await shot('exit-art');"),
("const cycles=[];for(let i=0;i<2;i++)","await page.locator('#overview').tap();s=await tap([4,0,-4]);assert(s.last.accepted);s=await arrive([4,0,-4]);assert(s.visited.includes('lab.branch.s'));await shot('south-art');await page.locator('#overview').tap();await shot('south-follow-art');const cycles=[];for(let i=0;i<2;i++)")
])

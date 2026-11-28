"""Bounded review of one coherent open game art family; no project admission."""
import hashlib, json, pathlib, re, struct, sys, urllib.parse, urllib.request
from urllib.error import HTTPError
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
repo="codepawl/0ad-art-glb"
base="https://huggingface.co"
def get(url,limit):
    req=urllib.request.Request(url,headers={"User-Agent":"AshesThrone-Research/1.0"})
    with urllib.request.urlopen(req,timeout=90) as r:
        parsed=urllib.parse.urlparse(r.geturl())
        host=parsed.hostname or ""
        assert parsed.scheme=="https" and (host in {"huggingface.co","hf.co","raw.githubusercontent.com","gitea.wildfiregames.com"} or host.endswith((".huggingface.co",".hf.co",".amazonaws.com",".cloudfront.net"))),host
        b=r.read(limit+1)
    assert len(b)<=limit,(url,len(b))
    return b
def save(p,b):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    return {"path":str(p.relative_to(out)),"sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b)}
info=json.loads(get(base+"/api/datasets/"+repo,8_000_000))
assert not info.get("private") and info.get("gated",False) is False
rev="7cd721e286854b78de1a74e79964388a41c060f4"
prefix=base+"/datasets/"+repo+"/resolve/"+rev+"/"
(out/"dataset-revision.json").write_text(json.dumps({"repository":repo,"revision":rev,"cardData":info.get("cardData"),"scope":"research only"},indent=2))
card=get(prefix+"README.md",2_000_000)
cardtext=card.decode("utf-8")
assert re.search(r"cc[- ]by[- ]sa[- ]3\.0|CC BY-SA 3\.0",cardtext,re.I) and "Wildfire Games" in cardtext
assert "61a3b9507d974084e6badb88a0826bd89a6d5b8b" in cardtext, "Dataset upstream changed; inspect card before use"
save(out/"README-source.md",card)
license_url="https://raw.githubusercontent.com/0ad/0ad/61a3b9507d974084e6badb88a0826bd89a6d5b8b/binaries/data/mods/public/art/LICENSE.txt"
lic=get(license_url,100_000)
assert b"Wildfire Games" in lic and b"creativecommons.org/licenses/by-sa/3.0/" in lic
save(out/"LICENSE-upstream.txt",lic)
meta=get(prefix+"metadata.jsonl",32_000_000);save(out/"metadata.jsonl",meta)
rows=[json.loads(line) for line in meta.splitlines() if line.strip()]

# All selections come from actual pinned source metadata, not guessed URLs.
families=['oak','apple','fig','carob','beech','poplar','maple','sycamore','chestnut','birch','broadleaf','deciduous','walnut','pear','elm','linden','plane']
trees=[r for r in rows if str(r.get('id','')).startswith('flora-trees-') and r.get('license')=='CC BY-SA 3.0' and 'Wildfire Games' in r.get('authors','') and 0<int(r.get('triangles',0))<=6000 and 0<int(r.get('engine_bytes',0))<=5000000 and not re.search(r'dead|stump|burnt|snow|autumn|winter|palm|pine|cypress|fir|spruce|bamboo',r['id'])]
(out/'tree-inventory.json').write_text(json.dumps(trees,indent=2))
picked=[];seen=set()
for family in families:
    group=[r for r in trees if family in r['id'] and r['id'] not in seen]
    if not group:continue
    candidate=sorted(group,key=lambda r:(-int(r['triangles']),r['id']))[0]
    picked.append(candidate);seen.add(candidate['id'])
    if len(picked)>=6:break
assert len(picked)>=2,('No sufficiently diverse broadleaf candidates',len(picked))
receipt=[]
for row in picked:
    p=row['files']['engine'];assert p.startswith('engine/') and p.endswith('.glb') and '..' not in pathlib.PurePosixPath(p).parts
    url=prefix+urllib.parse.quote(p,safe='/');b=get(url,5000000)
    assert len(b)==row['engine_bytes'] and b[:4]==b'glTF'
    ver,total=struct.unpack_from('<II',b,4);assert ver==2 and total==len(b)
    n,k=struct.unpack_from('<II',b,12);assert k==0x4e4f534a
    j=json.loads(b[20:20+n]);assert j.get('meshes') and j.get('images') and j.get('materials')
    assert all(not x.get('uri') or x['uri'].startswith('data:') for x in j.get('buffers',[])+j.get('images',[]))
    evidence=save(out/'sources'/(row['id']+'.glb'),b)
    receipt.append({'id':row['id'],'state':'SOURCE_VERIFIED','main':evidence['path'],'sourceURL':url,'sourceRevision':rev,'license':'CC BY-SA 3.0','author':'Wildfire Games','conversion':'CodePawl','files':[evidence],'metadata':row})
    (out/'source-receipt.json').write_text(json.dumps(receipt,indent=2))
    print(row['id'],len(b),flush=True)
(out/'ATTRIBUTION.txt').write_text('0 A.D. art by Wildfire Games, CC BY-SA 3.0; converted to GLB by CodePawl. See source-receipt.json and LICENSE-upstream.txt. No generated trees.\n')

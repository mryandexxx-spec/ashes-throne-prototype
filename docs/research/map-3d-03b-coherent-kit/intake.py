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
rev=info["sha"];assert re.fullmatch(r"[a-f0-9]{40}",rev),rev
prefix=base+"/datasets/"+repo+"/resolve/"+rev+"/"
(out/"dataset-revision.json").write_text(json.dumps({"repository":repo,"revision":rev,"cardData":info.get("cardData"),"scope":"research only"},indent=2))
card=get(prefix+"README.md",2_000_000)
cardtext=card.decode("utf-8")
assert re.search(r"cc[- ]by[- ]sa[- ]3\.0|CC BY-SA 3\.0",cardtext,re.I) and "Wildfire Games" in cardtext
assert "61a3b9507d974084e6badb88a0826bd89a6d5b8b" in cardtext, "Dataset upstream changed; inspect card before use"
save(out/"README-source.md",card)
license_url="https://raw.githubusercontent.com/0ad/0ad/master/binaries/data/mods/public/art/LICENSE.txt"
lic=get(license_url,100_000)
assert b"Wildfire Games" in lic and b"creativecommons.org/licenses/by-sa/3.0/" in lic
save(out/"LICENSE-upstream.txt",lic)
meta=get(prefix+"metadata.jsonl",32_000_000);save(out/"metadata.jsonl",meta)
rows=[json.loads(line) for line in meta.splitlines() if line.strip()]
def path(row):
    x=row.get("file_name")
    if isinstance(x,str) and x.startswith("engine/") and x.endswith(".glb"):return x
    for field in ("paths","files","tiers"):
        v=row.get(field,{})
        if isinstance(v,dict):
            x=v.get("engine")
            if isinstance(x,dict):x=x.get("path") or x.get("file")
            if isinstance(x,str) and x.startswith("engine/") and x.endswith(".glb"):return x
    return None
def label(row):
    return " ".join(str(row.get(k,"")) for k in ("id","title","name","file_name")).lower()
def iber(row):
    return path(row) and re.search(r"(?:^|[^a-z])iber(?:ian|ians)?(?:[^a-z]|$)",label(row))
candidates=[r for r in rows if iber(r)]
(out/"iberian-candidates.json").write_text(json.dumps(candidates,indent=2))
assert candidates,"No Iberian family found; inspect metadata; no other culture substituted"
picked=[];seen=set()
for role in ("house","market","farmstead","storehouse"):
    matches=[r for r in candidates if re.search(r"(?:^|[^a-z])"+role+r"(?:[^a-z]|$)",label(r)) and not re.search(r"ruin|foundation|destruct|construction|preview|icon",label(r)) and path(r) not in seen]
    if not matches:continue
    r=sorted(matches,key=lambda r:(len(path(r)),path(r)))[0]
    picked.append((role,r));seen.add(path(r))
    if len(picked)>=3:break
assert picked and picked[0][0]=="house", "No residential candidate; inspect selection"
# At least two civilian functions are necessary to assess cohesion.
assert len(picked)>=2, "Only one eligible model; no coherent subset proof"
receipt=[]
for role,r in picked:
    p=path(r);parts=pathlib.PurePosixPath(p).parts
    assert parts[0]=="engine" and all(x not in ("..",".","") for x in parts) and "\\" not in p
    claim=str(r.get("license",r.get("licence",""))).lower()
    assert not claim or re.search(r"cc[- ]by[- ]sa[- ]3\.0|creativecommons.org/licenses/by-sa/3.0",claim),claim
    url=prefix+urllib.parse.quote(p,safe="/")
    b=get(url,25_000_000)
    assert b[:4]==b"glTF" and len(b)>=20
    version,total=struct.unpack_from("<II",b,4);assert version==2 and total==len(b)
    n,kind=struct.unpack_from("<II",b,12);assert kind==0x4E4F534A
    gltf=json.loads(b[20:20+n])
    assert gltf.get("meshes") and gltf.get("materials") and gltf.get("images"),"missing textured art"
    assert all(not x.get("uri") or x["uri"].startswith("data:") for x in gltf.get("buffers",[])+gltf.get("images",[])),"external GLB dependencies"
    assert not {"EXT_meshopt_compression","KHR_draco_mesh_compression","KHR_texture_basisu"}.intersection(gltf.get("extensionsRequired",[])),"not plain engine tier"
    local=out/"sources"/(role+".glb")
    evidence=save(local,b)
    receipt.append({"id":role,"state":"SOURCE_VERIFIED","main":evidence["path"],"sourceFile":p,"sourceURL":url,"sourceRevision":rev,"license":"CC-BY-SA-3.0","author":"Wildfire Games","conversion":"CodePawl","originalSource":"https://gitea.wildfiregames.com/0ad/0ad","originalRevision":"61a3b9507d974084e6badb88a0826bd89a6d5b8b","licenseURL":"https://creativecommons.org/licenses/by-sa/3.0/","files":[evidence],"metadata":r})
    (out/"source-receipt.json").write_text(json.dumps(receipt,indent=2))
    print(role,p,evidence["bytes"],evidence["sha256"],flush=True)
(out/"ATTRIBUTION.txt").write_text("0 A.D. art by Wildfire Games — https://www.wildfiregames.com/\nCC BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0/\nConverted to GLB by CodePawl: "+prefix+"README.md\nReview-only export and renders; changes distributed under same art license. See source-receipt.json and LICENSE-upstream.txt.\n")

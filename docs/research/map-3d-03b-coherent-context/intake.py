"""Fetch exact same-family supplemental actors and one licensed terrain texture."""
import pathlib,sys,json,hashlib,urllib.request,urllib.parse,struct
root=pathlib.Path(sys.argv[1]).resolve(); extra=root/"context";extra.mkdir(exist_ok=True)
rev=json.loads((root/"dataset-revision.json").read_text())["revision"]
assert rev=="7cd721e286854b78de1a74e79964388a41c060f4"
meta={r["id"]:r for r in map(json.loads,(root/"metadata.jsonl").read_text().splitlines())}
items={"storehouse":"structures-iberians-storehouse","cliff":"geology-stone-mediterranean-greek-furrowed-cliff","cliff2":"geology-stone-mediterranean-greek-2-furrowed-cliff","olive":"flora-trees-olive","scrub":"flora-bushes-medit-scrub-01","boulder":"geology-stone-granite-greek-boulder"}
prefix="https://huggingface.co/datasets/codepawl/0ad-art-glb/resolve/"+rev+"/"
def fetch(url,cap):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"AshesThrone-Research/1.0"}),timeout=90) as r:
        host=urllib.parse.urlparse(r.geturl()).hostname or ""
        assert host in {"huggingface.co","hf.co","opengameart.org","www.opengameart.org"} or host.endswith((".huggingface.co",".hf.co",".amazonaws.com",".cloudfront.net")),host
        b=r.read(cap+1)
    assert len(b)<=cap
    return b
receipts=[]
for name,mid in items.items():
    row=meta[mid]
    assert row["license"]=="CC BY-SA 3.0" and "Wildfire Games" in row["authors"]
    p=row["files"]["engine"];assert p.startswith("engine/") and p.endswith(".glb")
    url=prefix+urllib.parse.quote(p,safe="/")
    b=fetch(url,15_000_000);assert len(b)==row["engine_bytes"] and b[:4]==b"glTF"
    version,total=struct.unpack_from("<II",b,4);assert version==2 and total==len(b)
    size,kind=struct.unpack_from("<II",b,12);assert kind==0x4e4f534a
    gltf=json.loads(b[20:20+size]);assert gltf.get("meshes") and gltf.get("materials")
    assert all(not x.get("uri") or x["uri"].startswith("data:") for x in gltf.get("buffers",[])+gltf.get("images",[]))
    path=extra/(name+".glb");path.write_bytes(b)
    receipts.append({"id":name,"path":str(path.relative_to(root)),"sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b),"sourceURL":url,"metadata":row})
    (extra/"supplemental-receipt.json").write_text(json.dumps(receipts,indent=2))
    print(name,len(b),flush=True)
url="https://opengameart.org/sites/default/files/oga-textures/38304/savanna_dirt_rocks_c.png"
b=fetch(url,3_000_000);assert b[:8]==b"\x89PNG\r\n\x1a\n"
(extra/"ground.png").write_bytes(b)
(extra/"ground-receipt.json").write_text(json.dumps({"sourceURL":url,"licensePage":"https://opengameart.org/node/38500","author":"Wildfire Games","license":"CC BY-SA 3.0","sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b)},indent=2))

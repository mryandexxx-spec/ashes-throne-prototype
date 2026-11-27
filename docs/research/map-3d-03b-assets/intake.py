"""Isolated source intake. No production writes, no generated primary art."""
import hashlib, json, pathlib, sys, urllib.request, urllib.parse, time
ROOT=pathlib.Path(sys.argv[1]).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
CAT=json.loads(pathlib.Path(__file__).with_name("catalog.json").read_text())
UA="AshesThrone-AssetResearch/1.0 (Poly Haven source intake)"
def request(url,limit,host):
    parsed=urllib.parse.urlparse(url)
    assert parsed.scheme=="https" and parsed.hostname in host, url
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":UA}),timeout=90) as r:
        assert urllib.parse.urlparse(r.geturl()).hostname in host
        data=r.read(limit+1)
    assert len(data)<=limit, "download limit"
    return data
def writejson(path,data):
    path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n")
def fetch_file(record,path):
    size=record["size"]
    assert isinstance(size,int) and 0<size<=100_000_000
    data=request(record["url"],size,{"dl.polyhaven.org","dl.polyhaven.com"})
    assert len(data)==size, path
    assert hashlib.md5(data).hexdigest()==record["md5"].lower(),path
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)
    return {"file":str(path.relative_to(ROOT)),"url":record["url"],"bytes":size,"md5":record["md5"],"sha256":hashlib.sha256(data).hexdigest()}
receipt=[]
for asset in CAT["items"]:
    assert asset["license"]=="CC0-1.0" and asset["source"]=="https://polyhaven.com/a/"+asset["id"]
    folder=ROOT/"sources"/asset["id"]
    folder.mkdir(parents=True,exist_ok=True)
    result={**asset,"state":"FAILED"}
    receipt.append(result)
    try:
        data=json.loads(request("https://api.polyhaven.com/files/"+asset["id"],4_000_000,{"api.polyhaven.com"}))
        writejson(folder/"provider-files.json",data)
        res=asset["resolution"]
        record=data["gltf"][res]["gltf"]
        main=folder/pathlib.PurePosixPath(urllib.parse.unquote(urllib.parse.urlparse(record["url"]).path)).name
        assert main.suffix==".gltf"
        files=[fetch_file(record,main)]
        includes=record.get("include",{})
        assert sum(v["size"] for v in includes.values())<200_000_000
        for rel,dep in includes.items():
            dest=(folder/urllib.parse.unquote(rel)).resolve()
            assert dest.is_relative_to(folder) and dest!=main
            files.append(fetch_file(dep,dest))
            time.sleep(.15)
        doc=json.loads(main.read_text())
        assert doc["asset"]["version"]=="2.0" and doc.get("meshes")
        for entry in doc.get("buffers",[])+doc.get("images",[]):
            uri=entry.get("uri")
            if uri and not uri.startswith("data:"):
                assert not urllib.parse.urlparse(uri).scheme
                dest=(folder/urllib.parse.unquote(uri)).resolve()
                assert dest.is_relative_to(folder) and dest.is_file(),uri
        result.update(state="SOURCE_VERIFIED",main=str(main.relative_to(ROOT)),files=files)
    except Exception as e:
        result["error"]=repr(e)
        print(asset["id"],repr(e),flush=True)
    writejson(ROOT/"source-receipt.json",receipt)
    time.sleep(.4)
if any(r["state"]!="SOURCE_VERIFIED" for r in receipt):
    sys.exit("One or more sources failed; partial evidence retained")

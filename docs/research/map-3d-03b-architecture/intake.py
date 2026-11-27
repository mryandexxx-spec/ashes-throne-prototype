"""Bounded isolated download of two CC0 authored house archives. No game files."""
import hashlib, json, pathlib, sys, urllib.request, urllib.parse, zipfile, stat
root=pathlib.Path(sys.argv[1]).resolve(); root.mkdir(parents=True,exist_ok=True)
items=json.loads(pathlib.Path(__file__).with_name("catalog.json").read_text())["items"]
receipts=[]
for a in items:
    row={**a,"state":"FAILED"}; receipts.append(row)
    try:
        assert a["license"]=="CC0-1.0"
        assert a["url"]=="https://opengameart.org/sites/default/files/"+a["filename"]
        folder=root/"sources"/a["id"]; folder.mkdir(parents=True,exist_ok=True)
        allowed={"lpc.opengameart.org","opengameart.org","www.opengameart.org"}
        errors=[]
        for url in [a["url"],a["url"].replace("opengameart.org","www.opengameart.org")]:
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"AshesThrone-AssetResearch/1.0"}),timeout=45) as response:
                    assert urllib.parse.urlparse(response.geturl()).hostname in allowed
                    data=response.read(80_000_001)
                assert len(data)<=80_000_000 and data[:2]==b"PK"
                break
            except Exception as exc:
                errors.append(repr(exc))
        else:
            raise RuntimeError(errors)
        path=folder/a["filename"];path.write_bytes(data)
        members=[]
        with zipfile.ZipFile(path) as z:
            assert len(z.infolist())<300 and sum(i.file_size for i in z.infolist())<350_000_000
            for i in z.infolist():
                dest=(folder/"unpacked"/i.filename).resolve()
                assert dest.is_relative_to(folder/"unpacked") and not stat.S_ISLNK(i.external_attr>>16)
                if i.is_dir(): continue
                dest.parent.mkdir(parents=True,exist_ok=True)
                b=z.read(i);dest.write_bytes(b)
                members.append({"path":str(dest.relative_to(root)),"sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b)})
        blends=sorted((folder/"unpacked").rglob("*.blend"))
        assert len(blends)==1, [str(p) for p in blends]
        row.update(state="SOURCE_VERIFIED",main=str(blends[0].relative_to(root)),downloadURL=url,archiveSHA256=hashlib.sha256(data).hexdigest(),archiveBytes=len(data),files=members)
    except Exception as exc:
        row["error"]=repr(exc);print(a["id"],repr(exc),flush=True)
    (root/"source-receipt.json").write_text(json.dumps(receipts,indent=2))
if not any(r["state"]=="SOURCE_VERIFIED" for r in receipts):
    sys.exit("No valid archive")

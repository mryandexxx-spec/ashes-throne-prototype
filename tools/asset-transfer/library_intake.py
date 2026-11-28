"""AS-00C: explicit fallback ingress; draft only, no publication.
Missing input is WAITING_INPUT, never a successful transfer.
"""
import hashlib, json, os, pathlib, struct, subprocess, sys, zipfile

REPO = "mryandexxx-spec/ashes-throne-prototype"
TAG = "as-00c-library-intake-20261128"
BASE = "8a2d4f44ceb72de06fe1643c6f6c1c579eb76fa0"
NAME = "as00-art05-v2.zip"
ZIP_BYTES = 20069109
ZIP_SHA = "eea3f054e6e3e615687a695d91c3b5d8ada451dc0c9ed2ebba189217ef457b13"
GLB = "gardens-art05-v2.glb"
GLB_BYTES = 24962004
GLB_SHA = "3f2d8bef9b2b0fe7c62232f478be1ea9caeb683c688d6c51a74490c310fc15fa"

def sha(b): return hashlib.sha256(b).hexdigest()

def validate(p):
    data = p.read_bytes()
    assert len(data) == ZIP_BYTES and sha(data) == ZIP_SHA, "wrong archive"
    with zipfile.ZipFile(p) as z:
        assert sorted(z.namelist()) == sorted(["manifest.json", GLB])
        assert z.getinfo(GLB).file_size == GLB_BYTES
        assert z.getinfo("manifest.json").file_size < 4096
        m = json.loads(z.read("manifest.json"))
        assert m["version"] == 1
        assert m["files"] == [{"name":GLB,"bytes":GLB_BYTES,"sha256":GLB_SHA}]
        b = z.read(GLB)
        assert len(b) == GLB_BYTES and sha(b) == GLB_SHA
        assert struct.unpack_from("<4sII",b) == (b"glTF",2,GLB_BYTES)
        n,t = struct.unpack_from("<II",b,12)
        assert t == 0x4e4f534a and 20+n <= len(b)
        j = json.loads(b[20:20+n])
        assert len(j["nodes"]) == 251 and len(j["images"]) == 41 and j["meshes"]
    return {"archive":NAME,"archive_sha256":ZIP_SHA,"bytes":GLB_BYTES,"sha256":GLB_SHA,"nodes":251,"images":41}

def gh(*args):
    return json.loads(subprocess.check_output(["gh","api",*args],text=True))

def all_pages(endpoint):
    return [a for page in gh(endpoint+"?per_page=100","--paginate","--slurp") for a in page]

def main():
    assert os.environ["GH_REPO"] == REPO
    out = pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    receipt = {"status":"FAIL","tag":TAG,"publication":False}
    try:
        rels=[r for r in all_pages("repos/"+REPO+"/releases") if r["tag_name"]==TAG]
        assert len(rels)<=1
        if rels: rel=rels[0]
        else:
            rel=gh("repos/"+REPO+"/releases","-X","POST","-f","tag_name="+TAG,
                   "-f","target_commitish="+BASE,"-f","name=AS-00C Library intake (draft only)",
                   "-f","body=Upload only the exact AS-00C ZIP. Save draft, do not publish. No game rollout or artistic approval.",
                   "-F","draft=true","-F","prerelease=true")
        assert rel["draft"], "refuse published release"
        rid=rel["id"]
        receipt.update(release_id=rid,edit_url="https://github.com/"+REPO+"/releases/edit/"+str(rid))
        print("Draft intake release ID:",rid,flush=True)
        print("Draft edit URL:",receipt["edit_url"],flush=True)
        assets=all_pages("repos/"+REPO+"/releases/"+str(rid)+"/assets")
        assert all(a["name"]==NAME for a in assets), "unexpected assets"
        if not assets:
            receipt["status"]="WAITING_INPUT"
            print("WAITING_INPUT: no external binary received. This is not a transfer PASS.",flush=True)
            return
        assert len(assets)==1
        a=assets[0];assert a["state"]=="uploaded" and a["size"]==ZIP_BYTES
        if a.get("digest"):assert a["digest"]=="sha256:"+ZIP_SHA
        p=out/NAME
        with p.open("wb") as f:
            subprocess.run(["gh","api","repos/"+REPO+"/releases/assets/"+str(a["id"]),"-H","Accept: application/octet-stream"],stdout=f,check=True)
        receipt.update(validate(p),asset_id=a["id"])
        assert gh("repos/"+REPO+"/releases/"+str(rid))["draft"]
        receipt["status"]="PASS"
        print("AS-00C PASS: exact ART-05 v2 bytes verified; draft retained",flush=True)
    finally:
        (out/"receipt.json").write_text(json.dumps(receipt,indent=2))

if __name__=="__main__":
    if len(sys.argv)==3 and sys.argv[1]=="--validate-local":
        print(json.dumps(validate(pathlib.Path(sys.argv[2]))))
    else: main()

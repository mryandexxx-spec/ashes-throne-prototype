"""AS-00B: same-repo Actions -> private draft Release -> verified readback.
No publication, no binary commits, no source URL supplied by an untrusted archive.
"""
import hashlib, json, os, pathlib, re, struct, subprocess, sys, urllib.parse, zipfile

REPO = "mryandexxx-spec/ashes-throne-prototype"
TAG = "as-00b-transfer-pilot-20261128"
BASE = "8a2d4f44ceb72de06fe1643c6f6c1c579eb76fa0"
INPUTS = [
    (15275913588, "vegetation", "474a8c926aa1d1c5769d67b3abe9083300df83813951ce5b49ed64929dd92e7e"),
    (15275689060, "trees", "aef27cb4d8bf42ae1577e216b0223a008f72139b9343c840d13133659250297a"),
]
API = "https://api.github.com/repos/" + REPO
TOKEN = os.environ["GH_TOKEN"]
assert os.environ["GH_REPO"] == REPO
out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
files = out / "files"
files.mkdir(exist_ok=True)
receipt = {"tag": TAG, "draft": True, "status": "RUNNING", "inputs": [], "assets": []}
def save():
    (out / "receipt.json").write_text(json.dumps(receipt, indent=2, sort_keys=True))
def digest(b): return hashlib.sha256(b).hexdigest()
def gh(*args):
    return json.loads(subprocess.check_output(["gh", "api", *args], text=True))
def curl(url, dest=None, upload=None, accept="application/octet-stream"):
    assert url.startswith(API + "/") or url.startswith("https://uploads.github.com/repos/" + REPO + "/releases/")
    cmd = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "180",
           "-H", "Authorization: Bearer " + TOKEN, "-H", "Accept: " + accept]
    if dest is not None: cmd += ["-o", str(dest)]
    if upload is not None:
        cmd += ["-H", "Content-Type: application/octet-stream", "--data-binary", "@" + str(upload)]
    cmd += [url]
    return subprocess.check_output(cmd)
def validate_glb(data):
    assert len(data) >= 20 and struct.unpack_from("<4sII", data) == (b"glTF", 2, len(data))
    n, typ = struct.unpack_from("<II", data, 12)
    assert typ == 0x4E4F534A and 20 + n <= len(data)
    obj = json.loads(data[20:20+n])
    assert obj.get("meshes") and obj.get("asset", {}).get("version") == "2.0"
def stage(name, data, **info):
    assert re.fullmatch(r"[a-zA-Z0-9._-]+", name)
    dest = files / name
    assert not dest.exists(), name
    dest.write_bytes(data)
    receipt["assets"].append(dict(name=name, bytes=len(data), sha256=digest(data), **info))
def releases():
    return [r for page in gh("repos/"+REPO+"/releases?per_page=100", "--paginate", "--slurp") for r in page]
try:
    for aid, group, expected in INPUTS:
        zip_path = out / (group + ".zip")
        meta = gh("repos/"+REPO+"/actions/artifacts/"+str(aid))
        assert not meta["expired"] and meta["digest"] == "sha256:"+expected
        curl(API+"/actions/artifacts/"+str(aid)+"/zip", zip_path)
        assert digest(zip_path.read_bytes()) == expected, "source archive checksum"
        receipt["inputs"].append({"artifact": aid, "group": group, "sha256": expected})
        with zipfile.ZipFile(zip_path) as z:
            names = z.namelist()
            assert len(names) == len(set(names))
            assert sum(i.file_size for i in z.infolist()) < 512*1024*1024
            def named(suffix):
                hits = [n for n in names if n == suffix or n.endswith("/"+suffix)]
                assert len(hits) == 1, (suffix, hits)
                return hits[0]
            source = named("source-receipt.json")
            result = named("review/results.json" if group == "vegetation" else "import-receipt.json")
            rows = json.loads(z.read(result))
            selected = []
            for row in rows:
                if group == "vegetation":
                    if row["state"] not in ("RENDERED_CANDIDATE", "OVER_BUDGET"): continue
                    size, sha = row["candidate"]["bytes"], row["candidate"]["sha256"]
                else:
                    if row["state"] != "IMPORTED_AND_RENDERED": continue
                    size, sha = row["glbBytes"], row["glbSHA256"]
                ident = row["id"]
                assert re.fullmatch(r"[a-zA-Z0-9._-]+", ident)
                member = named("review/"+ident+".glb")
                data = z.read(member)
                validate_glb(data)
                assert len(data) == size and digest(data) == sha
                stage(group+"-"+ident+".glb", data, artifact=aid, member=member, kind="candidate-glb")
                selected.append(ident)
            assert selected, group
            for member in [source, result] + ([named("LICENSE-upstream.txt"), named("ATTRIBUTION.txt")] if group == "trees" else []):
                stage(group+"-"+pathlib.PurePosixPath(member).name, z.read(member), artifact=aid, member=member, kind="provenance")
    # Draft only: a technical quarantine, not a public release or license approval.
    existing = [r for r in releases() if r["tag_name"] == TAG]
    assert len(existing) <= 1
    if existing:
        rel = existing[0]
        assert rel["draft"], "refuse to change published release"
    else:
        assert "--expect-reuse" not in sys.argv
        rel = gh("repos/"+REPO+"/releases", "-X", "POST", "-f", "tag_name="+TAG,
                 "-f", "target_commitish="+BASE, "-f", "name=AS-00B transfer quarantine",
                 "-f", "body=Technical pilot only; no public publication or artistic acceptance. Preserve source receipts and license restrictions.",
                 "-F", "draft=true", "-F", "prerelease=true")
    rid = rel["id"]
    receipt["release_id"] = rid
    assert rel["draft"]
    old = {a["name"]: a for page in gh("repos/"+REPO+"/releases/"+str(rid)+"/assets?per_page=100","--paginate","--slurp") for a in page}
    assert set(old) <= {a["name"] for a in receipt["assets"]}, "unexpected release files"
    for row in receipt["assets"]:
        name = row["name"]
        if name in old:
            a = old[name]
            row["operation"] = "reused"
        else:
            assert "--expect-reuse" not in sys.argv, name
            url = rel["upload_url"].split("{")[0] + "?name=" + urllib.parse.quote(name, safe="")
            a = json.loads(curl(url, upload=files/name, accept="application/vnd.github+json"))
            row["operation"] = "uploaded"
        assert a["name"] == name and a["size"] == row["bytes"] and a["state"] == "uploaded"
        if a.get("digest"): assert a["digest"] == "sha256:"+row["sha256"]
        downloaded = out / "readback.bin"
        curl(API+"/releases/assets/"+str(a["id"]), downloaded)
        assert downloaded.stat().st_size == row["bytes"] and digest(downloaded.read_bytes()) == row["sha256"]
        row.update(asset_id=a["id"], verified=True)
        save()
    assert gh("repos/"+REPO+"/releases/"+str(rid))["draft"]
    receipt["glb_count"] = sum(a["kind"] == "candidate-glb" for a in receipt["assets"])
    receipt["status"] = "PASS"
    print("AS-00B", receipt["glb_count"], "actual GLBs;", len(receipt["assets"]), "verified files;", "repeat" if "--expect-reuse" in sys.argv else "initial")
except Exception as exc:
    receipt["status"] = "FAIL"
    receipt["error_type"] = type(exc).__name__
    # Avoid recording subprocess commands that contain authorization headers.
    if not isinstance(exc, subprocess.CalledProcessError): print(type(exc).__name__, str(exc))
    else: print("HTTP/CLI subprocess failed", exc.returncode)
    sys.exit(1)
finally:
    save()

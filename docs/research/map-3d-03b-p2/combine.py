import pathlib,sys,json,shutil
base=pathlib.Path(sys.argv[1]);extra=pathlib.Path(sys.argv[2])
for n in ("source-receipt.json","import-receipt.json"):
    a=json.loads((base/n).read_text());b=json.loads((extra/n).read_text())
    assert not ({x["id"] for x in a}&{x["id"] for x in b})
    assert all(x["state"] in ("SOURCE_VERIFIED","IMPORTED_AND_RENDERED") for x in b)
    (base/n).write_text(json.dumps(a+b,indent=2))
for p in (extra/"review").glob("*.glb"):
    shutil.copy2(p,base/"review"/p.name)

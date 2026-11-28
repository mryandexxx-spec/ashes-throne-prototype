# Reusable map art QA
Run with Node 22 + Playwright 1.56.1 installed in a temporary directory, copy runner.mjs/viewer.js/index.html there, install Chromium and WebKit, then:
`node /tmp/qa/runner.mjs "$PWD" /path/to/map.glb /path/to/manifest.json /tmp/evidence`.
Manifest: id, sha256, optional bytes and triangles (mandatory for real candidate acceptance), views [{id,target:[x,y,z],offset:[x,y,z],span:number}]. See control.json. Exact GLB required. No CDN. Control tests validate infra only. Review report and actual screenshots. Movement/physical iPhone are separate; use existing MAP-3D-04/06 controller, not a new controller in this art viewer. Current ART-05 input is Library-only; authorized binary delivery and candidate NAV are still open. No production changes. Follow ashes-map3d-qa.

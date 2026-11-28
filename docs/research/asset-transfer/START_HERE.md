# AS-00 — Asset Transfer Bridge

[В РАЗРАБОТКЕ] Owner approved start 28.11.2026. Scope: Ashes Throne only, zero added cost, no public asset publication before provenance/license review, no edits to production runtime or #614. Main baseline 8a2d4f44ceb72de06fe1643c6f6c1c579eb76fa0.

## Start here
- AS-00A: connector has no direct binary release-upload action; Library -> local materialization exists but no established outbound authenticated path. Do not use text/base64 chunking, secrets in files, paid services or unapproved public hosts. AS-00C still INPUT_BLOCKED until tested transfer route.
- AS-00B: real existing #614 evidence archives 15275913588 and 15275689060, pinned SHA256 in tools/asset-transfer/pilot.py. Download inside public standard GitHub runner, verify exact archive SHA, candidate GLB headers and source review hashes, preserve receipts/license, upload to collaborator-only draft release as-00b-transfer-pilot-20261128, download each asset and verify SHA256. Repeat same job to demonstrate reuse, not replace. Partial failure keeps verified files for resume. No release publish, no binary commits, no art acceptance. Record actual GLB count; do not claim ten if fewer.
- AS-00C: exact ART-05 v2, Library libfile_b14508b0630881918afd6e4b9b1d8887, 24962004 bytes, SHA256 3f2d8bef9b2b0fe7c62232f478be1ea9caeb683c688d6c51a74490c310fc15fa. No regeneration; preserve current owner work. Public distribution requires inherited license review.
- AS-00D: 10 distinct real GLB, batch verification, retry, dedup and resume; no binary commits. AS-00E: reusable skill only after actual evidence. AS-01+ storage and Pages architecture follow separately.
- Fallback: owner can upload one ZIP to draft Release from iPhone; not yet tested and not preferred. Don't ask owner to act as CI traffic light.
- Applied ashes-map3d-qa, ashes-babylonjs (input boundaries), create-game-assets (provenance). This pilot does not test renderer, navigation or physical iPhone.

## Acceptance
AS-00B: verified readback and repeat, release still draft. AS-00C/D separate gates. No merge or production rollout of experimental workflow before review. No new billing or secrets. Read workflow receipts and exact run IDs on resume.

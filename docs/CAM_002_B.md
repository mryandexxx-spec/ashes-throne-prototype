# CAM-002-B — технический срез 1: proof / recruitment
25.11.2026 · [В РАЗРАБОТКЕ]. Owner accepted the working direction 0.3; exact art, geography and balance still open. Private acceptance record is in draft #81 (do not copy hidden narrative). Main baseline c1c0c5f32255ea03f3a0116aa6c2b9dc0bed26b2, v0.3.261.
## Scope
- Preserve the existing M1 key, ID, API, reward and UI.
- Add chapter II mission ID main-cam-002-m1, independent versioned proof key and first-clear receipt; unlock after M1 durable victory AND receipt.
- First-clear recruitment of Nada at 1 star through existing RewardPolicyCore and writer lock; no additional economy amounts proposed (currency/XP/materials zero), preserve prior shards and owned rank.
- No live UI route, battle adapter, actual new encounter or story assets yet; do NOT activate the source from generic mission rewards or change HeroCollectionCore.MISSION_UNLOCKS. No third chapter implementation in this slice.
- New mission API proofFor/statusFor/recordFor/claimFor: caller captures mission ID at battle entry, validates it before launch and result; current M1 APIs unchanged. Explicit ready/locked/claimable/claimed/blocked; fail closed on inconsistent receipts or corrupt proof.
## Tests and gates
New tests/main-campaign-002b.test.js covers locked II, M1 proof without receipt, defeat/active, independent stars, one-star grant, repeat and concurrent claims, failed proof/wallet writes, reload after ambiguous commit, already-owned and shards. Synthetic battle fixtures are not browser victories. CI results pending; no physical iPhone verification.
## Next work in same branch
1. Audit SaveCore reset/debug and proof lifecycle, CI paths and real battle identity; wire mission-aware map, squad, start/finish/retry/result, claim, and exact next unlock. Keep current M1 art and flow; no forced scenes. For II use only approved visible brief/result, no private motivations in public repo.
2. Design provisional enemies using existing NPC profiles; measure manual battle on fresh Ren+Art and balance locally (not global). No guest Nada before recruitment. No other mode may call chapter II grant.
3. Mobile map/result and roster, 844×320/844×390/932×430 Chromium/WebKit, actual manual battles and loss/retry/reload/double claim; test whole first-play path and existing M1. Update build version, index cache bust, PROJECT_STATUS/ROADMAP and changelog before final merge. Keep draft until applicable checks are green and final diff reviewed. No Pages publication or working new chapter claimed.
4. After II is playable and verified, implement III separately; do not expand OPS/network.
Applied save-systems manually to current browser persistence, not foreign file APIs. GDD/TDD and actual main prevail.

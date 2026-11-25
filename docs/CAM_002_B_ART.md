# CAM-002-B-ART — глава II «За каменным ребром»
25.11.2026 · **[В РАЗРАБОТКЕ — бинарные ассеты ещё не доставлены в GitHub]**. Candidate v0.3.263 CAM002BART. Base main 961d7c2dc17e655114ccbdc2d5b9b5d3c0f266af / v0.3.262; CAM-002-B PR #519 merged, selective CI #45576519491 success. Do not merge this art slice without both actual WebP blobs and green applicable checks.

## Постановка и границы
- До боя: дорожное убежище, открытая безопасная полка над городом, снятые каменные детали, сторожа удерживают рабочего. Рен пытается остановить конфликт, Нада помогает рабочему, Арт рядом. После durable win: те же люди, рабочий свободен и показывает направление, Нада записывает сведения. Не утверждать правовой итог, остановку всего вывоза или литературный канон. Портретные референсы — текущие roster WebP Рена, Арта, Нады; стиль — M1. Лица и костюмы требуют авторской визуальной приёмки; новый рабочий, сторожа, архитектура — игровые визуальные кандидаты. Источник постановки — принятый рабочий сценарный контракт, не окончательный канон.
- Показ в существующей карте и результате: никакого нового шага/таймера/диалога. Переключение I/II подставляет конкретный путь и alt, скрывает старый/ошибочный кадр, сохраняет схему маршрута как фон. Только подтверждённая победа открывает второй кадр, поражение никогда не показывает его на результате. При отсутствии картинки результат остаётся текстовым в одной колонке. Бой, proof, receipt, награда Нада, баланс, OPS/сеть и глава III не меняются.
- Выбраны два отдельных WebP 1152×384 (3:1, Lanczos, quality 76) из одного сгенерированного диптиха ChatGPT. Обрезка границы между кадрами. Файлы декодированы Pillow и проверены размеры/хеши; суммарно 181682 B. Не добавлять новые 3D, анимации и зависимости. Визуальная проверка исходного диптиха проведена, не проверен кроп в реальном UI.

## Asset manifest (локальные проверенные файлы, НЕ blobs в GitHub)
| Repo path | Bytes | SHA256 | Expected Git blob SHA |
|---|---:|---|---|
| assets/cutscenes/main-campaign/m2/shelter-conflict.webp | 94628 | 051212f9dbff8eeed6830b502a82433dba28de6ae9fb119f8908f70f7d42b307 | c7954a128d572bb306d90d1358dcc395d4b932e7 |
| assets/cutscenes/main-campaign/m2/shelter-witness.webp | 87054 | f01a32326784fde0f2352fe3aa78e67efbcfb8b89ffbddf1eb6647d09a2cee22 | da78723e28aa2f8101adcfe5b4ef437da6cfde14 |
Archive: CAM-002-B-ART-assets.zip, available from task chat and backed up to the owner's personal ChatGPT Library. Direct GitHub DNS from working container failed; GitHub connector can commit UTF-8 files but has no local file reference input for binary blobs. Do not represent the archive or files as already in repo. Transfer exact bytes from archive to the work branch, not main. Verify blob SHAs. If generating different images later, update manifest and re-review.

## Verification
- game.js and tests/main-campaign-browser.cjs parsed in isolated V8; package.json parsed; 8/8 mocked image-state assertions passed (loaded I, switch hides stale I, II load, defeat blocks queued callback, cached replay, failure text fallback, map pending/ready). Not full Node or browser tests.
- Browser regression expanded for II asset decode/dimensions, pre-tap visibility, loss without art, durable win, reload before claim, repeat and I/II switching. Keep existing M1, First Play, real manual combat, claim isolation. Browser CI may fail intentionally until assets present. Check actual screenshots at Chromium/WebKit 844×390, 932×430, 844×320; portrait/safe-area as applicable. Watch async result layout and crop; no physical iPhone tested.
- Applied create-game-assets, game-ui-ux, ashes-cutscene-director, ashes-canon-guardian. Sources: current game main, status, roadmap, workflow, current region, profile/portrait art, working narrative direction. Do not publish hidden scenario plans.

## Resume
1. Open branch cam-002-b-art and its draft PR; verify current main and diff. Transfer both WebP from archive into exact paths; confirm hashes. No merge with missing art.
2. Run all applicable checks, inspect screenshots and confirm visible CTAs, crop and fallback; fix any issues. Mark ready and merge only after green applicable checks. Verify new main and Pages separately. Update PROJECT_STATUS/ROADMAP/CHANGELOG with facts. iPhone first verify footer v0.3.263 CAM002BART; then I→II, loss/retry, victory/reload, recruit Nada once, replay. Author visual acceptance and physical device remain open.
3. Only then continue chapter III, no OPS/network expansion or canon promotion.

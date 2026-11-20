# Игровые 3D-файлы (как в Dune GoH)

Эти файлы доступны из GitHub Pages по пути `dev/assets/models/`.
Исходники и отчётность — в `dev/assets-src/characters/`.
Декларация пути для классического игрового скрипта — `dev/src/assets/models.js`, manifest для проверок — `manifest.json`.

**Загруженный и проверенный файл:** `nada-mobile-animated.glb` (1 462 284 байта, NADAOPT001; до этого 3 096 808).

В GitHub blob SHA: `4c8b29b875b875aa871ceb0c2531b84795257af9`, SHA-256: `5bbd34c2db189d1831c213b02ac31f49342f8b7773cc283589ece8249a5a016d`. Получен из прежнего файла скриптом `tools/optimize-hero-glb.mjs`, см. `docs/NADA_GLB_OPTIMIZE_001.md`.

Если GLB отсутствует/повреждён: обычный 2D-портрет в досье и старый простой боец на арене, без влияния на боевую логику. Файл в PR подтверждён; слияние всё ещё запрещено до окончательных проверок браузера и разрешения владельца.

В отличие от Дюны, текущая игра не имеет сборщика `dev/tools/build.mjs`; копировать его нельзя. GitHub Pages напрямую обслуживает файл здесь.

**ART3D001:** `art-mobile-animated.glb` ожидает загрузки двоичного файла в рабочую ветку; 2 032 788 байт, SHA-256 `c7a25c48dbd9117baec08e3ff1612f4b52ece8516a521571b9b1f1b3852b2860`, 9 клипов. См. `docs/ART_3D_001.md`.

**ARENA-ART-004B (враги):** `npc-*.glb` — 8 гуманоидных NPC, имя файла = `archetypeId` из `npc-enemy-data.js`. Манифест `dev/src/assets/npc-models.js` генерирует `tools/build-npc-models.mjs` (он же вызывает `tools/optimize-hero-glb.mjs`); вручную не править. Проверка: `tests/npc-models-004b.test.js`. Сархи — шаг 5, см. `docs/ARENA_ART_004_PLAN.md`.

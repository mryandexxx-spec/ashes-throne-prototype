# LIORA-SHIELD-006 — щит в скелете Лиоры и один облегчённый GLB

**Дата:** 13 ноября 2026
**Версия-кандидат:** `v0.3.144 · LIORASHIELD006`
**Статус:** [В РАЗРАБОТКЕ] — код, GLB и автотесты готовы, Chromium-проверки пройдены локально; ждёт CI (включая WebKit), художественной приёмки владельцем и проверки на iPhone.

## Задача владельца

1. Оптимизировать загрузку модели Лиоры.
2. «Подружить» загруженный GLB щита с Лиорой и её анимациями.

Прежний подход (LIORA-SHIELD-002…005, отклонён владельцем по проверке на iPhone) крепил отдельный GLB щита в коде: узел следовал за мировой позицией кисти, а ориентацию брал от корня модели и поправлял смешиванием суставов. Это давало два запроса, лишний код в кадре и неестественное поведение щита.

## Решение

Щит **вшит в тот же GLB как второй скинированный меш** `Liora_Shield` с весом 100 % на кость `mixamorig:LeftForeArm` (левое предплечье, как ремённый кайтшилд). Скелет и все 15 клипов общие, поэтому щит повторяет любое движение руки без кода привязки, стабилизации или поправок поз. Для показа Лиоры без щита достаточно скрыть меш (`LioraGlbRuntime.setShieldVisible(false)`, в мастерской — чекбокс).

### Калибровка посадки

Сделана в реальной сцене Babylon 9.33.2 (`Idle_02`, 50 % клипа): центр щита на 55 % длины предплечья от локтя к кисти и на 12 см наружу от оси предплечья; верх щита направлен к локтю, лицевая сторона с солнцем — наружу (в сторону левого бока). Из этого мирового положения вычислена матрица «пространство щита → bind-пространство скина» (`dev/assets-src/characters/liora/shield_attachment.json`), по которой `tools/bake-liora-shield.mjs` переносит вершины и нормали щита и добавляет `JOINTS_0/WEIGHTS_0`.

Контрольные кадры 8 клипов × 3 ракурса до запекания: [evidence/liora-shield-006/calibration-8clips-3views.jpg](evidence/liora-shield-006/calibration-8clips-3views.jpg). Запечённый файл даёт те же кадры (средняя разница яркости < 0,5/255 с учётом текстуры 1024 и квантования).

### Оптимизация файла

| Часть | Было (два файла) | Стало (один файл) |
|---|---|---|
| Персонаж: сетка 13 265 вершин, float32 | 775 КБ | `KHR_mesh_quantization` ≈ 404 КБ |
| Персонаж: цвет WebP 2048 q92 | 608 КБ | без изменений (повторное сжатие ухудшило бы качество) |
| Щит: сетка 4 445 вершин | 203 КБ | квантование + JOINTS/WEIGHTS ≈ 137 КБ |
| Щит: цвет WebP 2048 q90 | 427 КБ | WebP 1024 q90 ≈ 183 КБ (щит — треть роста героя) |
| 15 анимаций | ≈ 1,24 МБ, 2 880 каналов | 975 каналов, повороты int16 normalized ≈ 0,46 МБ |
| JSON-описание | ≈ 0,48 МБ | ≈ 0,24 МБ |
| **Итого** | **2 850 224 + 631 488 = 3 481 712 байт, 2 запроса** | **2 117 776 байт, 1 запрос (−39 %)** |

Приёмы, которых не было в RENOPT001/NADAOPT001:
- **Константные каналы, одинаковые во всех 15 клипах** (127 из 192 пар «кость/свойство»: трансляции и масштабы костей, часть поворотов пальцев), записаны в rest-трансформ узла и удалены из анимаций. Babylon не трогает узлы, на которые клип не нацелен, поэтому воспроизведение не меняется. Это убрало 1 905 каналов и в два раза уменьшило JSON.
- **Повороты как normalized int16** — разрешено базовой спецификацией glTF 2.0; загрузчик Babylon переводит их в float при чтении (проверено в коде `_loadAccessorAsync` 9.33.2). Погрешность ≈ 3·10⁻⁵ на компоненту.
- `quantizationVolume: 'scene'`, чтобы оба меша делили один скин (иначе gltf-transform клонирует скин, и Babylon создаёт два скелета).

Сборка детерминирована: два прогона `tools/bake-liora-shield.mjs` дают побайтно одинаковый файл. Внешние декодеры (Draco/meshopt) не нужны. `gltf-transform validate`: ошибок нет.

### Боевые слоты (liora-glb-runtime.js)

| Слот | Было (LIORAPLAY001, без щита) | Стало |
|---|---|---|
| basic | `Step_Forward_and_Push` | `Liora_Shield_Bash` |
| special | `Squat_Stance` | `Liora_Shield_Block` |
| powerful | `Step_Forward_and_Push` | `Squat_Stance` |
| death | `Dead` | `Liora_Shield_Death` (окно 0–98 %) |
| idle / guard / hit / run / walk | `Idle_02` / `Alert` / `Hit_Reaction` / `Running` / `Walking` | без изменений |

Это соответствует `LioraModelAssets.clips` из LIORA-SHIELD-003. Название базовой способности в `ability-data.js` сменено с «Удар без оружия · тест» на «Удар щитом · тест» (тестовая подпись, не канон).

## Изменённые файлы

- **Новое:** `dev/assets/models/liora-mobile-animated.glb` (2 117 776 байт, SHA-256 `6baf3cf9…`, blob `aeb64b8d`); `tools/bake-liora-shield.mjs`; `dev/assets-src/characters/liora/shield_attachment.json`; `tests/liora-shield-006-preview.test.js`; `docs/evidence/liora-shield-006/`.
- **Удалено:** `dev/assets/models/liora_vel_shield_aware_15clips.glb`, `dev/assets/models/liora-shield-mobile.glb` (исходники для сборки — в истории git, `main` `9e72e44`), `liora-shield-attachment.js`, `liora-shield-combat-pose.js` и их тесты, `tests/liora-unarmed-preview.test.js`.
- `dev/src/assets/models.js`, `dev/assets/models/manifest.json`, README ассетов — новый файл, поля `shieldMesh`/`shieldJoint`, реестр `LioraShieldAssets` убран.
- `model-cache-sw.js` (`CACHE_NAME` → `liora-aeb64b8d`, путь, `MODEL_BYTES`), `model-cache-client.js` (`?v=liorashield006`).
- `liora-glb-runtime.js` — клипы щита, кадрирование по телу без щита (в bind-позе щит висит на вытянутой руке), `shield`/`setShieldVisible`, метка `metadata.lioraShield`.
- `ren-card-3d.js` — то же кадрирование карточки, подписи; `game.js`, `hero-profile-data.js`, `ability-data.js` — подписи «со щитом».
- `liora-lab.html`, `liora-shield-lab.html`, `liora-shield-lab.js` — мастерская одного файла с чекбоксом щита.
- Тесты: `liora-glb-asset-contract` (контракт одного GLB: 1 скин, 2 меша, щит жёстко на предплечье, int16-повороты, < 1 100 каналов, бюджет 2,3 МБ), `liora-shield-babylon-browser.cjs` (реальный WebGL: 15 клипов × 5 фаз, центроид щита неподвижен в системе предплечья с допуском 1 см, чекбокс только скрывает меш), `liora-playable-browser.cjs` (в арене щит присутствует и скинирован), кеш-тесты, синхронизация версии `v0.3.144 · LIORASHIELD006`.
- `.github/workflows/liora-shield-babylon.yml` — имена и пути.

## Проверки

| Уровень | Результат |
|---|---|
| Node `npm test` | 454/454 |
| Chromium (локально: системный Chrome + SwiftShader, Babylon 9.33.2 из npm вместо CDN) | `liora-shield-babylon-browser` — PASS, максимальное «проскальзывание» щита 0,0000 м во всех 75 позах; `liora-playable-browser` — изолированная сцена, карточка и живая арена PASS; `model-cache-browser` — офлайн отдаёт 2 117 776 байт |
| WebKit | только в CI |
| **Физический iPhone Safari** | **не проверялся** |
| Художественная приёмка | **не проводилась** — см. ниже |

Кадры: [Idle_02](evidence/liora-shield-006/Idle_02.png), [Liora_Shield_Block](evidence/liora-shield-006/Liora_Shield_Block.png), [Liora_Shield_Bash](evidence/liora-shield-006/Liora_Shield_Bash.png), [Liora_Shield_Death](evidence/liora-shield-006/Liora_Shield_Death.png), [без щита (чекбокс)](evidence/liora-shield-006/Idle_02_unarmed.png), [арена](evidence/liora-shield-006/arena-chromium.jpg), [карточка](evidence/liora-shield-006/card-chromium.png).

## Что должен решить владелец

1. **Размер щита.** Оставлен авторский (0,59 × 0,95 м — от плеча до колена). Если нужен меньше, в `shield_attachment.json` добавляется масштаб и файл пересобирается тем же скриптом.
2. **Посадка.** Параметры 0,55 / 0,12 м выбраны по кадрам; на реальном устройстве может потребоваться сдвиг на 1–3 см или наклон. Это одна пересборка без изменений кода.
3. **Неиспользуемые клипы.** В файле по-прежнему 15 клипов; игра использует 9. Удаление `Block1`, `Shield_Push_Left`, `Catching_Breath`, `Dead`, `Step_Forward_and_Push`, `Walk_Fight_Forward` дало бы ещё ≈ −0,3 МБ. Не сделано без решения владельца.
4. В `Idle_02` на арене камера видит тыльную сторону щита (лицевая обращена к противнику) — это следствие ремённого крепления; при блоке и ударе солнце видно.

## Чек-лист iPhone

1. Футер: `v0.3.144 · LIORASHIELD006`; панель кеша для Лиоры ≈ 2,0 МБ вместо 2,7 МБ.
2. Карточка Лиоры: щит на левом предплечье, лицо и тело в кадре, вращение пальцем.
3. Бой: обычный удар — удар щитом; защитная стойка — блок; смерть — падение со щитом; щит не отрывается от руки.
4. После перезагрузки Лиора появляется из кеша; нагрев и FPS не хуже, чем с Надой.
5. `liora-lab.html`: чекбокс «Показывать щит» скрывает и возвращает щит.

**PR не сливать без явного разрешения владельца.**

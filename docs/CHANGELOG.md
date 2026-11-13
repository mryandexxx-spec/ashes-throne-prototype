# Changelog — Пепельный престол (игровой прототип)

Журнал изменений, попавших в `main`. Новые записи добавляются **сверху** при каждом слиянии PR: дата, версия сборки (если менялась), короткое описание, номер PR, коммит.

- Текущее состояние проекта — в [PROJECT_STATUS.md](PROJECT_STATUS.md), не здесь.
- Подробности этапа — в описании PR и в профильном документе `docs/<ЭТАП>.md`.
- Полный прежний журнал решений и проверок, который до 13.11.2026 вёлся в `PROJECT_STATUS.md`, сохранён дословно: [archive/PROJECT_STATUS_JOURNAL_2026-11-13.md](archive/PROJECT_STATUS_JOURNAL_2026-11-13.md). Прежние разделы README по этапам TECH-001…Combat-003 — в [archive/README_HISTORY_2026-11-13.md](archive/README_HISTORY_2026-11-13.md).
- Список ниже до 13.11.2026 восстановлен из истории `main` (`git log --first-parent`): заголовки PR и код сборки из футера `index.html` на каждом коммите. Версия показана только там, где она изменилась. Записи без номера PR — прямые коммиты в `main`.
- Код этапа в футере не всегда совпадает с названием PR: например, ARENA-ENGINE-003 сменил номер на `v0.3.132`, но оставил код `CACHE002`.

## Исправления к прежнему журналу

В архивном журнале следующие этапы остались с пометкой «в разработке / не сливать», хотя они **слиты в `main`**:

| Этап | PR | Коммит в `main` |
|---|---|---|
| NADA3D001 — 3D Нада | #273 | `8daeee9` |
| CACHE001 — постоянный кеш GLB | #279 | `07a0e89` |
| CACHE002 — прогресс фоновой загрузки | #280 | `480699f` |
| ARENA-ENGINE-003 — арена по образцу Dune (вкл. #281, #282) | ветка #283, но PR **не слит**: прямой коммит в `main` | `7be7ffe` |
| RENOPT001 — облегчённая модель Рена | #285 | `fd3c738` |


## 2026-11-13

- **`v0.3.134 · MOBILEQA001`** — MOBILEQA001: исправления по мобильной проверке арены и штаба (v0.3.133) ([#286](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/286)) · `e61172e`
- **`v0.3.133 · RENOPT001`** — RENOPT001: модель Рена 14,2 → 2,86 МБ ([#285](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/285)) · `fd3c738`
- DOCS: GDD 3.0 и TDD 1.0 в репозитории ([#284](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/284)) · `75cbf2d`
- **`v0.3.132 · CACHE002`** — ARENA-ENGINE-003: арена по образцу Dune, World HUD и более крупный план. **Прямой коммит в `main`, не через PR:** содержимое ветки PR #283 (включает #281, #282), сам PR #283 не слит · `7be7ffe`

## 2026-11-12

- **`v0.3.131 · CACHE002`** — CACHE002: видимый прогресс фоновой загрузки Рена и Нады в штабе ([#280](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/280)) · `480699f`
- **`v0.3.130 · CACHE001`** — CACHE001: постоянный кеш 3D-моделей Рена и Нады и безопасная фоновая загрузка ([#279](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/279)) · `07a0e89`
- RENWEBP001: Рен 14,23 МБ — WebP без потерь вместо PNG ([#276](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/276)) · `3f23589`
- NADA-LOAD-002: вернуть проценты загрузки 3D Нады ([#274](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/274)) · `c9028bc`
- **`v0.3.129 · NADA3D001`** — NADA3D001: интеграция анимированной Нады по dev-структуре Дюны ([#273](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/273)) · `8daeee9`
- **`v0.3.128 · RENROSTER001`** — RENROSTER001: широкий портрет Рена и компактный футер ([#272](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/272)) · `29c4c1b`
- **`v0.3.127 · NADAROSTER001`** — NADAROSTER001: исправить обрезку портрета Нады в ростере ([#271](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/271)) · `97c5e01`
- **`v0.3.126 · NADAPORTRAIT002`** — NADAPORTRAIT002: заменить игровой портрет Нады на художественную v2 ([#270](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/270)) · `aadda4b`
- **`v0.3.125 · NADAPLAY001`** — NADAPLAY001: Нада — постоянный игровой герой, боевой пилот и безопасная миграция v3 ([#269](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/269)) · `ce6b0f9`
- **`v0.3.124 · NADAART001`** — NADAART001: утверждённый портрет и досье Нады в коллекции ([#268](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/268)) · `243324a`
- ART — утверждённый портрет Нады в стилистике Рена ([#267](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/267)) · `099e303`

## 2026-11-11

- **`v0.3.123 · RENBYTES002`** — RENBYTES002: исправить счётчик загрузки Рена после 100% и переполнение карточки ([#266](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/266)) · `53d4ddf`
- **`v0.3.122 · RENBYTES001`** — RENBYTES001: показывать скачанные МБ при загрузке 3D Рена ([#265](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/265)) · `42973de`
- docs: record authorized merge of PR #262 (RENCHOR021) · `ea70bfe`
- **`v0.3.121 · RENCHOR021`** — RENCHOR021: базовая атака Рена, измеренный контакт и WebGL-стенд ([#262](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/262)) · `c54dd00`
- **`v0.3.120 · HEROCARD001`** — HEROCARD001: утверждённая карточка с героем в центре без прокрутки страницы ([#263](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/263)) · `dcd14ec`
- **`v0.3.119 · RENQUEUE019`** — RENQUEUE019: убрать рассинхрон ходов и анимаций Рена ([#261](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/261)) · `1f895b4`
- **`v0.3.118 · RENPACE018`** — RENPACE018: замедлить боевые анимации Рена на ×1 ([#260](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/260)) · `56b6081`
- **`v0.3.117 · RENMESH017`** — RENMESH017: Рен Meshy Mixamo — новая GLB-модель и анимации ([#259](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/259)) · `5ee0088`
- docs: зафиксировать состояние анимации Рена и остановить дальнейшие итерации ([#258](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/258)) · `8edc498`
- **`v0.3.116 · RENPOSE016`** — RENPOSE016: асимметричная стойка Рена — правая рука у пояса, левая свободна ([#257](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/257)) · `be4672e`
- **`v0.3.115 · RENIDLE015`** — RENIDLE015: убрать раскачивание Рена и дёргающееся плечо в карточке ([#256](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/256)) · `e281e43`
- **`v0.3.114 · RENRETARGET014`** — RENRETARGET014: перенос реальных CC0-анимаций KinemIQ на скелет Рена ([#255](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/255)) · `49f3531`
- **`v0.3.113 · RENSTANCE013`** — RENSTANCE013: исправить зажатую стойку Рена — без сведённых рук и согнутых коленей ([#254](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/254)) · `610e39e`
- **`v0.3.112 · RENSTANCE012`** — RENSTANCE012: заметная расслабленная стойка Рена — полный силуэт и медленный ритм ([#253](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/253)) · `ce8fd1d`
- **`v0.3.111 · RENPOSE011`** — RENPOSE011: расслабленная асимметричная стойка и спокойный ритм Рена ([#252](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/252)) · `045dbb7`
- **`v0.3.110 · RENIDLE010`** — RENIDLE010: оживить стойку Рена движением KinemIQ Idle_relaxed (CC0) ([#251](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/251)) · `eb65d75`
- **`v0.3.109 · MELEE009`** — RENCARD009 + MELEE009: крупная 3D-карточка Рена и сближение бойцов ([#250](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/250)) · `710d0fc`
- **`v0.3.108 · RENAN008`** — RENAN008: сделать движения Рена заметнее в карточке и бою ([#249](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/249)) · `062f02c`
- **`v0.3.107 · RENAN007`** — RENAN007: анимации скелета Рена, разворот к врагам и устойчивое ожидание ([#248](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/248)) · `2faddeb`
- **`v0.3.106 · RENW006`** — Рен: заменить модель в бою и карточке на Wanderer без анимаций ([#247](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/247)) · `6b9913e`

## 2026-11-10

- **`v0.3.105 · RENLOAD005`** — REN-LOAD-005: понятная загрузка 3D Рена в бою и карточке ([#245](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/245)) · `48ffacd`
- **`v0.3.104 · RENGLB003`** — REN-GLB-003: исправить боевой GLB Рена и добавить вращаемую модель в карточку ([#242](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/242)) · `2a5c883`
- REN-GLB-DEFAULT-002: полностью заменить боевого Рена на анимированный GLB ([#241](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/241)) · `3206379`
- REN-GLB-REVIEW-002: просмотр исходного GLB Рена на iPhone без Blender ([#238](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/238)) · `7ae49d6`
- REN-3D-STUDIO-001: отдельная 3D-мастерская Рена с экспортом GLB ([#237](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/237)) · `ea5e884`
- **`v0.3.103 · ENV022-DEFAULT`** — UI-COMBAT-HUD-001: единый художественный стиль боевого HUD без изменения арены ([#236](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/236)) · `13610a6`
- **`v0.3.102 · ENV022-DEFAULT`** — UI-STORY-001: литературное оформление сюжетной пробы и биографий ([#235](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/235)) · `7585233`
- **`v0.3.101 · ENV022-DEFAULT`** — UI-MODES-001D: художественное оформление четырёх экранов результатов ([#234](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/234)) · `82e19a5`
- **`v0.3.100 · ENV022-DEFAULT`** — UI-MODES-001C: художественное оформление двух разведопераций ([#233](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/233)) · `4b1dd03`
- **`v0.3.99 · ENV022-DEFAULT`** — UI-MODES-001B: художественный экран испытаний ([#232](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/232)) · `5e3a365`
- **`v0.3.98 · ENV022-DEFAULT`** — UI-MODES-001A: художественный экран кампании и выбора миссий ([#231](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/231)) · `48615de`
- **`v0.3.97 · ENV022-DEFAULT`** — UI-SYSTEMS-001C: художественный календарь наград за вход ([#230](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/230)) · `3bd3ae5`
- **`v0.3.96 · ENV022-DEFAULT`** — UI-SYSTEMS-001B: художественный экран ежедневных заданий ([#229](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/229)) · `871577f`
- **`v0.3.95 · ENV022-DEFAULT`** — UI-SYSTEMS-001A: player profile HQ art direction ([#228](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/228)) · `4d52f93`
- **`v0.3.94 · ENV022-DEFAULT`** — ENV022-DEFAULT: show canyon concept in ordinary battle ([#227](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/227)) · `395c402`
- **`v0.3.93 · ENV022-CONCEPT`** — UI-HERO-002: squad art direction with ENV022 compatibility ([#225](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/225)) · `9fd9051`
- **`v0.3.92 · ENV022-CONCEPT`** — ENV022: optional canyon concept backdrop behind live Babylon combat ([#224](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/224)) · `e7db151`
- **`v0.3.91 · ENV017-MASSING`** — UI-HERO-001: artistic dossier scene shell ([#223](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/223)) · `ec25220`
- UI-SYSTEM-001: standardize approved visual direction ([#222](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/222)) · `2841af6`
- **`v0.3.90 · ENV017-MASSING`** — ROSTER-UI-006: integrate roster into HQ scene ([#220](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/220)) · `d57ac46`
- **`v0.3.89 · ENV017-MASSING`** — ROSTER-UI-005: painterly collection depth ([#219](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/219)) · `1a359c1`
- **`v0.3.88 · ENV017-MASSING`** — ROSTER-UI-004: restore leader badge in collection ([#218](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/218)) · `b552982`
- **`v0.3.87 · ENV017-MASSING`** — ROSTER-UI-003: hero identity tags and themed sorting ([#216](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/216)) · `1026591`
- **`v0.3.86 · ENV017-MASSING`** — ROSTER-UI-002: roster filters, sorting, squad and scroll ([#215](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/215)) · `a1d158e`
- **`v0.3.85 · ENV017-MASSING`** — ROSTER-UI-001: HQ-aligned hero collection ([#211](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/211)) · `a6366c4`
- docs: зафиксировать утверждение HQ-UI-008 ([#207](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/207)) · `787f73f`

## 2026-11-09

- HQ-UI-008: выравнивание бликов брони и оружия ([#206](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/206)) · `82781a6`
- HQ-UI-007: локальные световые эффекты штаба ([#201](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/201)) · `1359350`
- HQ-UI-006: естественная подсветка предметов штаба ([#198](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/198)) · `5545bca`
- HQ-UI-005: плавная подсветка контуров штаба ([#197](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/197)) · `5a36a88`
- HQ-UI-004: интерактивные объекты штаба вместо карточек ([#195](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/195)) · `bbc1b81`
- HQ-UI-002/003: художественный штаб и живописная панорама ([#193](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/193)) · `57c309f`
- **`v0.3.84 · ENV017-MASSING`** — Merge COMBAT-ENV-017 interim camera-first massing ([#192](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/192)) · `f2737f7`
- docs: handoff ENV017 camera-first chasm redesign ([#191](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/191)) · `e744a87`
- HQ-UI-001: панорамный интерактивный штаб главного меню ([#184](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/184)) · `f8159aa`
- ENV013 approved art direction and context preservation ([#182](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/182)) · `a4011b0`
- **`v0.3.83 · ENV010`** — COMBAT-ENV-010 fixed perspective and connected authored canyon ([#174](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/174)) · `170c451`
- docs: ENV010 authored GLB/WebGL handoff for next chat ([#177](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/177)) · `5ad5862`
- docs: ENV010 WebGL handoff and next-chat recovery ([#176](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/176)) · `1b05de5`
- docs: handoff COMBAT-ENV-010 and approved fixed-camera experiment ([#175](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/175)) · `e834db3`

## 2026-11-08

- **`v0.3.82 · ENV009`** — COMBAT-ENV-009: цельный 3D-уступ, ущелье и многоплановый скальный горизонт ([#173](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/173)) · `e4f4b5f`
- DOCS: COMBAT-ENV-009 — отзыв CV008 и передача работы над фоном в новый чат ([#172](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/172)) · `3125f4e`
- **`v0.3.81 · CV008`** — COMBAT-VISUAL-008: фактура камня, естественные края, скалы и освещение ([#171](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/171)) · `ffbadd8`
- **`v0.3.80 · CV007`** — COMBAT-VISUAL-007: скальная тестовая арена и эффекты попаданий ([#170](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/170)) · `24f12fd`
- **`v0.3.79 · REN3D003`** — REN-VISUAL-003: индивидуальная мобильная 3D-модель Рена для Babylon.js ([#169](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/169)) · `f20d64c`
- **`v0.3.78 · RENVIS002`** — REN-VISUAL-002: исправить кадрирование Рена в коллекции и карточке ([#168](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/168)) · `1820398`
- **`v0.3.77 · RENVIS001`** — REN-VISUAL-001: утверждённый портрет Рена в коллекции и карточке ([#167](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/167)) · `f27164f`
- **`v0.3.76 · RENPLAY`** — OPS-HELP-001: встроенная справка для двух разведопераций ([#166](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/166)) · `0eb1f90`
- DOCS — руководство по внедрению героев и передача визуального этапа Рена ([#165](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/165)) · `5217a8a`
- **`v0.3.75 · RENPLAY`** — OPS-002B: мобильная разведоперация «Тревожный сигнал» с общим боем ([#164](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/164)) · `5ae076c`
- **`v0.3.74 · RENPLAY`** — [В РАЗРАБОТКЕ] REN-PLAYABLE — Рен как постоянный герой со спасением v3 ([#163](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/163)) · `268d8de`
- OPS-002A: изолированное ядро операции «Тревожный сигнал» и тесты ([#162](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/162)) · `37f376c`
- [ПРЕДЛОЖЕНИЕ] REN-STATUS-H — сравнение полных боёв и альтернативы баланса ([#161](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/161)) · `021d773`
- [ПРЕДЛОЖЕНИЕ] REN-STATUS-G — моделирование вероятностей сопротивления Рена ([#159](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/159)) · `cf8246f`
- [В РАЗРАБОТКЕ] REN-COMBAT-F — проверка сопротивления в сюжетной пробе ([#157](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/157)) · `4dd1803`
- docs(status): зафиксировать приёмку OPS-001B владельцем ([#158](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/158)) · `4b6b000`
- FIX-OPS001B: восстановить зелёный CI после одновременного слияния #153 и #155 ([#156](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/156)) · `f212b50`
- [В РАЗРАБОТКЕ] REN-COMBAT-E — сквозная регрессия набора Рена ([#155](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/155)) · `9f843a8`
- **`v0.3.74 · OPS001B`** — OPS-001B: мобильная разведоперация «Два курьера» с общим боем ([#153](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/153)) · `00b2c62`
- **`v0.3.73 · RENCOMBATD`** — [В РАЗРАБОТКЕ] REN-COMBAT-D — мощная «Сорвать построение» ([#154](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/154)) · `60ef131`
- **`v0.3.72 · RENCOMBATC`** — [В РАЗРАБОТКЕ] REN-COMBAT-C — «Чувство тропы» и проверка сопротивления ([#152](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/152)) · `cb1316d`
- OPS-001A: изолированное ядро разведывательно-боевой операции ([#151](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/151)) · `7895df8`
- **`v0.3.71 · RENCOMBATB`** — [В РАЗРАБОТКЕ] REN-COMBAT-B — замедление «Точного удара» с 4-го уровня ([#150](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/150)) · `d0dd730`
- [В РАЗРАБОТКЕ] REN-COMBAT-A — тестовый фундамент замедления и сопротивления ([#149](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/149)) · `b73e491`
- **`v0.3.70 · REN002`** — REN-002: SVG-портрет Рена и план экипировки G1–G13 (v0.3.70) ([#144](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/144)) · `aa0c4ec`
- **`v0.3.69 · RENINT001`** — [В РАЗРАБОТКЕ] REN-INT-002 — интеграция профиля Рена с Challenges-002 ([#147](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/147)) · `d501e0c`
- Docs: handoff to next game mode after accepted CHAL002 ([#148](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/148)) · `9e1f26d`
- **`v0.3.68 · CHAL002`** — CHAL002: два подраздела испытаний, +6 миссий и ежедневные задания ([#145](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/145)) · `bf06f26`
- **`v0.3.67 · CHAL001B`** — Challenges-001B — UI-пилот тактической задачи и Натиска ([#143](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/143)) · `27459ec`
- Challenges-001A: изолированное ядро T-01 и N-01, без изменений игры ([#142](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/142)) · `f346acc`
- **`v0.3.66 · STORY002`** — [ПРОБА ПЕРА] STORY-002 — играбельные Рен, Нада и Лиора в сюжетном тесте ([#139](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/139)) · `4155bf6`
- docs: handoff к игровым режимам после Stars-001 ([#140](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/140)) · `d8fe265`
- **`v0.3.65 · STARS001`** — Stars-001: 7★ / 330 осколков, совместимость Heroes-001, сохранения и UI ([#138](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/138)) · `5bb4bec`
- **`v0.3.64 · STORY001`** — [ПРОБА ПЕРА] STORY-001 — «Дорога, которой нет» в игре (без хронологии и канона) ([#137](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/137)) · `7c9c3e2`
- **`v0.3.63 · HERO001`** — Heroes-001 [В РАЗРАБОТКЕ]: открытие тестовых героев за первые победы кампании ([#136](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/136)) · `b07fe9b`
- **`v0.3.62 · SKILLUI002`** — SkillUI-002 [В РАЗРАБОТКЕ]: собственный стиль окна прокачки вместо копии референса ([#135](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/135)) · `65a94f8`
- **`v0.3.61 · SKILL001`** — Skills-001 [В РАЗРАБОТКЕ]: реальные уровни навыков 1–6, материалы ступеней и окно улучшения ([#134](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/134)) · `d49faf2`
- **`v0.3.60 · HEROUI002`** — HEROUI-002 [В РАЗРАБОТКЕ]: удобная карточка героя по референсу без 3D ([#133](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/133)) · `0487855`
- **`v0.3.59 · ABUI001`** — Abilities-UI-001 [В РАЗРАБОТКЕ] — пять способностей в карточке героя ([#132](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/132)) · `e4cebb6`
- **`v0.3.58 · LOGIN002`** — Login-002 [В РАЗРАБОТКЕ]: календарь месяца (28–31), автопоказ и счётчик наград ([#131](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/131)) · `092aa0c`
- **`v0.3.57 · LOGIN001`** — Login-001 [В РАЗРАБОТКЕ]: семидневный календарь ежедневного входа ([#130](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/130)) · `f311bbd`
- **`v0.3.56 · DAILY001`** — Daily-001 [В РАЗРАБОТКЕ] — три ежедневных задания из реальных действий ([#129](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/129)) · `201eafe`
- **`v0.3.55 · STAT004A5`** — Stats-004A5 [УТВЕРЖДЕНО: правило; В РАЗРАБОТКЕ: код] — account→hero cap и понятный UI ([#128](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/128)) · `237035c`
- **`v0.3.54 · PROFILE001`** — Profile-001 / Stats-004A4 — экран профиля игрока и проектирование уровня аккаунта ([#127](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/127)) · `cec5a0b`
- Stats-004A3 — доступность уровня и G1 перед второй миссией ([#126](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/126)) · `3043a88`
- Stats-004A2 — проверка достижимости 3★ миссии №2 ручной тактикой ([#125](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/125)) · `3b3db64`
- Stats-004A — количественный baseline трёх миссий без изменения баланса ([#124](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/124)) · `512d451`
- docs(stats-004): compare combat balance formulas, mission sensitivity and calibrated rollout plan ([#123](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/123)) · `1171878`
- Stats-003 — комплексный аудит 14 характеристик и атомарность RNG ([#122](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/122)) · `4fdf0d9`
- Stats-001E2 — эффективность ослаблений и сопротивление (только тестовые бои) ([#121](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/121)) · `e6c9b66`
- Stats-001E1 — пробивание физической/магической обороны (только тестовые бои) ([#120](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/120)) · `9d318b3`
- Stats-001D2 — opt-in критические удары для тестовых боёв (без изменения кампании) ([#119](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/119)) · `35285d4`
- Stats-001D1 — воспроизводимые промахи для opt-in тестовых боёв (без изменения кампании) ([#118](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/118)) · `a4ab2f4`
- Stats-001D0 — opt-in воспроизводимая случайность боя без изменения баланса ([#117](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/117)) · `11887df`
- **`v0.3.53 · UIFIX001`** — UIFIX-001: Protection над HP и сохранение скорости боя (v0.3.53) ([#115](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/115)) · `8c51235`
- **`v0.3.52 · STATS002C`** — Stats-002C — временные характеристики трёх героев в боях (v0.3.52) ([#114](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/114)) · `66dd74b`
- **`v0.3.51 · STATS001C`** — Stats-001C — Protection и физическая/магическая оборона для тестовых атак (v0.3.51) ([#111](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/111)) · `1794cda`
- **`v0.3.50 · STATS001B`** — Stats-001B — физический и магический урон без изменения существующего баланса (v0.3.50) ([#110](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/110)) · `39efc75`
- **`v0.3.49 · STATS001A`** — Stats-001A — каталог 14 боевых характеристик и карточка героя (v0.3.49) ([#109](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/109)) · `2ed5454`
- docs(status): record v0.3.48 mobile 8/8 owner smoke and CI 62/62; supersede stale snapshot ([#108](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/108)) · `e29a184`
- MobileLifecycle-001 — тест фонового режима, возврата и перезапуска боя ([#107](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/107)) · `5766e02`
- FullLoop-001 — сквозной тест игрового цикла v0.3.48 ([#106](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/106)) · `ee4ad3d`
- **`v0.3.48 · ENSAVE001`** — Energy/Save-001 — бесплатные сюжетные попытки и восстановление сохранения v3 (v0.3.48) ([#105](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/105)) · `0d1a2bd`
- **`v0.3.47 · GEAR004B`** — Gear-004B — материалы за первую победу, честные награды в карточке миссии (v0.3.47) ([#104](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/104)) · `1b62e17`
- **`v0.3.46 · GEAR004A`** — Gear-004A — повторные награды семи материалов для v3 (v0.3.46) ([#103](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/103)) · `ea24750`
- docs: Gear-004 handoff and current game status ([#102](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/102)) · `e57e0c2`
- **`v0.3.45 · GEAR003B2`** — Gear-003B2: G3 itemized gear and persisted history G1-G3 ([#101](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/101)) · `67baeee`
- **`v0.3.44 · GEAR003B1`** — Gear-003B1: G2 itemized equipment and G1 history ([#100](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/100)) · `3c3ebe9`

## 2026-11-07

- **`v0.3.43 · GEAR003A2`** — Gear-003A2: itemized G1 gear and clean v3 hero startup ([#99](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/99)) · `df85f41`
- Gear-003A1: inert clean-hero save v3 staging ([#98](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/98)) · `e7afb61`
- **`v0.3.42 · VSUNBLOCK`** — VS-UNBLOCK: remove prototype progression gates ([#97](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/97)) · `3a23451`
- **`v0.3.41 · DEVRES001`** — DEV-RES-001: prototype-only test resources refill ([#96](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/96)) · `fb54e9d`
- **`v0.3.40 · GEAR002C`** — Gear-002C: show equipment currency balance and shortages ([#95](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/95)) · `04ec22b`
- **`v0.3.39 · GEAR002B`** — Gear-002B: paid manual G-tier promotion and before/after summary ([#94](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/94)) · `6ba93cc`
- **`v0.3.38 · GEAR002`** — Gear-002: independent equipment slots G1–G3 ([#93](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/93)) · `8031cc2`
- **`v0.3.37 · ENRF001`** — ENRF001: visible feedback for energy regeneration check ([#92](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/92)) · `9939183`
- **`v0.3.36 · SIM001`** — SIM001: unified mission simulation with batch slider and entry energy ([#91](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/91)) · `ad72bd9`
- **`v0.3.35 · PVS001C`** — Progress-VS-001C: energy regeneration and resource auto-farming ([#90](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/90)) · `93f6a71`
- **`v0.3.34 · PVS001B`** — Progress-VS-001B: G1–G3 equipment, C materials and hero gear UI ([#89](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/89)) · `b6e212d`
- **`v0.3.33 · PVS001A`** — Progress-VS-001A: Account XP, currency, hero levels and first-clear rewards ([#88](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/88)) · `5d92569`
- **`v0.3.32 · CBA015E`** — Combat-015E: агрессивный ИИ по умолчанию для всех противников + архив баланса ([#87](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/87)) · `b154ad6`
- Combat-015D: план поэтапного включения ИИ врагов и фиксация приёмки 015C-B ([#84](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/84)) · `6cfa092`
- **`v0.3.31 · CBA015DA`** — Combat-015D-A: один агрессивный Теневой клинок только в демо-миссии №2 ([#85](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/85)) · `61818c1`
- **`v0.3.30 · CBA015CB`** — Combat-015C-B: тактические профили противников с явным включением ([#83](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/83)) · `5c2fde7`
- **`v0.3.29 · CBA015CA`** — Combat-015C-A: единый контракт боевых действий для союзников и врагов ([#82](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/82)) · `7e6f8fd`
- **`v0.3.28 · CBA015B`** — Combat-015B: подключить тактический автобой союзников ([#81](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/81)) · `3043517`
- Combat-015A: детерминированный выбор действий для будущего умного автобоя ([#80](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/80)) · `58fef9b`
- **`v0.3.27 · CBA014D`** — Combat-014D: герой занимает первую свободную ячейку без сдвига остальных ([#79](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/79)) · `3d9dce7`
- **`v0.3.26 · CBA014C`** — Combat-014C: любой лидер, сохранение отряда, предупреждение и «Распустить» ([#78](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/78)) · `6553eb3`

## 2026-11-06

- **`v0.3.25 · CBA014B`** — Combat-014B: первая выделенная ячейка лидера на экране отряда ([#77](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/77)) · `3272f07`
- **`v0.3.24 · CBA014A`** — Combat-014A: явный выбор лидера и тестовая аура без изменения игровых героев ([#76](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/76)) · `c58d136`
- Docs: зафиксировать приёмку Combat-013B ([#75](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/75)) · `4a2ab64`
- **`v0.3.23 · CBA013B`** — Combat-013B: автоматическое применение тестовых пассивок без хардкода героев ([#74](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/74)) · `159cf6a`
- Docs: зафиксировать приёмку Combat-013A ([#73](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/73)) · `01c3bf3`
- **`v0.3.22 · CBA013A`** — Combat-013A: контракты постоянных, условных и реактивных пассивок ([#72](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/72)) · `563ccdd`
- **`v0.3.21 · CBA012C`** — Combat-012C: дополнительные эффекты из данных, без хардкода героев ([#71](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/71)) · `243aeca`
- Docs: зафиксировать приёмку Combat-012B ([#69](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/69)) · `8dc3acb`
- **`v0.3.20 · CBA012B`** — Combat-012B: мощные учебные способности для всех пяти героев ([#68](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/68)) · `d10bc2e`
- **`v0.3.19 · CBA012A`** — Combat-012A: отдельная перезарядка мощных способностей (только движок) ([#67](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/67)) · `ff6b5ad`
- Docs: зафиксировать приёмку Combat-011C-HF1 ([#65](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/65)) · `77679b6`
- **`v0.3.18 · CBA011C-HF1`** — Combat-011C-HF1: один курсор основной цели и удаление индикатора после смерти ([#64](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/64)) · `53586ee`
- **`v0.3.17 · CBA011C`** — Combat-011C: учебная групповая атака в мобильном бою ([#63](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/63)) · `9b009f8`
- **`v0.3.16 · CBA011B`** — Combat-011B: исполнение собственных и групповых способностей (тестовый контур) ([#62](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/62)) · `a66cdad`
- **`v0.3.15 · CBA011A`** — Combat-011A: безопасный резолвер целей + фиксация Combat-010 ([#61](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/61)) · `23cdb46`
- **`v0.3.14 · CBA010`** — Combat-010: фундамент эффектов без изменения баланса ([#60](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/60)) · `aede47b`
- Docs: зафиксировать мобильную приёмку Combat-009 ([#59](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/59)) · `049410d`
- **`v0.3.13 · CBA009`** — Combat-009: мгновенные способности, курсоры целей и подсказки долгим тапом ([#58](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/58)) · `a322cd8`
- **`v0.3.12 · CBA008F-CAMERA`** — Hotfix Combat-008F: вращение камеры iPhone и удержание 400 мс ([#57](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/57)) · `736fcb3`
- **`v0.3.11 · CBA008F`** — Combat-008F: мобильная полировка HUD и сенсорных жестов Safari ([#56](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/56)) · `439ff15`
- **`v0.3.10 · CBA008E`** — Combat-008E: подробная карточка бойца по долгому нажатию на 3D-фигуру ([#55](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/55)) · `3f0c41f`
- **`v0.3.9 · CBA008D-UI-UI`** — Combat-008D-UI: поменять местами карточку цели и кнопки, убрать список бойцов ([#54](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/54)) · `999753f`
- **`v0.3.8 · CBA008D`** — Combat-008D: панель выбранной цели внутри 3D-арены ([#53](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/53)) · `02205bf`
- **`v0.3.7 · CBA008C-TAP`** — Hotfix Combat-008C: восстановить нажатия кнопок после поворота Safari ([#52](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/52)) · `8d1d944`
- **`v0.3.6 · CBA008C-FIX`** — Combat-008C hotfix: поворот iPhone и расстановка 3+2 ([#51](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/51)) · `eb6125e`
- **`v0.3.5 · CBA008C`** — Combat-008C: HP, инициатива, эффекты над бойцами и стартовый зум до текущего предела ([#50](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/50)) · `33e5875`
- **`v0.3.4 · CBA008B`** — Combat-008B: изометрическая камера и расстановка отрядов ([#49](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/49)) · `cc03b98`
- **`v0.3.3 · CBA008A`** — Combat-008A: полноэкранная 3D-арена с интерфейсом внутри сцены ([#48](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/48)) · `12c2882`
- **`v0.3.2 · CB007`** — Combat-007: лечение и выбор всех целей через 3D-арену ([#47](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/47)) · `ae09c0c`
- docs: record accepted Combat-006 mobile review ([#46](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/46)) · `d20db7c`
- **`v0.3.1 · CBA006`** — Combat-006: complete visual wave and battle handoff without changing combat rules ([#45](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/45)) · `ad9f3c3`
- docs: record accepted Combat-005 mobile review ([#44](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/44)) · `54df6d1`
- **`v0.3.0 · CBA005`** — Combat-005: per-character animation profiles and fallback (idle, attack, guard, hit, death) ([#43](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/43)) · `a29d0e8`
- docs: record Combat-004B mobile acceptance ([#42](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/42)) · `a8dc52e`
- **`v0.2.9 · CB004B-UI`** — Combat-004B UI: speed selection in manual and auto battle ([#41](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/41)) · `b815b22`
- **`v0.2.8 · CB004B`** — Combat-004B: shared battle speed for autobattle and future animation ([#40](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/40)) · `26a030c`
- docs: record Combat-004 mobile acceptance (12/12) ([#39](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/39)) · `34ef637`
- **`v0.2.7 · CB004`** — Combat-004: voluntary autobattle with immediate manual takeover ([#38](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/38)) · `8c3ba8a`
- docs: record Combat-Waves-001 owner acceptance ([#37](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/37)) · `7ea34fc`
- **`v0.2.6 · CW001`** — Combat-Waves-001: third demo mission with 2+3 enemy waves ([#36](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/36)) · `5df95ac`
- docs: record Campaign-Content-003 UI acceptance and current status ([#35](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/35)) · `a59c926`
- **`v0.2.5 · CC003-UI`** — Campaign UI: show 1–3★ criteria inside each mission card ([#34](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/34)) · `456cebd`
- CI: remove Node.js 20 deprecation warning ([#33](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/33)) · `4596114`
- **`v0.2.4 · CC003`** — Campaign-Content-003: second demo mission, five enemies, 3★ simulation ([#32](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/32)) · `a5af300`

## 2026-11-05

- docs: record Campaign-Data-002 mobile acceptance 8/8 ([#30](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/30)) · `885d92d`
- **`v0.2.3 · CD002`** — Campaign-Data-002: data-driven chapters, routes and mission unlocks ([#29](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/29)) · `20d87a5`
- docs: record accepted STAR001 with partial mobile verification ([#28](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/28)) · `7f9dd47`
- **`v0.2.2 · STAR001`** — Campaign-Stars-001: configurable mission stars with 8-action challenge ([#27](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/27)) · `e9081d5`
- docs: accept Campaign-001 and propose mission star ratings ([#26](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/26)) · `2442a26`
- **`v0.2.1 · CAM001`** — Campaign-001: first mission loop and persistent completion ([#25](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/25)) · `cafe63f`
- docs: accept Combat-Log-001 and propose Campaign-001 ([#24](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/24)) · `e1402a2`
- **`v0.2.0 · CL001`** — Combat-Log-001: readable battle log and visible build version ([#23](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/23)) · `aa0e89e`
- docs: accept Combat-Events-001 and propose Combat-Log-001 ([#22](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/22)) · `1d6a22c`
- Combat-Events-001: structured combat event batches ([#21](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/21)) · `150973a`
- docs: accept Ability-001 and propose Combat-Events-001 ([#20](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/20)) · `6764d51`
- Ability-001: data-driven demo abilities without gameplay changes ([#19](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/19)) · `b5cf5df`
- docs: accept Save-001 and outline Ability-001 ([#18](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/18)) · `d23b6ee`
- Save-001: persist demo hero progress locally ([#17](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/17)) · `c745e4f`
- docs: record TECH-A01 acceptance and outline Save-001 ([#16](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/16)) · `d8e4fde`
- TECH-A01: CI and 3D startup hardening ([#15](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/15)) · `535bd5c`
- Docs: зафиксировать приёмку Progress-001 (iPhone Safari 11/11) ([#14](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/14)) · `93f08ca`
- Progress-001: награды, уровни и подробная карточка героя ([#13](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/13)) · `8779d69`
- Docs: зафиксировать приёмку Squad-001 (iPhone Safari 10/10) ([#12](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/12)) · `d347859`
- Squad-001: выбор отряда непосредственно перед каждым боем + UI #10 ([#11](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/11)) · `661f297`
- Combat-003B: уникальные тестовые способности и временные эффекты ([#9](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/9)) · `5e56cff`
- docs: вынести подробный регламент AI в AI_WORKFLOW.md ([#8](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/8)) · `5448ada`
- docs: добавить PROJECT_STATUS.md для передачи контекста ([#7](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/7)) · `b436485`
- Combat-003: выбор базовой и особой способности с перезарядкой ([#6](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/6)) · `aca5d84`
- HOTFIX Combat-002: исправить кнопку «Атаковать» ([#5](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/5)) · `47d071e`
- Combat-002: настоящая очередь ходов и ручные базовые атаки ([#4](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/4)) · `f7b174a`
- Combat-001: шкала инициативы 0–1000 и тестовая модель очереди ([#3](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/3)) · `a8ccf40`
- TECH-004A: изоляция правил боя + Combat Specification 1.0 ([#2](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/2)) · `5d56531`
- TECH-003: управление циклом отрисовки Babylon.js ([#1](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/1)) · `7faaf9e`
- Исходный стартер Babylon.js (4 файла), загрузка через веб-интерфейс · `c327468`

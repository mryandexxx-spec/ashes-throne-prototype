# ABILITY-ICON-PROMPTS-001 — промпты для генерации иконок способностей

**Дата:** 19.11.2026. **Статус:** [ПРЕДЛОЖЕНИЕ]. Промпты, а не готовые иконки.
**Источник списка:** `ability-data.js` в `main` `4ccedc0`. Учтены пять героев с 3D-моделями: Рен, Нада, Лиора, Арт, Сава. Тестовые и учебные способности не включены.
**Назначение:** круглые кнопки способностей в бою (ARENA-UI-003) и досье героя.

## 1. Технические требования к результату

- Квадрат 1024×1024, PNG. В игре кадр будет обрезан **кругом** и уменьшен до 56–72 px. Поэтому главный предмет занимает центральные ~70%, по краям только фон.
- **Без текста, букв, цифр и рамок.** Рамку, цвет типа способности и число перезарядки добавляет интерфейс.
- Один крупный, читаемый силуэт. Иконку нужно узнать при размере 48 px и в оттенках серого.
- Генерировать всю серию в одном стиле: тот же базовый промпт, одна модель, по возможности один seed или style reference. После первой удачной иконки использовать её как референс стиля для остальных.

## 2. Базовый промпт стиля (добавлять к каждому)

Промпты на английском: большинство генераторов понимают его точнее.

```
game ability icon, single bold central emblem, painterly hand-painted fantasy style,
muted earthy palette of ash grey, warm bronze and deep umber with one strong accent color,
dramatic rim light, soft dark vignette background, high contrast silhouette readable at small size,
centered composition with empty margins for circular crop, no text, no letters, no border, no frame,
grounded low-magic world, mountain gorge and cliff gardens setting, square 1:1
```

**Негативный промпт** (если генератор поддерживает):

```
text, letters, numbers, watermark, logo, frame, border, UI, multiple objects, cluttered background,
photorealistic photo, 3D render, plastic, neon, sci-fi, lightsaber, modern weapons,
anime, chibi, cartoon outline, glossy mobile-game gem style
```

**Цветовой акцент по типу способности** (подставить в промпт; это помогает различать иконки и без рамки):
- урон по одному врагу — `accent: ember orange`
- урон по группе — `accent: deep crimson`
- защита, прикрытие — `accent: steel blue`
- поддержка, инициатива, сигнал — `accent: pale gold`
- пассивная или лидерская способность — `accent: muted teal`, мотив спокойнее, без движения

Для Midjourney добавить: `--ar 1:1 --style raw --stylize 150`, а после первой удачной иконки — `--sref <URL удачной иконки>`.
Для GPT-image, Ideogram и аналогов: базовый промпт и строка из таблицы ниже одним абзацем.

## 3. Промпты по способностям

Формат: **Название (тип)** — английская строка-сюжет, которая вставляется перед базовым промптом.

### Рен Терен — проводник, ближний бой
| Способность | Сюжет для промпта |
|---|---|
| **Точный удар** (базовая, урон) | `a short curved blade striking forward in a single precise diagonal slash, motion trail, accent: ember orange` |
| **Найти брешь** (особая, урон + ослабление) | `a blade tip aimed at a glowing crack in a raised wooden shield, the crack splitting, accent: ember orange` |
| **Сорвать построение** (мощная, урон) | `a boot and blade breaking through a line of three standing shields, shields scattering, dust burst, accent: ember orange` |
| **Чувство тропы** (пассивная) | `a narrow cliff path of stepping stones winding over an abyss, faint footprints, calm, accent: muted teal` |

### Нада — поддержка, стрелок-наблюдатель
| Способность | Сюжет для промпта |
|---|---|
| **Прицельное действие** (базовая, урон + метка) | `a drawn bow with a single arrow aimed straight at the viewer, a small target mark on the arrow tip, accent: ember orange` |
| **Найти закономерность** (особая, урон) | `three arrows hitting the same spot in a pattern, faint connecting lines between impact points, accent: ember orange` |
| **Разгадать замысел** (мощная, урон по всем) | `a hand-drawn tactical sketch of enemy positions on parchment pierced by several arrows, accent: deep crimson` |
| **Внимание к деталям** (пассивная) | `a single eye reflected in a small hand lens over a footprint in dust, accent: muted teal` |

### Лиора Вель — защитник со щитом
| Способность | Сюжет для промпта |
|---|---|
| **Удар щитом** (базовая, урон) | `a round bronze-rimmed shield bashing forward with an impact shockwave, accent: ember orange` |
| **Под прикрытием** (особая, защита себя + провокация) | `a raised round shield with arrows deflecting off it, a defiant glow around the rim, accent: steel blue` |
| **Держать строй** (мощная, защита всего отряда) | `three overlapping shields forming a wall, a shared protective glow behind them, accent: steel blue` |
| **Ответственность за своих** (пассивная) | `a gauntleted hand resting protectively on a smaller shoulder, calm, accent: muted teal` |
| **Опора отряда** (лидерская) | `a single shield planted in rocky ground like a standard, small figures sheltered behind it, accent: muted teal` |

### Арт — страховщик, защита
| Способность | Сюжет для промпта |
|---|---|
| **Сбить шаг** (базовая, урон) | `a heavy boot sweeping an enemy's foot off a rock ledge, pebbles falling, accent: ember orange` |
| **Страховочный узел** (особая, защита союзника) | `a climbing rope tied in a strong knot around a carabiner-like iron ring, rope taut, accent: steel blue` |
| **Снять нагрузку** (мощная, урон) | `a rope pulled sharply so an enemy loses footing, a broken anchor peg flying, accent: ember orange` |
| **Знать предел** (пассивная) | `a frayed rope with one strand still holding, a steady hand gripping just above the fray, accent: muted teal` |
| **Работа по риску** (лидерская) | `a coiled rope and a hammer with anchor pegs laid out neatly on a cliff edge, accent: muted teal` |

### Сава — поддержка, координация
| Способность | Сюжет для промпта |
|---|---|
| **Отметить момент** (базовая, урон + ускорение союзника) | `a quick thrown stone with a small hourglass glinting beside it, accent: pale gold` |
| **Передать сигнал** (особая, помощь союзнику) | `a raised hand holding a small polished mirror flashing a beam of light across a gorge, accent: pale gold` |
| **Согласованный шаг** (мощная, усиление себя) | `two pairs of footprints falling into perfect step on a stone path, a rhythmic glow, accent: pale gold` |
| **Заметить вовремя** (пассивная) | `a small alert bird taking off from a cliff branch as an early warning, calm, accent: muted teal` |
| **Полевая координация** (лидерская) | `a hand-drawn route map with several small arrows converging on one point, accent: muted teal` |

## 4. Порядок работы

1. Сгенерировать одну пробную иконку («Точный удар» Рена), уменьшить её до 64 px в круге и проверить читаемость.
2. Если стиль подходит, использовать эту иконку как style reference и сгенерировать остальные.
3. Положить файлы в `assets/icons/abilities/<hero>-<ability>.webp` (512×512, WebP q85; одна иконка ≈ 30–60 КБ) и передать их ассистенту для подключения в ARENA-UI-003.

**Ограничения:** сюжеты иконок — художественные трактовки названий способностей, а не канон. Если сюжет противоречит образу героя в приватном репозитории, правится строка в таблице.

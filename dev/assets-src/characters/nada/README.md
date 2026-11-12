# Нада — оригинал и оптимизированный игровой GLB

**Статус:** [В РАЗРАБОТКЕ] до загрузки бинарного ассета и проверки Babylon/WebKit.

**Исходник (получен от владельца):** `Meshy_AI_model_20261112_animated_mixamo_All_animation-2.glb`
- 6 113 468 байт; SHA-256 `4f96367c378c754433fcfb5264dbd5e4581cdb0e26f08e941f996b93d6a92cb3`.
- Один skinned mesh; 16 673 вершины; 17 381 треугольник; 66 костей; 8 анимаций.

**Оптимизированная версия:** `Nada_Mobile_Optimized_Animated_v1.glb`
- 3 096 808 байт; SHA-256 `1ecd7859754191e296c68171c03a2c180859db52957629905a90cd8d7a61e87d`.
- Оригинальная топология и скелет сохранены, 2048×2048 baseColor PNG перекодирована в JPEG, избыточные анимационные каналы удалены.
- Контракт анимаций: `Running`, `Walking`, `Archery_Shot_3`, `Electrocuted_Fall`, `Hit_Reaction_1`, `Idle_11`, `Lean_Forward_Sprint_inplace`, `mage_soell_cast`.

Как в Дюне: `dev/assets-src/characters/nada/` содержит исходники и объяснения, `dev/assets/models/` — только игровой экспорт, `dev/src/assets/models.js` — регистр URL. Сборщик Дюны не переносится.

**Загрузка бинарника вручную (разово):** добавить локальный файл `Nada_Mobile_Optimized_Animated_v1.glb` по точному пути `dev/assets/models/nada-mobile-animated.glb` в ветку `feat/nada-3d-dev-assets-integration`. Исходный полный файл 6,1 МБ можно отдельно положить сюда после проверки лицензий/происхождения, но он не должен загружаться браузером. Не складывать в game assets 2 экземпляра одного GLB.

Проверки: хеш; клипы и скелет; портретный fallback; прекращение загрузки после закрытия; iPhone landscape, safe area, нагрев; бой победа/смерть/повтор. Ни одной проверки реального iPhone пока нет.

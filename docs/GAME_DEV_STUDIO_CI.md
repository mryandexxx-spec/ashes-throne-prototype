# Game Development Studio — GitHub Actions readiness

**[В РАЗРАБОТКЕ — DIAGNOSTIC ONLY]** Первая интеграционная ступень: установить и проверить сторонний CLI `game-dev` на одноразовом GitHub-hosted Ubuntu runner. Это **не** интеграция ENV021 в игру и **не** разрешение на merge.

## Источник и защита от подмены

- Официальный исходный код: https://github.com/theisegoria/game-development-studio
- Официальная инструкция: https://github.com/theisegoria/game-development-studio/blob/main/docs/install.md
- Проверенный GitHub Release: `v1.5.1`, `theisegoria-game-development-studio-1.5.1.tgz`
- GitHub release API digest (SHA-256): `9f641ed65f47059936169cb5b9ecdae8ddab7df38f1f51e6124f0d720388ee43`
- `SHA256SUMS.txt` скачивается отдельно и сверяется с закреплённым digest.
- Установка выполняется с `--ignore-scripts` и `--prefix` внутри `RUNNER_TEMP`; нет глобальной установки на устройстве владельца. Сторонний исполняемый код запускается только после проверки digest.

## Процесс

Workflow: `.github/workflows/game-dev-studio-readiness.yml`

1. На Ubuntu 24.04 подготовить Node.js 22.
2. Скачать закреплённый release tarball и сверить SHA-256 с зафиксированным значением.
3. Установить CLI во временный каталог.
4. Выполнить **только операции чтения**: `game-dev --version`, `game-dev capabilities --json`, `game-dev doctor --json`.
5. Убедиться, что ответы — корректный JSON. В GitHub Step Summary выводится лишь минимальный итог; подробные JSON-ответы остаются временными файлами runner и не публикуются как артефакты.

Запуск на PR, меняющем этот workflow или документ, и явный `workflow_dispatch` после попадания workflow в default branch. Установка по release-архиву не требует провайдерского аккаунта или платных кредитов.

## Что эта проверка НЕ доказывает

- CLI не подключён напрямую к чату или плагину через серверный MCP.
- Реальный ENV021 GLB **не** передаётся и **не** проверяется.
- Blender, WebGL, Babylon, Apple Safari, iPhone, PBR/LOD и оптимизация **не** запускались этой процедурой.
- Никаких `--confirm`, `--allow-gpu`, `--allow-performance` или `--approve-spend`; платные провайдеры и публикация исключены.
- Проверка стороннего CLI не превращает созданные ранее художественные концепции в утверждённый канон или игровую геометрию.

## Следующий этап после успешного CI

На **отдельное согласование** подготовить считывание артефакта GLB Pass012 из существующего PR #221, статическую проверку `game-dev asset inspect <scene.glb> --json` и ограниченную валидацию по явно описанной политике. Не копировать материалы из внешних источников, не изменять `main` или бой. Для GPU-захватов и записи файлов предусмотреть индивидуальное разрешение согласно регламенту Game Development Studio.

Главный игровой статус — `docs/PROJECT_STATUS.md`; художественный handoff ENV021 хранится в экспериментальном Draft PR #221.

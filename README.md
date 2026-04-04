# Hackpet

Веб-платформа обучения по безопасной разработке (secure coding, DevSecOps): курсы, интерактивные модули, лабы с автопроверкой кода (AST), прогресс и сертификаты.

## Архитектура

- **Backend (Go)**: chi-роутер, handlers для modules/labs/submit/telemetry/quiz, file store (JSON из `data/modules/`), in-memory попытки.
- **Validator**: парсинг Go через `go/parser`, проверки правил без запуска кода (no raw `os.Open(userInput)`, `filepath.Clean`, path inside baseDir, `http.Error` с 403/404).
- **Frontend**: React (Vite), каталог модулей → теория → чекпоинт-квиз (ответы показываются только после прохождения) → лаба (редактор кода без списка файлов) → Submit → rule_results и подсказки → разбор фикса → финальный квиз → итог.

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/register` | Регистрация: `{ "email", "nickname", "password" }` → `{ "token", "user" }` |
| POST | `/api/auth/login` | Вход: `{ "email", "password" }` → `{ "token", "user" }` |
| GET | `/api/auth/me` | Текущий пользователь (заголовок `Authorization: Bearer <token>`) |
| GET | `/api/courses` | Список курсов (прогресс по user из JWT) |
| GET | `/api/modules/{moduleId}` | Модуль с прогрессом пользователя |
| POST | `/api/labs/{labId}/submit` | Отправка кода → привязка к user |
| POST | `/api/telemetry` | (опц.) телеметрия |
| POST | `/api/quizzes/{quizId}/answer` | (опц.) ответ на вопрос квиза |

## Структура проекта

```
hackpet/
├── go.mod
├── Dockerfile.backend      # образ backend (Go)
├── docker-compose.yml      # postgres + backend + frontend
├── docker/postgres/init/   # SQL-скрипты при первом старте контейнера
├── backend/
│   ├── main.go
│   ├── api/
│   ├── config/
│   ├── handler/
│   ├── pkg/
│   ├── repository/
│   ├── service/
│   ├── store/
│   └── validator/
├── data/modules/
├── frontend/          # React (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── package.json
└── README.md
```

## Запуск через Docker (все три сервиса)

БД + бэкенд + фронт одним командой:

```bash
docker compose up -d
```

- **postgres** — PostgreSQL 16, порт 5432. При первом старте выполняются скрипты из `docker/postgres/init/` (таблицы `users`, `module_progress`, `lab_attempts`, `quiz_answers`). Данные в volume `hackpet_pgdata`.
- **backend** — Go API на порту **8080**.
- **frontend** — отдельный React/Vite контейнер на порту **5173** (proxy `/api` → `backend:8080` внутри docker-сети).

Открой фронт: **http://localhost:5173**
API: **http://localhost:8080**

Пересборка после изменений: `docker compose up -d --build`. Остановка: `docker compose down`.

В `.env` на хосте задай `JWT_SECRET` (любая длинная строка) и при необходимости `DB_DSN` (если бэкенд не в Docker и подключается к своей БД).

## Авторизация

При запуске с **DB_DSN** и **JWT_SECRET** доступны регистрация и вход. Пользователи и питомцы хранятся в Postgres; прогресс по модулям, попытки лаб и ответы на квизы привязаны к пользователю. Токен передаётся в заголовке `Authorization: Bearer <token>`; фронт сохраняет его в `localStorage` и подставляет в запросы. Без БД прогресс остаётся в файле (анонимный режим).

## Запуск без Docker (разработка)

**Локально:** бэкенд и фронт отдельно, фронт с hot-reload.

```bash
# Терминал 1 — бэкенд
cd hackpet && go mod tidy && go run ./backend

# Терминал 2 — фронт (проксирует /api на :8080)
cd hackpet/frontend && npm i && npm run dev
```

Открой: http://localhost:5173

**Продакшен (одним сервером):**

```bash
cd hackpet/frontend && npm i && npm run build
cd .. && go run ./backend
```

Открой: http://localhost:8080 (Go раздаёт SPA из `frontend/dist`; при отсутствии — из `static/`).

Модули — из `data/modules/`. Переменная `DATA_PATH` задаёт другую папку.

## Примеры вызовов API (curl)

```bash
# Список модулей
curl -s http://localhost:8080/api/modules

# Модуль по id
curl -s http://localhost:8080/api/modules/path-traversal

# Submit лабы (тело — код из лабы или исправленный)
curl -s -X POST http://localhost:8080/api/labs/path-traversal-lab/submit \
  -H "Content-Type: application/json" \
  -d '{"submission_id":"test1","files":[{"path":"main.go","content":"package main\n\nimport (\n\t\"net/http\"\n\t\"os\"\n\t\"path/filepath\"\n\t\"strings\"\n)\n\nconst baseDir = \"./files\"\n\nfunc downloadHandler(w http.ResponseWriter, r *http.Request) {\n\tfilename := r.URL.Query().Get(\"file\")\n\tif filename == \"\" {\n\t\thttp.Error(w, \"missing file\", http.StatusBadRequest)\n\t\treturn\n\t}\n\tclean := filepath.Clean(filepath.Join(baseDir, filename))\n\trel, err := filepath.Rel(baseDir, clean)\n\tif err != nil || strings.Contains(rel, \"..\") {\n\t\thttp.Error(w, \"forbidden\", http.StatusForbidden)\n\t\treturn\n\t}\n\tf, err := os.Open(clean)\n\tif err != nil {\n\t\thttp.Error(w, \"not found\", http.StatusNotFound)\n\t\treturn\n\t}\n\tdefer f.Close()\n}\n"}]}'
```

## Демо-модуль: Path Traversal

- Уязвимость: эндпоинт скачивания файла с `os.Open(filename)` по пользовательскому вводу.
- Правила: blocker — нет `os.Open(userInput)` без нормализации; major — есть `filepath.Clean` и проверка пути внутри baseDir; minor — `http.Error` с 403/404.
- Три уровня подсказок без полного копипаста решения.

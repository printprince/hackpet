package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"hackpet/backend/validator"
)

var ErrUserNotFound = errors.New("user not found")

// PgStore — пользователи, питомцы, прогресс и попытки в Postgres.
type PgStore struct {
	pool *pgxpool.Pool
}

func NewPgStore(ctx context.Context, dsn string) (*PgStore, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`); err != nil {
		pool.Close()
		return nil, err
	}
	// Гарантируем наличие полей ФИО для уже существующих БД.
	if _, err := pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS patronymic TEXT NOT NULL DEFAULT ''`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE pets ADD COLUMN IF NOT EXISTS equipped_aura TEXT NOT NULL DEFAULT 'none'`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE pets ADD COLUMN IF NOT EXISTS equipped_variant TEXT NOT NULL DEFAULT 'classic'`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE pets ADD COLUMN IF NOT EXISTS equipped_frame TEXT NOT NULL DEFAULT 'ring'`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE pets ADD COLUMN IF NOT EXISTS pet_variants JSONB NOT NULL DEFAULT '{}'::jsonb`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM pg_constraint
				WHERE conname = 'users_role_check'
			) THEN
				ALTER TABLE users
				ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
			END IF;
		END $$`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS focus_suggestions (
			id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			code              TEXT NOT NULL UNIQUE,
			title             TEXT NOT NULL,
			description       TEXT NOT NULL DEFAULT '',
			min_completed     INT,
			max_completed     INT,
			min_in_progress   INT,
			max_in_progress   INT,
			min_attempts      INT,
			max_attempts      INT,
			priority          INT NOT NULL DEFAULT 100,
			is_active         BOOLEAN NOT NULL DEFAULT TRUE,
			created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS best_practices (
			id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			code              TEXT NOT NULL UNIQUE,
			title             TEXT NOT NULL,
			description       TEXT NOT NULL DEFAULT '',
			priority          INT NOT NULL DEFAULT 100,
			is_active         BOOLEAN NOT NULL DEFAULT TRUE,
			created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS user_todos (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title       TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			priority    SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1,2,3)),
			done        BOOLEAN NOT NULL DEFAULT FALSE,
			position    INT NOT NULL DEFAULT 0,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_user_todos_user_position ON user_todos(user_id, position, created_at)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS play_snippets (
			id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			language              TEXT NOT NULL,
			topic                 TEXT NOT NULL,
			code                  TEXT NOT NULL,
			is_vulnerable         BOOLEAN NOT NULL,
			vulnerability_type    TEXT NOT NULL,
			explanation_vulnerable TEXT NOT NULL,
			explanation_safe      TEXT NOT NULL,
			is_active             BOOLEAN NOT NULL DEFAULT TRUE,
			created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS play_fix_options (
			id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			snippet_id UUID NOT NULL REFERENCES play_snippets(id) ON DELETE CASCADE,
			text       TEXT NOT NULL,
			correct    BOOLEAN NOT NULL DEFAULT FALSE
		)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO focus_suggestions (code, title, description, min_completed, max_completed, min_in_progress, max_in_progress, min_attempts, max_attempts, priority, is_active) VALUES
			('start_first_course', 'Начни первый курс', 'Открой курс и активируй его, чтобы получить доступ к модулям.', 0, 0, NULL, NULL, NULL, NULL, 300, TRUE),
			('first_module_today', 'Пройди первый модуль', 'После старта курса закончи первый модуль сегодня, чтобы закрепить темп.', 0, 1, NULL, NULL, NULL, NULL, 290, TRUE),
			('pick_single_track', 'Сфокусируйся на одном курсе', 'Не распыляйся: сначала закрой ключевые модули одного трека.', NULL, NULL, 2, NULL, NULL, NULL, 280, TRUE),
			('finish_in_progress', 'Закрой модуль в процессе', 'Выбери модуль со статусом "в процессе" и доведи его до конца.', NULL, NULL, 1, NULL, NULL, NULL, 270, TRUE),
			('review_fix_notes', 'Пересмотри разбор фикса', 'Перед новой отправкой перечитай блок fix и чек-лист PR.', NULL, NULL, NULL, NULL, 2, NULL, 265, TRUE),
			('limit_lab_attempts', 'Снизь число повторных попыток', 'Сначала исправляй критичные замечания, затем отправляй лабу повторно.', NULL, NULL, NULL, NULL, 3, NULL, 260, TRUE),
			('checkpoint_quiz_attention', 'Проверь ответы чекпоинт-квиза', 'Если тест пройден неуверенно, повтори теорию перед лабораторной.', NULL, NULL, NULL, NULL, NULL, NULL, 250, TRUE),
			('daily_small_step', 'Сделай один маленький шаг', 'Даже один завершенный шаг в день лучше, чем длинные паузы в обучении.', NULL, NULL, NULL, NULL, NULL, NULL, 240, TRUE),
			('secure_review_focus', 'Сфокусируйся на secure-review', 'В текущем PR проверь авторизацию, валидацию входа и обработку ошибок.', 1, NULL, NULL, NULL, NULL, NULL, 230, TRUE),
			('anti_pattern_check', 'Проверь анти-паттерны', 'Перед коммитом сверяйся со списком anti-pattern из модуля.', 1, NULL, NULL, NULL, NULL, NULL, 225, TRUE),
			('finish_two_modules', 'План: 2 модуля за неделю', 'Сделай реалистичный недельный план и закрой минимум два модуля.', 1, 4, NULL, NULL, NULL, NULL, 220, TRUE),
			('streak_focus', 'Поддерживай учебный ритм', 'Поддерживай серию: возвращайся в курс каждый день хотя бы на 20 минут.', 2, NULL, NULL, NULL, NULL, NULL, 215, TRUE),
			('quality_over_speed', 'Качество важнее скорости', 'Лучше меньше попыток, но с разбором причин и исправлением.', NULL, NULL, NULL, NULL, NULL, NULL, 210, TRUE),
			('prepare_final_quiz', 'Подготовься к финальному тесту', 'Систематизируй теорию и ключевые ошибки перед финальным квизом.', 2, NULL, NULL, NULL, NULL, NULL, 205, TRUE),
			('document_learnings', 'Фиксируй выученное', 'Записывай 2-3 вывода по каждому пройденному модулю.', 1, NULL, NULL, NULL, NULL, NULL, 200, TRUE),
			('complexity_control', 'Упрощай решение лабы', 'Если решение стало сложным, перепроверь критерии и упрости подход.', NULL, NULL, NULL, NULL, 2, NULL, 195, TRUE),
			('focus_on_blockers', 'Сначала закрывай блокеры', 'Исправляй критичные замечания до косметических правок.', NULL, NULL, NULL, NULL, 1, NULL, 190, TRUE),
			('from_theory_to_practice', 'Свяжи теорию с практикой', 'После чтения теории сразу применяй прием на практике в коде.', NULL, NULL, NULL, NULL, NULL, NULL, 180, TRUE),
			('consistent_progress', 'Двигайся последовательно', 'Закрывай начатое, а затем переходи к следующему модулю.', NULL, NULL, 1, NULL, NULL, NULL, 175, TRUE),
			('final_push', 'Финишный рывок', 'До конца недели добей открытые модули и зафиксируй итоговые выводы.', 3, NULL, NULL, NULL, NULL, NULL, 170, TRUE)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			min_completed = EXCLUDED.min_completed,
			max_completed = EXCLUDED.max_completed,
			min_in_progress = EXCLUDED.min_in_progress,
			max_in_progress = EXCLUDED.max_in_progress,
			min_attempts = EXCLUDED.min_attempts,
			max_attempts = EXCLUDED.max_attempts,
			priority = EXCLUDED.priority,
			is_active = EXCLUDED.is_active`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO best_practices (code, title, description, priority, is_active) VALUES
			('validate-on-boundary', 'Валидируй на границе сервиса', 'Проверяй вход в handler/usecase, чтобы не разносить проверки по всей системе.', 300, TRUE),
			('fail-closed', 'Fail closed по умолчанию', 'Если есть сомнение в доступе или данных — отклоняй запрос, а не пропускай.', 295, TRUE),
			('least-privilege', 'Минимально необходимые права', 'Токены, роли и сервисные аккаунты должны иметь только нужные разрешения.', 290, TRUE),
			('auth-before-action', 'Авторизация до бизнес-логики', 'Проверяй право на действие до изменения данных и до тяжелых операций.', 285, TRUE),
			('explicit-ownership-check', 'Явная проверка владения ресурсом', 'Всегда проверяй, что пользователь имеет доступ к конкретному объекту.', 280, TRUE),
			('normalize-paths', 'Нормализуй пути и URI', 'Используй filepath.Clean/Rel и whitelist для защиты от traversal и обходов.', 275, TRUE),
			('no-secret-in-logs', 'Не логируй секреты', 'Пароли, токены, DSN и персональные данные не должны попадать в логи.', 270, TRUE),
			('structured-logs', 'Структурированные логи', 'Логируй событие, user_id, module_id и причину ошибки в одном формате.', 265, TRUE),
			('consistent-errors', 'Единая модель ошибок API', 'Возвращай предсказуемые коды/форматы ошибок, без утечки внутренних деталей.', 260, TRUE),
			('idempotent-updates', 'Идемпотентные обновления', 'Для повторных запросов обеспечивай безопасный одинаковый результат.', 255, TRUE),
			('database-constraints', 'Дублируй инварианты в БД', 'CHECK/UNIQUE/FK защищают от неконсистентности даже при баге в приложении.', 250, TRUE),
			('safe-migrations', 'Миграции без даунтайма', 'Делай изменения схемы поэтапно: add -> backfill -> switch -> cleanup.', 245, TRUE),
			('small-atomic-commits', 'Маленькие атомарные коммиты', 'Один коммит — одна цель; так проще ревью, откат и поиск регрессий.', 240, TRUE),
			('feature-flags', 'Feature flag для рискованных фич', 'Новые сценарии включай постепенно, а не сразу для всех пользователей.', 235, TRUE),
			('retry-with-jitter', 'Retry с jitter', 'Для внешних вызовов используй ограниченный retry с экспонентой и jitter.', 230, TRUE),
			('timeout-everywhere', 'Таймауты на I/O', 'Любой HTTP/DB/file I/O должен иметь таймаут, чтобы не висеть бесконечно.', 225, TRUE),
			('sanitize-html-output', 'Санитайз выходной контент', 'Перед рендером пользовательских данных исключай инъекции в UI.', 220, TRUE),
			('defense-in-depth', 'Defense in depth', 'Комбинируй проверку на уровне UI, API, сервиса и БД, а не полагайся на один слой.', 215, TRUE),
			('track-security-metrics', 'Следи за security-метриками', 'Собирай частоту 401/403/5xx и повторных попыток, чтобы видеть аномалии.', 210, TRUE),
			('review-rules', 'Чек-лист ревью безопасности', 'В каждом PR проверяй auth, validation, error handling и работу с файлами.', 205, TRUE)
		ON CONFLICT (code) DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			priority = EXCLUDED.priority,
			is_active = EXCLUDED.is_active`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO play_snippets (id, language, topic, code, is_vulnerable, vulnerability_type, explanation_vulnerable, explanation_safe, is_active) VALUES
			('11111111-1111-1111-1111-111111111111', 'python', 'sql_injection',
			 E'def find_user(conn, email):
    cur = conn.cursor()
    query = f"SELECT id, email, role FROM users WHERE email = ''{email}''"
    cur.execute(query)
    row = cur.fetchone()
    if row:
        return {"id": row[0], "email": row[1], "role": row[2]}
    return None',
			 TRUE,
			 'sql_injection',
			 E'Строка запроса собирается через f-string с подстановкой email без параметров — классическая SQL-инъекция. Нужно использовать параметризованный запрос.',
			 E'Безопасный вариант использует плейсхолдеры и передачу параметров отдельно от текста SQL.',
			 TRUE),
			('22222222-2222-2222-2222-222222222222', 'python', 'logging',
			 E'def login_user(logger, request_id, email, password):
    try:
        # ... auth flow ...
        raise ValueError("invalid credentials")
    except Exception as err:
        logger.error("auth failed for %s password=%s req=%s err=%s", email, password, request_id, err)
        return {"ok": False}',
			 TRUE,
			 'sensitive_logging',
			 E'В лог пишется пароль пользователя. Так делать нельзя — секреты не должны попадать в логи.',
			 E'Безопасный вариант логирует только техническую информацию (request_id, путь, код ошибки), но не секреты.',
			 TRUE),
			('33333333-3333-3333-3333-333333333333', 'python', 'path_traversal',
			 E'def download_file(request):
    filename = request.args.get("name", "")
    base_dir = "/var/app/uploads/"
    target_path = base_dir + filename

    with open(target_path, "rb") as f:
        data = f.read()

    return data',
			 TRUE,
			 'path_traversal',
			 E'Путь к файлу собирается конкатенацией с пользовательским вводом без нормализации и проверки — возможен path traversal.',
			 E'Безопасный вариант нормализует путь и проверяет, что он остаётся внутри разрешённой директории.',
			 TRUE),
			('44444444-4444-4444-4444-444444444444', 'python', 'xss',
			 E'def render_post(title, author):
    html = "<section class=''post''>"
    html += f"<h1>{title}</h1>"
    html += f"<p>Автор: {author}</p>"
    html += "</section>"
    return html',
			 TRUE,
			 'xss',
			 E'Заголовок выводится в HTML без экранирования — если title содержит HTML/JS, получится XSS.',
			 E'Безопасный вариант использует шаблонизатор с экранированием или явное escaping.',
			 TRUE)
		ON CONFLICT (id) DO UPDATE SET
			language = EXCLUDED.language,
			topic = EXCLUDED.topic,
			code = EXCLUDED.code,
			is_vulnerable = EXCLUDED.is_vulnerable,
			vulnerability_type = EXCLUDED.vulnerability_type,
			explanation_vulnerable = EXCLUDED.explanation_vulnerable,
			explanation_safe = EXCLUDED.explanation_safe,
			is_active = EXCLUDED.is_active`); err != nil {
		pool.Close()
		return nil, err
	}
	// Безопасные сниппеты — добавляются отдельно чтобы не менять длину основного INSERT.
	if _, err := pool.Exec(ctx, `
		INSERT INTO play_snippets (id, language, topic, code, is_vulnerable, vulnerability_type, explanation_vulnerable, explanation_safe, is_active) VALUES
		('55555555-5555-5555-5555-555555555555', 'python', 'sql_injection',
		 E'def find_user(conn, email):\n    cur = conn.cursor()\n    cur.execute(\n        "SELECT id, email, role FROM users WHERE email = %s",\n        (email,)\n    )\n    row = cur.fetchone()\n    if row:\n        return {"id": row[0], "email": row[1], "role": row[2]}\n    return None',
		 FALSE,
		 'sql_injection',
		 E'Этот код безопасен — данные передаются через плейсхолдер %s отдельно от SQL. SQL-инъекция здесь невозможна.',
		 E'Верно! Параметризованный запрос — правильный способ: email передаётся как отдельный аргумент, а не вставляется в строку запроса.',
		 TRUE),
		('66666666-6666-6666-6666-666666666666', 'python', 'logging',
		 E'def login_user(logger, request_id, email, password):\n    try:\n        # ... auth flow ...\n        raise ValueError("invalid credentials")\n    except Exception as err:\n        logger.error(\n            "auth failed req=%s code=%s",\n            request_id, type(err).__name__\n        )\n        return {"ok": False}',
		 FALSE,
		 'sensitive_logging',
		 E'Этот код безопасен — в лог попадает только request_id и тип ошибки, без секретных данных.',
		 E'Верно! Логируется только технический идентификатор и тип ошибки. Email и пароль в лог не попадают — всё сделано правильно.',
		 TRUE),
		('77777777-7777-7777-7777-777777777777', 'python', 'path_traversal',
		 E'import os\nfrom flask import abort\n\ndef download_file(request):\n    filename = request.args.get("name", "")\n    base_dir = "/var/app/uploads/"\n    safe_path = os.path.normpath(os.path.join(base_dir, filename))\n    if os.path.commonpath([base_dir, safe_path]) != base_dir:\n        abort(403)\n    with open(safe_path, "rb") as f:\n        data = f.read()\n    return data',
		 FALSE,
		 'path_traversal',
		 E'Этот код безопасен — путь нормализуется через normpath и проверяется через commonpath.',
		 E'Верно! os.path.normpath убирает ../.. последовательности, а os.path.commonpath гарантирует, что путь остаётся внутри base_dir.',
		 TRUE),
		('88888888-8888-8888-8888-888888888888', 'python', 'xss',
		 E'from markupsafe import escape\n\ndef render_post(title, author):\n    html = "<section class=''post''>"\n    html += f"<h1>{escape(title)}</h1>"\n    html += f"<p>Автор: {escape(author)}</p>"\n    html += "</section>"\n    return html',
		 FALSE,
		 'xss',
		 E'Этот код безопасен — escape() из markupsafe экранирует все HTML-символы.',
		 E'Верно! escape() преобразует <, >, &, ", '' в HTML-сущности. Даже если title содержит JS, он будет выведен как текст, а не выполнен.',
		 TRUE),
		('99999999-9999-9999-9999-999999999999', 'python', 'sql_injection',
		 E'def search_products(conn, name):\n    cur = conn.cursor()\n    query = "SELECT id, name, price FROM products WHERE name LIKE %s"\n    cur.execute(query, (f"%{name}%",))\n    return cur.fetchall()',
		 FALSE,
		 'sql_injection',
		 E'Этот код безопасен — даже с LIKE шаблоном данные передаются через плейсхолдер.',
		 E'Верно! Параметр для LIKE собирается в Python-строке, но передаётся через %s — SQL-инъекция невозможна.',
		 TRUE),
		('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'python', 'xss',
		 E'from jinja2 import Environment, select_autoescape\n\nenv = Environment(autoescape=select_autoescape(["html"]))\ntemplate = env.from_string("<h1>{{ title }}</h1><p>{{ body }}</p>")\n\ndef render_page(title, body):\n    return template.render(title=title, body=body)',
		 FALSE,
		 'xss',
		 E'Этот код безопасен — Jinja2 с autoescape автоматически экранирует все переменные в HTML.',
		 E'Верно! select_autoescape(["html"]) включает автоэскейп для HTML-шаблонов. {{ title }} будет экранировано автоматически.',
		 TRUE)
		ON CONFLICT (id) DO UPDATE SET
			language = EXCLUDED.language,
			topic = EXCLUDED.topic,
			code = EXCLUDED.code,
			is_vulnerable = EXCLUDED.is_vulnerable,
			vulnerability_type = EXCLUDED.vulnerability_type,
			explanation_vulnerable = EXCLUDED.explanation_vulnerable,
			explanation_safe = EXCLUDED.explanation_safe,
			is_active = EXCLUDED.is_active`); err != nil {
		pool.Close()
		return nil, err
	}
	// Дополнительные сниппеты — расширенный набор тем и языков.
	if _, err := pool.Exec(ctx, `
		INSERT INTO play_snippets (id, language, topic, code, is_vulnerable, vulnerability_type, explanation_vulnerable, explanation_safe, is_active) VALUES

		-- SSRF уязвимый
		('b1000000-0000-0000-0000-000000000001', 'python', 'ssrf',
		 E'import requests\n\ndef fetch_url(url):\n    resp = requests.get(url)\n    return resp.text',
		 TRUE, 'ssrf',
		 E'requests.get принимает любой URL от пользователя без проверки схемы и хоста — атакующий может запросить http://169.254.169.254/latest/meta-data/ (AWS metadata) или внутренние сервисы.',
		 E'Безопасный вариант проверяет схему (только http/https) и хост по allowlist перед выполнением запроса.',
		 TRUE),

		-- SSRF безопасный
		('b1000000-0000-0000-0000-000000000002', 'python', 'ssrf',
		 E'import urllib.parse\nimport requests\n\nALLOWED_HOSTS = {"api.example.com", "cdn.example.com"}\n\ndef fetch_url(url):\n    p = urllib.parse.urlparse(url)\n    if p.scheme not in ("http", "https"):\n        abort(400)\n    if p.hostname not in ALLOWED_HOSTS:\n        abort(403)\n    resp = requests.get(url, timeout=5)\n    return resp.text',
		 FALSE, 'ssrf',
		 E'Этот код безопасен — схема и хост явно проверяются по allowlist, file:// и внутренние адреса заблокированы.',
		 E'Верно! urlparse разбирает URL, проверяется схема (только http/https) и hostname по списку разрешённых хостов. SSRF невозможен.',
		 TRUE),

		-- Command injection уязвимый
		('b2000000-0000-0000-0000-000000000001', 'python', 'command_injection',
		 E'import subprocess\n\ndef ping_host(hostname):\n    cmd = f"ping -c 1 {hostname}"\n    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)\n    return result.stdout',
		 TRUE, 'command_injection',
		 E'shell=True + f-string с пользовательским hostname — классическая инъекция команд. hostname="; rm -rf /" выполнит удаление файлов на сервере.',
		 E'Безопасный вариант передаёт аргументы списком без shell=True, исключая интерпретацию метасимволов.',
		 TRUE),

		-- Command injection безопасный
		('b2000000-0000-0000-0000-000000000002', 'python', 'command_injection',
		 E'import subprocess\nimport re\n\ndef ping_host(hostname):\n    if not re.match(r"^[a-zA-Z0-9.\-]+$", hostname):\n        raise ValueError("Invalid hostname")\n    result = subprocess.run(\n        ["ping", "-c", "1", hostname],\n        capture_output=True, text=True, timeout=5\n    )\n    return result.stdout',
		 FALSE, 'command_injection',
		 E'Этот код безопасен — hostname валидируется regex, команда передаётся списком без shell=True.',
		 E'Верно! Два уровня защиты: валидация hostname по regex и передача аргументов списком (без shell=True). Инъекция команд невозможна.',
		 TRUE),

		-- SQL injection через ORDER BY уязвимый
		('b3000000-0000-0000-0000-000000000001', 'python', 'sql_injection',
		 E'def get_products(conn, sort_field):\n    cur = conn.cursor()\n    query = f"SELECT id, name, price FROM products ORDER BY {sort_field}"\n    cur.execute(query)\n    return cur.fetchall()',
		 TRUE, 'sql_injection',
		 E'sort_field вставляется напрямую в запрос. ORDER BY не поддерживает параметризацию, но можно использовать allowlist допустимых полей.',
		 E'Безопасный вариант проверяет sort_field по allowlist разрешённых имён столбцов.',
		 TRUE),

		-- SQL injection через ORDER BY безопасный
		('b3000000-0000-0000-0000-000000000002', 'python', 'sql_injection',
		 E'ALLOWED_SORT = {"id", "name", "price", "created_at"}\n\ndef get_products(conn, sort_field):\n    if sort_field not in ALLOWED_SORT:\n        sort_field = "id"\n    cur = conn.cursor()\n    cur.execute(f"SELECT id, name, price FROM products ORDER BY {sort_field}")\n    return cur.fetchall()',
		 FALSE, 'sql_injection',
		 E'Этот код безопасен — sort_field проверяется по allowlist разрешённых столбцов перед подстановкой.',
		 E'Верно! Allowlist (множество ALLOWED_SORT) гарантирует, что в запрос подставится только один из заранее одобренных столбцов.',
		 TRUE),

		-- Секрет в логах уязвимый (токен)
		('b4000000-0000-0000-0000-000000000001', 'python', 'sensitive_logging',
		 E'import logging\n\ndef call_api(api_key, endpoint):\n    logging.info("Calling %s with key=%s", endpoint, api_key)\n    # ... make request ...',
		 TRUE, 'sensitive_logging',
		 E'api_key попадает в лог в открытом виде. Если логи собираются в централизованную систему, ключ становится доступен всем, кто читает логи.',
		 E'Безопасный вариант логирует только префикс ключа (первые 4 символа) или не логирует его вовсе.',
		 TRUE),

		-- Секрет в логах безопасный (токен)
		('b4000000-0000-0000-0000-000000000002', 'python', 'sensitive_logging',
		 E'import logging\n\ndef call_api(api_key, endpoint):\n    key_hint = api_key[:4] + "****" if api_key else "none"\n    logging.info("Calling %s with key=%s", endpoint, key_hint)\n    # ... make request ...',
		 FALSE, 'sensitive_logging',
		 E'Этот код безопасен — в лог попадает только подсказка (первые 4 символа), а не полный ключ.',
		 E'Верно! Маскировка ключа (первые 4 символа + "****") позволяет отлаживать проблемы, не раскрывая секрет в логах.',
		 TRUE),

		-- Path traversal через ZIP уязвимый
		('b5000000-0000-0000-0000-000000000001', 'python', 'path_traversal',
		 E'import zipfile, os\n\ndef extract_zip(zip_path, dest_dir):\n    with zipfile.ZipFile(zip_path) as zf:\n        for name in zf.namelist():\n            zf.extract(name, dest_dir)',
		 TRUE, 'path_traversal',
		 E'ZIP-файл может содержать пути вида ../../etc/passwd. extract() запишет файл по этому пути — классическая Zip Slip уязвимость.',
		 E'Безопасный вариант проверяет каждый путь через normpath и commonpath перед извлечением.',
		 TRUE),

		-- Path traversal через ZIP безопасный
		('b5000000-0000-0000-0000-000000000002', 'python', 'path_traversal',
		 E'import zipfile, os\n\ndef extract_zip(zip_path, dest_dir):\n    dest_dir = os.path.realpath(dest_dir)\n    with zipfile.ZipFile(zip_path) as zf:\n        for name in zf.namelist():\n            out = os.path.realpath(os.path.join(dest_dir, name))\n            if not out.startswith(dest_dir + os.sep):\n                raise ValueError(f"Zip slip detected: {name}")\n            zf.extract(name, dest_dir)',
		 FALSE, 'path_traversal',
		 E'Этот код безопасен — каждый путь проверяется через realpath и сравнивается с целевой директорией.',
		 E'Верно! os.path.realpath разрешает ../.. последовательности, а проверка startswith гарантирует, что файл попадёт только в dest_dir.',
		 TRUE),

		-- XSS через cookie уязвимый
		('b6000000-0000-0000-0000-000000000001', 'python', 'xss',
		 E'from flask import request, render_template_string\n\n@app.route("/welcome")\ndef welcome():\n    name = request.cookies.get("username", "гость")\n    return render_template_string(f"<h1>Привет, {name}!</h1>")',
		 TRUE, 'xss',
		 E'render_template_string с f-string вставляет значение cookie напрямую в HTML. Cookie можно подделать и внедрить JS-код.',
		 E'Безопасный вариант использует render_template_string с переменными Jinja2 ({{ name }}), а не f-string.',
		 TRUE),

		-- XSS через cookie безопасный
		('b6000000-0000-0000-0000-000000000002', 'python', 'xss',
		 E'from flask import request, render_template_string\n\n@app.route("/welcome")\ndef welcome():\n    name = request.cookies.get("username", "гость")\n    return render_template_string(\n        "<h1>Привет, {{ name }}!</h1>",\n        name=name\n    )',
		 FALSE, 'xss',
		 E'Этот код безопасен — {{ name }} передаётся через Jinja2, который автоматически экранирует HTML.',
		 E'Верно! render_template_string с {{ name }} использует автоэскейп Jinja2. Даже если cookie содержит <script>, он будет выведен как текст.',
		 TRUE),

		-- SSRF через редирект уязвимый
		('b7000000-0000-0000-0000-000000000001', 'python', 'ssrf',
		 E'from flask import redirect, request\n\n@app.route("/go")\ndef go():\n    url = request.args.get("to", "/")\n    return redirect(url)',
		 TRUE, 'ssrf',
		 E'Открытый редирект без проверки URL. Атакующий может перенаправить пользователя на фишинговый сайт или использовать для SSRF через уязвимые прокси.',
		 E'Безопасный вариант проверяет, что URL относится к разрешённым доменам или является относительным путём.',
		 TRUE),

		-- Открытый редирект безопасный
		('b7000000-0000-0000-0000-000000000002', 'python', 'ssrf',
		 E'from flask import redirect, request, abort\nimport urllib.parse\n\nALLOWED_HOSTS = {"example.com", "www.example.com"}\n\n@app.route("/go")\ndef go():\n    url = request.args.get("to", "/")\n    p = urllib.parse.urlparse(url)\n    if p.netloc and p.hostname not in ALLOWED_HOSTS:\n        abort(400)\n    return redirect(url)',
		 FALSE, 'ssrf',
		 E'Этот код безопасен — внешние хосты проверяются по allowlist, относительные пути (без netloc) разрешены.',
		 E'Верно! urlparse разбирает URL: если netloc задан, хост должен быть в ALLOWED_HOSTS. Относительные пути (начинающиеся с /) проходят без ограничений.',
		 TRUE),

		-- SQL через конкатенацию уязвимый
		('b8000000-0000-0000-0000-000000000001', 'python', 'sql_injection',
		 E'def delete_user(conn, user_id):\n    cur = conn.cursor()\n    cur.execute("DELETE FROM users WHERE id = " + str(user_id))\n    conn.commit()',
		 TRUE, 'sql_injection',
		 E'str(user_id) конкатенируется со строкой SQL. Если user_id = "1 OR 1=1", будут удалены все записи в таблице.',
		 E'Безопасный вариант передаёт user_id через параметр плейсхолдера.',
		 TRUE),

		-- Логирование исключения уязвимый
		('b9000000-0000-0000-0000-000000000001', 'python', 'sensitive_logging',
		 E'import logging, traceback\n\ndef process_payment(card_number, amount):\n    try:\n        # ... payment flow ...\n        raise Exception("gateway timeout")\n    except Exception:\n        logging.error(traceback.format_exc())\n        logging.error("card: %s amount: %s", card_number, amount)\n        return False',
		 TRUE, 'sensitive_logging',
		 E'Номер карты логируется в открытом виде — это нарушение PCI DSS. Трассировка стека также может содержать секретные данные из переменных.',
		 E'Безопасный вариант логирует только тип ошибки и маскированный номер карты (последние 4 цифры).',
		 TRUE),

		-- Логирование исключения безопасный
		('b9000000-0000-0000-0000-000000000002', 'python', 'sensitive_logging',
		 E'import logging\n\ndef process_payment(card_number, amount):\n    masked = "**** **** **** " + card_number[-4:]\n    try:\n        # ... payment flow ...\n        raise Exception("gateway timeout")\n    except Exception as e:\n        logging.error("payment failed card=%s amount=%s err=%s", masked, amount, type(e).__name__)\n        return False',
		 FALSE, 'sensitive_logging',
		 E'Этот код безопасен — номер карты маскируется до последних 4 цифр, тип ошибки логируется без стек-трейса.',
		 E'Верно! card_number[-4:] оставляет только последние 4 цифры, что позволяет идентифицировать транзакцию без раскрытия полного номера.',
		 TRUE),

		-- Хранение пароля уязвимый
		('ba000000-0000-0000-0000-000000000001', 'python', 'insecure_storage',
		 E'import hashlib\n\ndef save_password(db, user_id, password):\n    hashed = hashlib.md5(password.encode()).hexdigest()\n    db.execute(\n        "INSERT INTO users (id, password_hash) VALUES (%s, %s)",\n        (user_id, hashed)\n    )',
		 TRUE, 'insecure_storage',
		 E'MD5 — криптографически сломан и слишком быстрый для паролей. Радужные таблицы и брутфорс взломают такой хеш за секунды.',
		 E'Безопасный вариант использует bcrypt, argon2 или PBKDF2 — алгоритмы, специально созданные для хеширования паролей (медленные, с солью).',
		 TRUE),

		-- Хранение пароля безопасный
		('ba000000-0000-0000-0000-000000000002', 'python', 'insecure_storage',
		 E'import bcrypt\n\ndef save_password(db, user_id, password):\n    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))\n    db.execute(\n        "INSERT INTO users (id, password_hash) VALUES (%s, %s)",\n        (user_id, hashed.decode())\n    )',
		 FALSE, 'insecure_storage',
		 E'Этот код безопасен — bcrypt с cost factor 12 медленный и добавляет соль автоматически.',
		 E'Верно! bcrypt.gensalt(rounds=12) создаёт уникальную соль, а высокий cost factor делает брутфорс нецелесообразным даже при утечке БД.',
		 TRUE),

		-- Path traversal через имя файла уязвимый
		('bb000000-0000-0000-0000-000000000001', 'python', 'path_traversal',
		 E'import os\nfrom flask import send_file, request\n\n@app.route("/static/<path:filename>")\ndef serve_file(filename):\n    file_path = os.path.join("/var/www/static", filename)\n    return send_file(file_path)',
		 TRUE, 'path_traversal',
		 E'Flask маршрут <path:...> разрешает слэши, включая ../. Путь /static/../../etc/passwd даст доступ к системным файлам.',
		 E'Безопасный вариант проверяет итоговый путь через commonpath или использует flask.safe_join.',
		 TRUE),

		-- Path traversal через имя файла безопасный
		('bb000000-0000-0000-0000-000000000002', 'python', 'path_traversal',
		 E'import os\nfrom flask import send_file, request, abort\nfrom werkzeug.utils import safe_join\n\nSTATIC_DIR = "/var/www/static"\n\n@app.route("/static/<path:filename>")\ndef serve_file(filename):\n    file_path = safe_join(STATIC_DIR, filename)\n    if file_path is None:\n        abort(404)\n    return send_file(file_path)',
		 FALSE, 'path_traversal',
		 E'Этот код безопасен — werkzeug.utils.safe_join возвращает None при попытке выйти за пределы директории.',
		 E'Верно! safe_join проверяет, что итоговый путь остаётся внутри STATIC_DIR. При попытке ../.. возвращает None — abort(404).',
		 TRUE)

		ON CONFLICT (id) DO UPDATE SET
			language = EXCLUDED.language,
			topic = EXCLUDED.topic,
			code = EXCLUDED.code,
			is_vulnerable = EXCLUDED.is_vulnerable,
			vulnerability_type = EXCLUDED.vulnerability_type,
			explanation_vulnerable = EXCLUDED.explanation_vulnerable,
			explanation_safe = EXCLUDED.explanation_safe,
			is_active = EXCLUDED.is_active`); err != nil {
		pool.Close()
		return nil, err
	}
	// Перед созданием уникального индекса чистим дубликаты (оставляем по одной строке snippet_id+text).
	if _, err := pool.Exec(ctx, `
		DELETE FROM play_fix_options p
		USING play_fix_options q
		WHERE p.ctid < q.ctid
		  AND p.snippet_id = q.snippet_id
		  AND p.text = q.text`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		CREATE UNIQUE INDEX IF NOT EXISTS play_fix_options_snippet_text_idx
		ON play_fix_options (snippet_id, text)`); err != nil {
		pool.Close()
		return nil, err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO play_fix_options (snippet_id, text, correct) VALUES
			('11111111-1111-1111-1111-111111111111',
			 E'cur.execute(\"SELECT * FROM users WHERE email = ?\", (email,))',
			 TRUE),
			('11111111-1111-1111-1111-111111111111',
			 E'cur.execute(\"SELECT * FROM users WHERE email = ''\" + email + \"''\")',
			 FALSE),
			('11111111-1111-1111-1111-111111111111',
			 E'cur.execute(\"SELECT * FROM users\")',
			 FALSE),
			('22222222-2222-2222-2222-222222222222',
			 E'logger.error(\"Ошибка аутентификации\", extra={\"request_id\": request_id})',
			 TRUE),
			('22222222-2222-2222-2222-222222222222',
			 E'logger.error(\"Ошибка аутентификации: %s\", password)',
			 FALSE),
			('22222222-2222-2222-2222-222222222222',
			 E'logger.error(\"Ошибка аутентификации: %s\", user.email)',
			 FALSE),
			('33333333-3333-3333-3333-333333333333',
			 E'safe_name = os.path.basename(filename)
path = os.path.join("/var/app/uploads", safe_name)',
			 TRUE),
			('33333333-3333-3333-3333-333333333333',
			 E'path = \"/var/app/uploads/\" + filename',
			 FALSE),
			('33333333-3333-3333-3333-333333333333',
			 E'path = filename',
			 FALSE),
			('44444444-4444-4444-4444-444444444444',
			 E'return render_template(\"page.html\", title=title)',
			 TRUE),
			('44444444-4444-4444-4444-444444444444',
			 E'return f\"<h1>{title}</h1>\"',
			 FALSE),
			('44444444-4444-4444-4444-444444444444',
			 E'return \"<h1>\" + title + \"</h1>\"',
			 FALSE)
		ON CONFLICT (snippet_id, text) DO NOTHING`); err != nil {
		pool.Close()
		return nil, err
	}
	return &PgStore{pool: pool}, nil
}

func (s *PgStore) Close() { s.pool.Close() }

// CreateUser создаёт пользователя и запись питомца (1:1).
func (s *PgStore) CreateUser(email, nickname, passwordHash, lastName, firstName, patronymic string) (*User, error) {
	ctx := context.Background()
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO users (email, nickname, password_hash, last_name, first_name, patronymic, role) VALUES ($1, $2, $3, $4, $5, $6, 'user')
		 RETURNING id`,
		email, nickname, passwordHash, lastName, firstName, patronymic,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO pets (user_id, name) VALUES ($1, 'Хакпет')`, id)
	if err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *PgStore) GetByEmail(email string) (*User, error) {
	var u User
	err := s.pool.QueryRow(context.Background(),
		`SELECT id, email, nickname, last_name, first_name, patronymic, role, avatar_url, password_hash, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Nickname, &u.LastName, &u.FirstName, &u.Patronymic, &u.Role, &u.AvatarURL, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *PgStore) GetByID(id string) (*User, error) {
	var u User
	err := s.pool.QueryRow(context.Background(),
		`SELECT id, email, nickname, last_name, first_name, patronymic, role, avatar_url, password_hash, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Nickname, &u.LastName, &u.FirstName, &u.Patronymic, &u.Role, &u.AvatarURL, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

// UpdateAvatar обновляет URL аватарки пользователя.
func (s *PgStore) UpdateAvatar(userID, avatarURL string) (*User, error) {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE users SET avatar_url = $2, updated_at = now() WHERE id = $1`,
		userID, avatarURL,
	)
	if err != nil {
		return nil, err
	}
	return s.GetByID(userID)
}

// UpdateProfile обновляет email, nickname и ФИО пользователя.
func (s *PgStore) UpdateProfile(userID, email, nickname, lastName, firstName, patronymic string) (*User, error) {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE users SET email = $2, nickname = $3, last_name = $4, first_name = $5, patronymic = $6, updated_at = now() WHERE id = $1`,
		userID, email, nickname, lastName, firstName, patronymic,
	)
	if err != nil {
		return nil, err
	}
	return s.GetByID(userID)
}

// GetPet возвращает питомца пользователя.
func (s *PgStore) GetPet(userID string) (*Pet, error) {
	var p Pet
	var rawVariants []byte
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, name, level, xp, mood_type, equipped_aura, equipped_variant, equipped_frame, COALESCE(pet_variants, '{}'::jsonb)
		 FROM pets WHERE user_id = $1`,
		userID,
	).Scan(&p.UserID, &p.Name, &p.Level, &p.XP, &p.MoodType, &p.EquippedAura, &p.EquippedVariant, &p.EquippedFrame, &rawVariants)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("pet not found")
		}
		return nil, err
	}

	var variants map[string]PetVariantState
	if len(rawVariants) > 0 {
		if err := json.Unmarshal(rawVariants, &variants); err != nil {
			variants = map[string]PetVariantState{}
		}
	}
	legacyLevel := p.Level
	legacyXP := p.XP
	if len(variants) == 0 {
		progressLevel := fetchLegacyProgressLevel(context.Background(), s.pool, userID)
		if progressLevel > legacyLevel {
			legacyLevel = progressLevel
		}
		if legacyXP == 0 && legacyLevel > 1 {
			legacyXP = petXPFromLevel(legacyLevel)
		}
	}
	normalizedVariant := strings.TrimSpace(p.EquippedVariant)
	if normalizedVariant == "" {
		normalizedVariant = "classic"
	}
	variants, variantsChanged := ensurePetVariantStates(variants, p.Name, normalizedVariant, legacyLevel, legacyXP)
	current := variants[normalizedVariant]
	persistNeeded := variantsChanged || p.EquippedVariant != normalizedVariant || p.Name != current.Name || p.Level != current.Level || p.XP != current.XP
	if persistNeeded {
		payload, err := json.Marshal(variants)
		if err != nil {
			return nil, err
		}
		if _, err := s.pool.Exec(context.Background(),
			`UPDATE pets
			 SET equipped_variant = $2, name = $3, level = $4, xp = $5, pet_variants = $6
			 WHERE user_id = $1`,
			userID, normalizedVariant, current.Name, current.Level, current.XP, payload,
		); err != nil {
			return nil, err
		}
	}
	p.EquippedVariant = normalizedVariant
	p.Name = current.Name
	p.Level = current.Level
	p.XP = current.XP
	p.Variants = variants
	return &p, nil
}

// UpdatePetName обновляет имя питомца пользователя.
func (s *PgStore) UpdatePetName(userID, name string) (*Pet, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p Pet
	var rawVariants []byte
	err = tx.QueryRow(ctx,
		`SELECT user_id, name, level, xp, mood_type, equipped_aura, equipped_variant, equipped_frame, COALESCE(pet_variants, '{}'::jsonb)
		 FROM pets WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&p.UserID, &p.Name, &p.Level, &p.XP, &p.MoodType, &p.EquippedAura, &p.EquippedVariant, &p.EquippedFrame, &rawVariants)
	if err != nil {
		return nil, err
	}
	var variants map[string]PetVariantState
	if len(rawVariants) > 0 {
		_ = json.Unmarshal(rawVariants, &variants)
	}
	legacyLevel := p.Level
	legacyXP := p.XP
	if len(variants) == 0 {
		progressLevel := fetchLegacyProgressLevel(ctx, tx, userID)
		if progressLevel > legacyLevel {
			legacyLevel = progressLevel
		}
		if legacyXP == 0 && legacyLevel > 1 {
			legacyXP = petXPFromLevel(legacyLevel)
		}
	}
	equippedVariant := strings.TrimSpace(p.EquippedVariant)
	if equippedVariant == "" {
		equippedVariant = "classic"
	}
	variants, _ = ensurePetVariantStates(variants, p.Name, equippedVariant, legacyLevel, legacyXP)
	current := variants[equippedVariant]
	current.Name = strings.TrimSpace(name)
	if current.Name == "" {
		current.Name = "Хакпет"
	}
	variants[equippedVariant] = current
	payload, err := json.Marshal(variants)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx,
		`UPDATE pets
		 SET name = $2, level = $3, xp = $4, equipped_variant = $5, pet_variants = $6
		 WHERE user_id = $1`,
		userID, current.Name, current.Level, current.XP, equippedVariant, payload,
	)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetPet(userID)
}

// UpdatePetAura обновляет экипированную ауру питомца пользователя.
func (s *PgStore) UpdatePetAura(userID, aura string) (*Pet, error) {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE pets SET equipped_aura = $2 WHERE user_id = $1`,
		userID, aura,
	)
	if err != nil {
		return nil, err
	}
	return s.GetPet(userID)
}

// UpdatePetVariant сохраняет выбранный визуальный вид питомца.
func (s *PgStore) UpdatePetVariant(userID, variant string) (*Pet, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p Pet
	var rawVariants []byte
	err = tx.QueryRow(ctx,
		`SELECT user_id, name, level, xp, mood_type, equipped_aura, equipped_variant, equipped_frame, COALESCE(pet_variants, '{}'::jsonb)
		 FROM pets WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&p.UserID, &p.Name, &p.Level, &p.XP, &p.MoodType, &p.EquippedAura, &p.EquippedVariant, &p.EquippedFrame, &rawVariants)
	if err != nil {
		return nil, err
	}
	var variants map[string]PetVariantState
	if len(rawVariants) > 0 {
		_ = json.Unmarshal(rawVariants, &variants)
	}
	legacyLevel := p.Level
	legacyXP := p.XP
	if len(variants) == 0 {
		progressLevel := fetchLegacyProgressLevel(ctx, tx, userID)
		if progressLevel > legacyLevel {
			legacyLevel = progressLevel
		}
		if legacyXP == 0 && legacyLevel > 1 {
			legacyXP = petXPFromLevel(legacyLevel)
		}
	}
	currentVariant := strings.TrimSpace(p.EquippedVariant)
	if currentVariant == "" {
		currentVariant = "classic"
	}
	variants, _ = ensurePetVariantStates(variants, p.Name, currentVariant, legacyLevel, legacyXP)
	nextVariant := strings.TrimSpace(variant)
	if nextVariant == "" {
		nextVariant = "classic"
	}
	state, ok := variants[nextVariant]
	if !ok {
		state = defaultPetVariantState("Хакпет")
		variants[nextVariant] = state
	}
	payload, err := json.Marshal(variants)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx,
		`UPDATE pets
		 SET equipped_variant = $2, name = $3, level = $4, xp = $5, pet_variants = $6
		 WHERE user_id = $1`,
		userID, nextVariant, state.Name, state.Level, state.XP, payload,
	)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetPet(userID)
}

// UpdatePetFrame сохраняет выбранную рамку аватара.
func (s *PgStore) UpdatePetFrame(userID, frame string) (*Pet, error) {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE pets SET equipped_frame = $2 WHERE user_id = $1`,
		userID, frame,
	)
	if err != nil {
		return nil, err
	}
	return s.GetPet(userID)
}

// AddPetXP увеличивает опыт питомца и возвращает обновлённую запись.
func (s *PgStore) AddPetXP(userID string, amount int) (*Pet, error) {
	if amount <= 0 {
		return s.GetPet(userID)
	}
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p Pet
	var rawVariants []byte
	err = tx.QueryRow(ctx,
		`SELECT user_id, name, level, xp, mood_type, equipped_aura, equipped_variant, equipped_frame, COALESCE(pet_variants, '{}'::jsonb)
		 FROM pets WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&p.UserID, &p.Name, &p.Level, &p.XP, &p.MoodType, &p.EquippedAura, &p.EquippedVariant, &p.EquippedFrame, &rawVariants)
	if err != nil {
		return nil, err
	}
	var variants map[string]PetVariantState
	if len(rawVariants) > 0 {
		_ = json.Unmarshal(rawVariants, &variants)
	}
	legacyLevel := p.Level
	legacyXP := p.XP
	if len(variants) == 0 {
		progressLevel := fetchLegacyProgressLevel(ctx, tx, userID)
		if progressLevel > legacyLevel {
			legacyLevel = progressLevel
		}
		if legacyXP == 0 && legacyLevel > 1 {
			legacyXP = petXPFromLevel(legacyLevel)
		}
	}
	equippedVariant := strings.TrimSpace(p.EquippedVariant)
	if equippedVariant == "" {
		equippedVariant = "classic"
	}
	variants, _ = ensurePetVariantStates(variants, p.Name, equippedVariant, legacyLevel, legacyXP)
	current := variants[equippedVariant]
	current.XP += amount
	if current.XP < 0 {
		current.XP = 0
	}
	current.Level = petLevelFromXP(current.XP)
	variants[equippedVariant] = current
	payload, err := json.Marshal(variants)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx,
		`UPDATE pets
		 SET name = $2, level = $3, xp = $4, equipped_variant = $5, pet_variants = $6
		 WHERE user_id = $1`,
		userID, current.Name, current.Level, current.XP, equippedVariant, payload,
	)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetPet(userID)
}

const petMaxLevel = 50
const petXPPerLevel = 100

var knownPetVariants = []string{"classic", "neon", "ember"}

type petLevelQuerySource interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func normalizePetLevel(level int) int {
	if level < 1 {
		return 1
	}
	if level > petMaxLevel {
		return petMaxLevel
	}
	return level
}

func petLevelFromXP(xp int) int {
	if xp < 0 {
		xp = 0
	}
	level := 1 + (xp / petXPPerLevel)
	return normalizePetLevel(level)
}

func petXPFromLevel(level int) int {
	return (normalizePetLevel(level) - 1) * petXPPerLevel
}

func defaultPetVariantState(name string) PetVariantState {
	title := strings.TrimSpace(name)
	if title == "" {
		title = "Хакпет"
	}
	return PetVariantState{
		Name:  title,
		Level: 1,
		XP:    0,
	}
}

func ensurePetVariantStates(
	raw map[string]PetVariantState,
	legacyName string,
	equippedVariant string,
	legacyLevel int,
	legacyXP int,
) (map[string]PetVariantState, bool) {
	changed := false
	variants := raw
	if variants == nil {
		variants = map[string]PetVariantState{}
		changed = true
	}
	activeVariant := strings.TrimSpace(equippedVariant)
	if activeVariant == "" {
		activeVariant = "classic"
		changed = true
	}
	if legacyXP < 0 {
		legacyXP = 0
		changed = true
	}
	legacyLevel = normalizePetLevel(legacyLevel)
	if legacyXP == 0 && legacyLevel > 1 {
		legacyXP = petXPFromLevel(legacyLevel)
		changed = true
	}

	if len(variants) == 0 {
		for _, variantID := range knownPetVariants {
			variants[variantID] = defaultPetVariantState("Хакпет")
		}
		active := variants[activeVariant]
		activeName := strings.TrimSpace(legacyName)
		if activeName != "" {
			active.Name = activeName
		}
		active.XP = legacyXP
		active.Level = petLevelFromXP(active.XP)
		variants[activeVariant] = active
		changed = true
	}

	for _, variantID := range knownPetVariants {
		if _, ok := variants[variantID]; !ok {
			variants[variantID] = defaultPetVariantState("Хакпет")
			changed = true
		}
	}

	for variantID, state := range variants {
		next := state
		if strings.TrimSpace(next.Name) == "" {
			next.Name = "Хакпет"
			changed = true
		}
		if next.XP < 0 {
			next.XP = 0
			changed = true
		}
		if next.XP == 0 && next.Level > 1 {
			next.XP = petXPFromLevel(next.Level)
			changed = true
		}
		derivedLevel := petLevelFromXP(next.XP)
		if next.Level != derivedLevel {
			next.Level = derivedLevel
			changed = true
		}
		variants[variantID] = next
	}

	return variants, changed
}

func fetchLegacyProgressLevel(ctx context.Context, src petLevelQuerySource, userID string) int {
	var completed int
	if err := src.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM user_module_progress WHERE user_id = $1 AND status = 'completed'`,
		userID,
	).Scan(&completed); err != nil {
		return 1
	}
	level := 1 + completed
	return normalizePetLevel(level)
}

// ListFocusSuggestions возвращает персональные рекомендации для дашборда.
func (s *PgStore) ListFocusSuggestions(userID string, limit int) ([]FocusSuggestion, error) {
	if limit <= 0 {
		limit = 6
	}
	if limit > 12 {
		limit = 12
	}

	var completed, inProgress, attempts int
	if err := s.pool.QueryRow(context.Background(), `
		SELECT
			COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0) AS completed_cnt,
			COALESCE(COUNT(*) FILTER (WHERE status = 'in_progress'), 0) AS in_progress_cnt,
			COALESCE(SUM(lab_attempt_count), 0) AS attempts_cnt
		FROM user_module_progress
		WHERE user_id = $1`, userID,
	).Scan(&completed, &inProgress, &attempts); err != nil {
		if !isUndefinedTable(err) && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	rows, err := s.pool.Query(context.Background(), `
		SELECT code, title, description
		FROM focus_suggestions
		WHERE is_active = TRUE
		  AND (min_completed IS NULL OR $1 >= min_completed)
		  AND (max_completed IS NULL OR $1 <= max_completed)
		  AND (min_in_progress IS NULL OR $2 >= min_in_progress)
		  AND (max_in_progress IS NULL OR $2 <= max_in_progress)
		  AND (min_attempts IS NULL OR $3 >= min_attempts)
		  AND (max_attempts IS NULL OR $3 <= max_attempts)
		ORDER BY priority DESC, random()
		LIMIT $4`, completed, inProgress, attempts, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []FocusSuggestion
	for rows.Next() {
		var item FocusSuggestion
		if err := rows.Scan(&item.ID, &item.Title, &item.Description); err != nil {
			return nil, err
		}
		item.Done = false
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(list) > 0 {
		return list, nil
	}

	// Fallback: если строгие фильтры ничего не вернули.
	rows, err = s.pool.Query(context.Background(), `
		SELECT code, title, description
		FROM focus_suggestions
		WHERE is_active = TRUE
		ORDER BY priority DESC, random()
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item FocusSuggestion
		if err := rows.Scan(&item.ID, &item.Title, &item.Description); err != nil {
			return nil, err
		}
		item.Done = false
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *PgStore) ListUserTodos(userID string, limit int) ([]UserTodo, error) {
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := s.pool.Query(context.Background(), `
		SELECT id::text, title, description, priority, done, position
		FROM user_todos
		WHERE user_id = $1
		ORDER BY position ASC, created_at ASC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]UserTodo, 0, limit)
	for rows.Next() {
		var item UserTodo
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.Priority, &item.Done, &item.Position); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *PgStore) CreateUserTodo(userID, title, description string, priority int) (*UserTodo, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if priority < 1 || priority > 3 {
		priority = 2
	}
	var item UserTodo
	err := s.pool.QueryRow(context.Background(), `
		WITH next_pos AS (
			SELECT COALESCE(MAX(position), 0) + 1 AS p
			FROM user_todos
			WHERE user_id = $1
		)
		INSERT INTO user_todos (user_id, title, description, priority, done, position)
		SELECT $1, $2, $3, $4, FALSE, p
		FROM next_pos
		RETURNING id::text, title, description, priority, done, position`,
		userID, title, description, priority,
	).Scan(&item.ID, &item.Title, &item.Description, &item.Priority, &item.Done, &item.Position)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *PgStore) UpdateUserTodo(userID, todoID, title, description string, priority int, done bool, position int) (*UserTodo, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if priority < 1 || priority > 3 {
		priority = 2
	}
	if position < 0 {
		position = 0
	}
	var item UserTodo
	err := s.pool.QueryRow(context.Background(), `
		UPDATE user_todos
		SET title = $3,
			description = $4,
			priority = $5,
			done = $6,
			position = $7,
			updated_at = now()
		WHERE user_id = $1 AND id = $2::uuid
		RETURNING id::text, title, description, priority, done, position`,
		userID, todoID, title, description, priority, done, position,
	).Scan(&item.ID, &item.Title, &item.Description, &item.Priority, &item.Done, &item.Position)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *PgStore) DeleteUserTodo(userID, todoID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM user_todos WHERE user_id = $1 AND id = $2::uuid`,
		userID, todoID,
	)
	return err
}

// ListBestPractices возвращает daily-random best practices.
// Набор детерминирован для пользователя в рамках суток и меняется каждые 24 часа.
func (s *PgStore) ListBestPractices(userID string, limit int) ([]BestPractice, error) {
	if limit <= 0 {
		limit = 4
	}
	if limit > 12 {
		limit = 12
	}

	rows, err := s.pool.Query(context.Background(), `
		SELECT code, title, description
		FROM best_practices
		WHERE is_active = TRUE
		ORDER BY md5(code || to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD') || $1), priority DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []BestPractice
	for rows.Next() {
		var item BestPractice
		if err := rows.Scan(&item.ID, &item.Title, &item.Description); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

// GetRandomPlaySnippet выбирает случайный активный фрагмент вместе с вариантами фикса.
func (s *PgStore) GetRandomPlaySnippet(language string) (*PlaySnippet, error) {
	query := `
		SELECT id, language, topic, code, is_vulnerable, vulnerability_type, explanation_vulnerable, explanation_safe
		FROM play_snippets
		WHERE is_active = TRUE`
	args := []any{}
	if language != "" {
		query += ` AND language = $1`
		args = append(args, language)
	}
	query += ` ORDER BY random() LIMIT 1`

	row := s.pool.QueryRow(context.Background(), query, args...)
	var sn PlaySnippet
	if err := row.Scan(&sn.ID, &sn.Language, &sn.Topic, &sn.Code, &sn.IsVulnerable, &sn.VulnerabilityType, &sn.ExplanationVulnerable, &sn.ExplanationSafe); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(context.Background(), `
		SELECT id, text, correct
		FROM play_fix_options
		WHERE snippet_id = $1
		ORDER BY id`, sn.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var opt PlayFixOption
		if err := rows.Scan(&opt.ID, &opt.Text, &opt.Correct); err != nil {
			return nil, err
		}
		opt.SnippetID = sn.ID
		sn.FixOptions = append(sn.FixOptions, opt)
	}
	return &sn, rows.Err()
}

// GetProgress возвращает прогресс пользователя по модулю.
func (s *PgStore) GetProgress(userID, moduleId string) (*ModuleProgress, error) {
	var lastStep string
	var status string
	var attemptCount int
	err := s.pool.QueryRow(context.Background(),
		`SELECT last_step, status, lab_attempt_count
		 FROM user_module_progress WHERE user_id = $1 AND module_id = $2`,
		userID, moduleId,
	).Scan(&lastStep, &status, &attemptCount)
	if err != nil {
		// Совместимость со старой схемой (module_progress).
		if isUndefinedTable(err) {
			return s.getProgressLegacy(userID, moduleId)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return &ModuleProgress{}, nil
		}
		return nil, err
	}
	completed := status == "completed"
	return &ModuleProgress{LastStep: lastStep, Completed: completed, AttemptCount: attemptCount}, nil
}

// SetProgress сохраняет прогресс пользователя по модулю.
func (s *PgStore) SetProgress(userID, moduleId string, p ModuleProgress) error {
	status := "not_started"
	if p.Completed {
		status = "completed"
	} else if p.LastStep != "" {
		status = "in_progress"
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO user_module_progress (user_id, module_id, status, last_step, lab_attempt_count, completed_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, CASE WHEN $3 = 'completed' THEN now() ELSE NULL END, now())
		 ON CONFLICT (user_id, module_id) DO UPDATE SET
		   status = EXCLUDED.status, last_step = EXCLUDED.last_step, lab_attempt_count = EXCLUDED.lab_attempt_count,
		   completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN COALESCE(user_module_progress.completed_at, now()) ELSE user_module_progress.completed_at END,
		   updated_at = now()`,
		userID, moduleId, status, p.LastStep, p.AttemptCount,
	)
	if isUndefinedTable(err) {
		return s.setProgressLegacy(userID, moduleId, p)
	}
	return err
}

// SaveAttempt сохраняет попытку сдачи лабы и обновляет прогресс модуля.
// moduleId должен передаваться из каталога (CompositeStore); пустой — только legacy-эвристика.
func (s *PgStore) SaveAttempt(userID, moduleId, labId, submissionId, status string, results []validator.RuleResult) error {
	ctx := context.Background()
	if moduleId == "" {
		var resolveErr error
		moduleId, resolveErr = s.getModuleIDByLabID(ctx, labId)
		if resolveErr != nil {
			moduleId = ""
		}
	}
	resultsJSON, _ := json.Marshal(results)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO lab_attempts (user_id, lab_id, module_id, submission_id, status, rule_results)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, labId, moduleId, submissionId, status, resultsJSON,
	)
	if err != nil {
		return err
	}
	// После лабы (pass или fail) — всегда переходим к финальному тесту.
	// Итоговое прохождение определяется на summary с учётом тестов и веса лабы.
	lastStep := "final-quiz"
	_, err = s.pool.Exec(ctx,
		`INSERT INTO user_module_progress (user_id, module_id, status, last_step, lab_attempt_count, completed_at, updated_at)
		 VALUES ($1, $2, 'in_progress', $3, 1, NULL, now())
		 ON CONFLICT (user_id, module_id) DO UPDATE SET
		   status = CASE WHEN user_module_progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
		   last_step = EXCLUDED.last_step,
		   lab_attempt_count = user_module_progress.lab_attempt_count + 1,
		   completed_at = user_module_progress.completed_at,
		   updated_at = now()`,
		userID, moduleId, lastStep,
	)
	if isUndefinedTable(err) {
		return s.saveAttemptLegacy(userID, moduleId, status)
	}
	return err
}

func (s *PgStore) getModuleIDByLabID(ctx context.Context, labId string) (string, error) {
	// В БД модули не загружены из JSON; lab_id обычно совпадает с module_id или выводится из контента.
	// Пока ищем по соглашению: path-traversal-lab -> path-traversal
	if len(labId) > 4 && labId[len(labId)-4:] == "-lab" {
		return labId[:len(labId)-4], nil
	}
	return labId, nil
}

// GetLastLabAttempt возвращает последнюю попытку лабы по пользователю и модулю (для экрана Итог).
func (s *PgStore) GetLastLabAttempt(userID, moduleId string) (status string, ruleResults []validator.RuleResult, err error) {
	status, ruleResults, err = s.getLastLabAttemptWhere(userID, `module_id = $2`, moduleId)
	if err != nil || status != "" || len(ruleResults) > 0 {
		return status, ruleResults, err
	}
	return "", nil, nil
}

// GetLastLabAttemptByLabID — fallback для старых записей с неверным module_id.
func (s *PgStore) GetLastLabAttemptByLabID(userID, labId string) (status string, ruleResults []validator.RuleResult, err error) {
	if labId == "" {
		return "", nil, nil
	}
	return s.getLastLabAttemptWhere(userID, `lab_id = $2`, labId)
}

func (s *PgStore) getLastLabAttemptWhere(userID, moduleClause, moduleArg string) (status string, ruleResults []validator.RuleResult, err error) {
	var rawStatus string
	var resultsJSON []byte
	query := `SELECT status, rule_results FROM lab_attempts
		 WHERE user_id = $1 AND ` + moduleClause + `
		 ORDER BY created_at DESC LIMIT 1`
	err = s.pool.QueryRow(context.Background(), query, userID, moduleArg).Scan(&rawStatus, &resultsJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, nil
		}
		return "", nil, err
	}
	if len(resultsJSON) > 0 {
		_ = json.Unmarshal(resultsJSON, &ruleResults)
	}
	return rawStatus, ruleResults, nil
}

// ClearModuleAttempts удаляет все попытки лабы и ответы на квизы модуля — вызывается при reset.
func (s *PgStore) ClearModuleAttempts(userID, moduleId string) error {
	ctx := context.Background()
	_, err := s.pool.Exec(ctx,
		`DELETE FROM lab_attempts WHERE user_id = $1 AND module_id = $2`,
		userID, moduleId,
	)
	if err != nil {
		return err
	}
	// Квизы привязаны к quiz_id вида "<moduleId>-checkpoint" и "<moduleId>-final"
	_, err = s.pool.Exec(ctx,
		`DELETE FROM quiz_answers WHERE user_id = $1 AND (quiz_id LIKE $2 OR quiz_id LIKE $3)`,
		userID, moduleId+"-%", moduleId+"-final",
	)
	return err
}

func (s *PgStore) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	return nil
}

func (s *PgStore) RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO quiz_answers (user_id, quiz_id, question_id, answer, correct) VALUES ($1, $2, $3, $4, $5)`,
		userID, quizId, questionId, answer, correct,
	)
	return err
}

// GetQuizAnswers возвращает последний ответ на каждый вопрос квиза.
func (s *PgStore) GetQuizAnswers(userID, quizId string) (map[string]int, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT DISTINCT ON (question_id) question_id, answer
		 FROM quiz_answers
		 WHERE user_id = $1 AND quiz_id = $2
		 ORDER BY question_id, created_at DESC`,
		userID, quizId,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return map[string]int{}, nil
		}
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var qid string
		var ans int
		if err := rows.Scan(&qid, &ans); err != nil {
			return nil, err
		}
		out[qid] = ans
	}
	return out, rows.Err()
}

// GetQuizStats возвращает количество верно решённых вопросов и общее число вопросов квиза для пользователя.
// Несколько попыток по одному и тому же вопросу не раздувают счётчики: считаем по DISTINCT question_id.
func (s *PgStore) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	err = s.pool.QueryRow(context.Background(),
		`SELECT
		   COALESCE(COUNT(DISTINCT question_id) FILTER (WHERE correct = TRUE), 0) AS correct_cnt,
		   COALESCE(COUNT(DISTINCT question_id), 0) AS total_cnt
		 FROM quiz_answers
		 WHERE user_id = $1 AND quiz_id = $2`,
		userID, quizId,
	).Scan(&correct, &total)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}
	return correct, total, nil
}

func isUndefinedTable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "42P01"
}

func (s *PgStore) getProgressLegacy(userID, moduleId string) (*ModuleProgress, error) {
	var p ModuleProgress
	err := s.pool.QueryRow(context.Background(),
		`SELECT last_step, completed, attempt_count
		 FROM module_progress WHERE user_id = $1 AND module_id = $2`,
		userID, moduleId,
	).Scan(&p.LastStep, &p.Completed, &p.AttemptCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &ModuleProgress{}, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *PgStore) setProgressLegacy(userID, moduleId string, p ModuleProgress) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO module_progress (module_id, user_id, last_step, completed, attempt_count, updated_at)
		 VALUES ($1, $2, $3, $4, $5, now())
		 ON CONFLICT (module_id, user_id) DO UPDATE SET
		   last_step = EXCLUDED.last_step,
		   completed = EXCLUDED.completed,
		   attempt_count = EXCLUDED.attempt_count,
		   updated_at = now()`,
		moduleId, userID, p.LastStep, p.Completed, p.AttemptCount,
	)
	return err
}

func (s *PgStore) saveAttemptLegacy(userID, moduleId, status string) error {
	lastStep := "results"
	if status == "passed" {
		lastStep = "summary"
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO module_progress (module_id, user_id, last_step, completed, attempt_count, updated_at)
		 VALUES ($1, $2, $3, FALSE, 1, now())
		 ON CONFLICT (module_id, user_id) DO UPDATE SET
		   last_step = EXCLUDED.last_step,
		   completed = module_progress.completed,
		   attempt_count = module_progress.attempt_count + 1,
		   updated_at = now()`,
		moduleId, userID, lastStep,
	)
	return err
}

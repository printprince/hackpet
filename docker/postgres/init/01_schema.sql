-- =============================================================================
-- Hackpet: нормализованная схема БД (масштабируемая, с заделом под контент).
-- Выполняется при первом запуске контейнера postgres (docker compose up).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Пользователи
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    nickname      TEXT NOT NULL UNIQUE,
    last_name     TEXT NOT NULL DEFAULT '',
    first_name    TEXT NOT NULL DEFAULT '',
    patronymic    TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    avatar_url    TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS patronymic TEXT NOT NULL DEFAULT '';
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
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);

COMMENT ON TABLE users IS 'Пользователи платформы; авторизация по email, отображение по nickname.';

-- -----------------------------------------------------------------------------
-- 2. Питомец (1:1 с пользователем)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pets (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT 'Хакпет',
    level       INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 100),
    xp          INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    mood_type   TEXT NOT NULL DEFAULT 'new',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pets IS 'Питомец пользователя (1:1). level/xp от прогресса; mood_type: new, learning, active, expert.';

-- -----------------------------------------------------------------------------
-- 3. Каталог: курсы и модули (задел под перенос из JSON / админку)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'coming_soon'
        CHECK (status IN ('available', 'coming_soon', 'archived')),
    difficulty     TEXT,
    total_minutes  INT,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL DEFAULT '',
    difficulty  TEXT NOT NULL DEFAULT 'medium',
    minutes     INT NOT NULL DEFAULT 0,
    topic       TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Связь курс — модули с порядком (один модуль может быть в нескольких курсах)
CREATE TABLE IF NOT EXISTS course_modules (
    course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id   TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    position    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (course_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules (course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_module ON course_modules (module_id);

COMMENT ON TABLE course_modules IS 'Порядок модулей в курсе; один модуль может входить в несколько курсов.';

-- -----------------------------------------------------------------------------
-- 4. Контент модуля: видео, документы, ссылки (задел на будущее)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS module_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('video', 'document', 'link', 'embed')),
    url_or_path     TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT '',
    position        INT NOT NULL DEFAULT 0,
    duration_sec     INT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_assets_module ON module_assets (module_id);

COMMENT ON TABLE module_assets IS 'Доп. контент модуля: видео, PDF, ссылки. position — порядок в модуле.';

-- -----------------------------------------------------------------------------
-- 5. Прогресс пользователя по модулю
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_module_progress (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    last_step       TEXT NOT NULL DEFAULT '',
    lab_attempt_count INT NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_module_progress_user ON user_module_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_progress_module ON user_module_progress (module_id);

COMMENT ON COLUMN user_module_progress.last_step IS 'theory|quiz|lab|results|fix|final-quiz|summary';

-- -----------------------------------------------------------------------------
-- 6. Прогресс пользователя по курсу (сертификаты, завершение)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_course_progress (
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id                TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completed_at             TIMESTAMPTZ,
    certificate_issued_at   TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_course_progress_user ON user_course_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_course ON user_course_progress (course_id);

-- -----------------------------------------------------------------------------
-- 7. Попытки сдачи лаб (история + результаты правил)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_attempts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id        TEXT NOT NULL,
    module_id     TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
    rule_results  JSONB NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_attempts_user ON lab_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_lab ON lab_attempts (lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_created ON lab_attempts (created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. Ответы на квизы (чекпоинт и финальный; аналитика, дообучение)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_answers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id     TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer      INT NOT NULL,
    correct     BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_user ON quiz_answers (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_quiz ON quiz_answers (quiz_id);

-- -----------------------------------------------------------------------------
-- 10. Рекомендации "Фокус на сегодня" для дашборда
-- -----------------------------------------------------------------------------
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
);

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
    is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 10b. Best practice для дашборда (daily-random)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS best_practices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    priority          INT NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 11. Триггер: автообновление updated_at при UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_pets_updated_at
    BEFORE UPDATE ON pets FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_courses_updated_at
    BEFORE UPDATE ON courses FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_modules_updated_at
    BEFORE UPDATE ON modules FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_user_module_progress_updated_at
    BEFORE UPDATE ON user_module_progress FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_user_course_progress_updated_at
    BEFORE UPDATE ON user_course_progress FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
